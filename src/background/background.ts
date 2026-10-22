import {
	SyncOptions,
	syncEnterpriseScripts,
} from '@shared/services/enterprise-service';

/**
 * Background script (a service worker in Chrome, an event page in Firefox). Its only job is to
 * keep the content scripts of the GitHub Enterprise domains the user granted registered:
 * registrations can be lost when the extension updates, and a permission can be granted or
 * taken back while the popup is closed (the permission prompt can close it).
 */

/** Reconciliations run one after another, so two events never register the same script twice. */
let queue: Promise<void> = Promise.resolve();

const sync = (options: SyncOptions): void => {
	queue = queue
		.then(() => syncEnterpriseScripts(options))
		.catch((error: unknown) => {
			console.warn(
				'[Hyperfriend] Could not update the Enterprise scripts.',
				error
			);
		});
};

// Listeners are added at the top level, so the browser can wake the script for these events
chrome.runtime.onInstalled.addListener((details) => {
	// An update registers the scripts anew; open tabs keep the old script until reloaded, as on github.com
	sync({ refresh: details.reason === 'update' });
});
chrome.runtime.onStartup.addListener(() => sync({}));
// A domain granted now: tabs of it that are open were loaded without the script
chrome.permissions.onAdded.addListener(() => sync({ injectIntoTabs: true }));
chrome.permissions.onRemoved.addListener(() => sync({}));
