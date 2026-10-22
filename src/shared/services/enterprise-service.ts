/**
 * GitHub Enterprise support: the user grants the extension access to the domain of a GitHub
 * Enterprise Server site on its own domain, and the content script is registered for that
 * domain. GitHub Enterprise Cloud sites (`*.ghe.com`) need no setup: the manifest covers them.
 * The granted origins are the single source of truth: the background script reconciles the registered content scripts with them (after install, update, browser start and every permission change), so nothing else is stored.
 */

/** The site the manifest already covers; it is not an Enterprise domain. */
const GITHUB_HOST = 'github.com';

/** GitHub Enterprise Cloud with data residency: the manifest covers `ghe.com` and every `*.ghe.com` site. */
const GHE_CLOUD_HOST = 'ghe.com';

/** Whether the manifest's content script already matches the host (`ghe.com` or a subdomain). */
function isGheCloudHost(host: string): boolean {
	return host === GHE_CLOUD_HOST || host.endsWith(`.${GHE_CLOUD_HOST}`);
}

/** Prefix of the ids of the registered content scripts (the id must not start with `_`). */
const SCRIPT_ID_PREFIX = 'hyperfriend-enterprise:';

/** `https://host/*`: the origin patterns this service grants (no port, no wildcard host). */
const ORIGIN_PATTERN_REGEX = /^https:\/\/([^/*:@]+)\/\*$/;

/** A DNS host name: labels of letters, digits and hyphens, not starting or ending with a hyphen. */
const HOST_REGEX =
	/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** The content script file the manifests declare. */
const CONTENT_SCRIPT_FILE = 'content.js';

/**
 * Result of reading a domain typed by the user.
 */
export type ParseHostResult =
	{ ok: true; host: string } | { ok: false; error: string };

/**
 * Reads the domain of a GitHub Enterprise site from what the user typed: a host name, or a URL
 * of the site (the scheme, path, query and hash are dropped). Only `https` sites, and no ports
 * or wildcards, are accepted; github.com and its subdomains are not Enterprise sites.
 *
 * @param input - Text of the field, e.g. `github.example.com` or `https://github.example.com/org`.
 * @returns The lowercase host, or a short user-facing error.
 */
export function parseEnterpriseHost(input: string): ParseHostResult {
	const text = input.trim().toLowerCase();
	if (text === '') {
		return {
			ok: false,
			error: 'Enter the domain of your GitHub Enterprise site.',
		};
	}

	if (/^[a-z][a-z0-9+.-]*:\/\//.test(text) && !text.startsWith('https://')) {
		return { ok: false, error: 'Only https sites are supported.' };
	}

	if (text.includes('*')) {
		return {
			ok: false,
			error: 'Wildcards are not supported: enter the exact domain.',
		};
	}

	let url: URL;
	try {
		url = new URL(text.startsWith('https://') ? text : `https://${text}`);
	} catch {
		return { ok: false, error: 'This is not a valid domain.' };
	}

	if (url.username !== '' || url.password !== '' || url.port !== '') {
		return {
			ok: false,
			error: 'Enter the domain only, without a user name or a port.',
		};
	}

	// `hostname` is the ASCII (punycode) form of an international domain, as a match pattern needs
	const host = url.hostname;
	if (!HOST_REGEX.test(host)) {
		return { ok: false, error: 'This is not a valid domain.' };
	}

	if (host === GITHUB_HOST || host.endsWith(`.${GITHUB_HOST}`)) {
		return {
			ok: false,
			error: 'github.com is supported without any setup.',
		};
	}

	if (isGheCloudHost(host)) {
		return {
			ok: false,
			error: 'ghe.com sites are supported without any setup.',
		};
	}

	return { ok: true, host };
}

/**
 * Returns the origin pattern of an Enterprise domain: `https://host/*`.
 *
 * @param host - Domain from parseEnterpriseHost.
 */
export function toOriginPattern(host: string): string {
	return `https://${host}/*`;
}

/**
 * Returns the Enterprise domains among origin patterns: `https://host/*` ones, except github.com and `*.ghe.com`.
 */
function hostsOfOrigins(origins: string[] | undefined): string[] {
	const hosts = new Set<string>();
	for (const origin of origins ?? []) {
		const host = ORIGIN_PATTERN_REGEX.exec(origin)?.[1];
		if (host && host !== GITHUB_HOST && !isGheCloudHost(host)) {
			hosts.add(host);
		}
	}

	return [...hosts].sort();
}

/**
 * Returns the Enterprise domains the extension has been granted access to.
 *
 * @returns The domains, sorted.
 */
export async function listEnterpriseHosts(): Promise<string[]> {
	const granted = await chrome.permissions.getAll();
	return hostsOfOrigins(granted.origins);
}

/**
 * Asks the browser for access to an Enterprise domain. Must be called directly from a user
 * gesture (a click): nothing is awaited before the request.
 *
 * @param host - Domain from parseEnterpriseHost.
 * @returns Resolves with whether the user granted the access.
 */
export function requestEnterpriseHost(host: string): Promise<boolean> {
	return chrome.permissions.request({ origins: [toOriginPattern(host)] });
}

/**
 * Takes the access to an Enterprise domain back. The background script then unregisters the
 * content script of the domain (see syncEnterpriseScripts).
 *
 * @param host - Domain to remove.
 * @returns Resolves with whether the access was removed.
 */
export function removeEnterpriseHost(host: string): Promise<boolean> {
	return chrome.permissions.remove({ origins: [toOriginPattern(host)] });
}

/**
 * Runs the content script in the open tabs of a domain, which were loaded before it was registered.
 * A tab that already runs it ignores the second run (see the guard in content.ts).
 */
async function injectIntoOpenTabs(host: string): Promise<void> {
	const tabs = await chrome.tabs.query({ url: toOriginPattern(host) });
	for (const tab of tabs) {
		if (tab.id === undefined) {
			continue;
		}

		try {
			await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: [CONTENT_SCRIPT_FILE],
			});
		} catch (error) {
			// A tab that closed or navigated meanwhile, or a page the browser does not script
			console.warn(
				`[Hyperfriend] Could not start on a tab of ${host}.`,
				error
			);
		}
	}
}

/**
 * Unregisters content scripts. The call is all or nothing, so when it fails (an id that is
 * already gone, for example) every id is tried on its own; a failure never stops the sync,
 * so the missing domains are still registered.
 *
 * @param ids - Ids of registered content scripts.
 */
async function unregisterScripts(ids: string[]): Promise<void> {
	try {
		await chrome.scripting.unregisterContentScripts({ ids });
		return;
	} catch {
		// Try each id on its own below
	}

	for (const id of ids) {
		try {
			await chrome.scripting.unregisterContentScripts({ ids: [id] });
		} catch (error) {
			console.warn(`[Hyperfriend] Could not unregister ${id}.`, error);
		}
	}
}

/**
 * What syncEnterpriseScripts may do besides matching the registrations to the granted domains.
 */
export interface SyncOptions {
	/** Start the content script in the open tabs of the domains registered now (default `false`). */
	injectIntoTabs?: boolean;

	/** Register every script anew, also the ones that exist (after an update; default `false`). */
	refresh?: boolean;
}

/**
 * Makes the registered content scripts match the granted Enterprise domains: registers the
 * missing ones and unregisters the ones whose access was taken back. Safe to call at any time;
 * does nothing when they already match. Registered scripts can be lost when the extension
 * updates, hence the call after every update (with `refresh`, so a changed script is registered
 * again whether or not the old registration survived).
 *
 * @param options - See SyncOptions.
 */
export async function syncEnterpriseScripts(
	options: SyncOptions = {}
): Promise<void> {
	const granted = await listEnterpriseHosts();
	const registered = (await chrome.scripting.getRegisteredContentScripts())
		.filter((script) => script.id.startsWith(SCRIPT_ID_PREFIX))
		.map((script) => script.id.slice(SCRIPT_ID_PREFIX.length));

	const stale = options.refresh
		? registered
		: registered.filter((host) => !granted.includes(host));
	if (stale.length > 0) {
		await unregisterScripts(
			stale.map((host) => `${SCRIPT_ID_PREFIX}${host}`)
		);
	}

	const missing = options.refresh
		? granted
		: granted.filter((host) => !registered.includes(host));
	for (const host of missing) {
		// One by one: a domain that fails must not keep the others from working
		try {
			await chrome.scripting.registerContentScripts([
				{
					id: `${SCRIPT_ID_PREFIX}${host}`,
					matches: [toOriginPattern(host)],
					js: [CONTENT_SCRIPT_FILE],
					runAt: 'document_idle',
					persistAcrossSessions: true,
				},
			]);
		} catch (error) {
			console.warn(`[Hyperfriend] Could not register ${host}.`, error);
			continue;
		}

		if (options.injectIntoTabs) {
			await injectIntoOpenTabs(host);
		}
	}
}
