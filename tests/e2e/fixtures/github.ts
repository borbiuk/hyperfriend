import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BrowserContext, expect, Locator, Page } from '@playwright/test';

const PAGES_DIR = path.join(__dirname, 'pages');

/** A pull request or issue as the snapshot shows it */
export interface SnapshotItem {
	number: number;
	title: string;
	/** Login in the row's author filter link (list rows that show one); the author of a detail page */
	author?: string;
	/** `open`, `closed`, `merged` or `draft`, when the page shows it */
	state?: string;
	/** Label names, in page order, when the page shows any */
	labels?: string[];
	/** Assignee logins of a detail page, when it shows any */
	assignees?: string[];
	/** Milestone title of a detail page, when it has one */
	milestone?: string;
	/** Pull request base branch as the header shows it */
	baseBranch?: string;
	/** Pull request head branch as the header shows it */
	headBranch?: string;
	/** Discussion category */
	category?: string;
	/** Workflow run id of the URL (a run's `number` is its run number) */
	runId?: number;
	/** Workflow of a run */
	workflow?: string;
	/** Status of a run in the words of the page, e.g. `completed successfully` */
	status?: string;
	/** Branch of a run as the page shows it */
	branch?: string;
}

/** pages/index.json, written by capture-pages.mjs */
interface SnapshotIndex {
	/** Snapshot file per GitHub path + query */
	pages: Record<string, string>;
	/** Items per GitHub path + query: every row of a list page, the single item of a detail page */
	items: Record<string, SnapshotItem[]>;
	/** Path of the workflow run page snapshot: the first finished run of the run list at capture time */
	runPage: string;
	/**
	 * Path + query of the run list page whose rows hold that run: the run list, or an older page of it
	 * (rows recorded, no snapshot) when the first page had no fitting run
	 */
	runListPage: string;
}

const INDEX: SnapshotIndex = JSON.parse(
	readFileSync(path.join(PAGES_DIR, 'index.json'), 'utf8')
);

/** Repository the snapshots and the live tests use */
export const REPOSITORY = '/react/react';

/** Repository of the Discussion snapshots */
export const DISCUSSIONS_REPOSITORY = '/vercel/next.js';

/** GitHub paths (with the query for search pages) that have a snapshot, except `runListPage` (it can have rows only) */
export const PAGES = {
	discussionList: `${DISCUSSIONS_REPOSITORY}/discussions`,
	discussion: `${DISCUSSIONS_REPOSITORY}/discussions/10640`,
	runList: `${REPOSITORY}/actions`,
	/** Changes with every snapshot refresh (see `INDEX.runPage`) */
	runPage: INDEX.runPage,
	/** Rows (no snapshot when it is an older page) that hold the run of `runPage` */
	runListPage: INDEX.runListPage,
	pullList: `${REPOSITORY}/pulls`,
	pull: `${REPOSITORY}/pull/9713`,
	pullFiles: `${REPOSITORY}/pull/9713/files`,
	pullCommits: `${REPOSITORY}/pull/9713/commits`,
	issueList: `${REPOSITORY}/issues`,
	issue: `${REPOSITORY}/issues/10`,
	searchPulls:
		'/search?q=repo%3Areact%2Freact+useActionState&type=pullrequests',
	searchIssues: '/search?q=repo%3Areact%2Freact+useActionState&type=issues',
} as const;

/** Static github.com paths snapshots reference (illustrations, favicons); aborted without a report */
const STATIC_GITHUB_PATH = /^\/(images|assets|favicons?)\//;

/** Hosts whose static resources (stylesheets, images, fonts) snapshots reference; aborted without a report */
const STATIC_HOSTS = new Set([
	'github.githubassets.com',
	'user-images.githubusercontent.com',
	'private-user-images.githubusercontent.com',
	'camo.githubusercontent.com',
	'opengraph.githubassets.com',
]);

/** 1×1 transparent PNG served for every avatar request */
const AVATAR_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

export interface GitHubRouteOptions {
	/** `error` answers avatar requests with 404, to test the avatar fallback */
	avatars: 'ok' | 'error';
}

/**
 * The snapshot of a repository Pull Request list for the same list with a search text (`?q=...`):
 * the quick filters open such addresses, and the file is the same, because the content script
 * reads the filters from the address.
 *
 * @param url - Requested URL.
 * @returns The snapshot file, or `undefined` when the request is not a filtered Pull Request list.
 */
function filteredListSnapshot(url: URL): string | undefined {
	if (!url.searchParams.has('q') || !url.pathname.endsWith('/pulls')) {
		return undefined;
	}

	return INDEX.pages[url.pathname];
}

/**
 * Serves github.com (and the fake Enterprise domains) from the saved snapshots and keeps every other
 * host offline. The page URL stays real, so the content script (matches https://github.com/*, or the
 * script the background registers for a granted domain) is injected as usual.
 *
 * @param context - Browser context of the test.
 * @param options - How avatar requests are answered.
 * @param enterpriseHosts - Domains of fake GitHub Enterprise sites, served from the same snapshots.
 * @returns URLs the test requested that no snapshot or rule covers; the fixture fails the test when it is not empty.
 */
export async function routeGitHub(
	context: BrowserContext,
	options: GitHubRouteOptions,
	enterpriseHosts: string[] = []
): Promise<string[]> {
	const unplanned: string[] = [];

	await context.route('**/*', async (route) => {
		const url = new URL(route.request().url());

		// The context route also sees the extension's own files (options.js, icons)
		if (url.protocol === 'chrome-extension:' || url.protocol === 'data:') {
			await route.continue();
			return;
		}

		if (
			url.hostname === 'github.com' ||
			enterpriseHosts.includes(url.hostname)
		) {
			if (STATIC_GITHUB_PATH.test(url.pathname)) {
				await route.abort('blockedbyclient');
				return;
			}

			const file =
				INDEX.pages[url.pathname + url.search] ??
				filteredListSnapshot(url);
			if (!file) {
				unplanned.push(url.href);
				await route.fulfill({ status: 404, body: '' });
				return;
			}

			// The snapshots link to github.com; a fake Enterprise site links to itself
			await route.fulfill({
				status: 200,
				contentType: 'text/html; charset=utf-8',
				body: readFileSync(
					path.join(PAGES_DIR, file),
					'utf8'
				).replaceAll('https://github.com/', `https://${url.hostname}/`),
			});
			return;
		}

		if (url.hostname === 'avatars.githubusercontent.com') {
			if (options.avatars === 'error') {
				await route.fulfill({ status: 404, body: '' });
				return;
			}

			await route.fulfill({
				status: 200,
				contentType: 'image/png',
				body: AVATAR_PNG,
			});
			return;
		}

		// No network in e2e: known static resources are dropped quietly, anything else is reported
		if (!STATIC_HOSTS.has(url.hostname)) {
			unplanned.push(url.href);
		}
		await route.abort('blockedbyclient');
	});

	return unplanned;
}

/**
 * Returns the URL of a snapshot page.
 *
 * @param pagePath - One of PAGES.
 */
export function snapshotUrl(pagePath: string): string {
	if (!INDEX.pages[pagePath]) {
		throw new Error(
			`No snapshot for ${pagePath}; add it to capture-pages.mjs`
		);
	}

	return `https://github.com${pagePath}`;
}

/**
 * Items the snapshot shows (taken from the fixture data, not from the page under test).
 *
 * @param pagePath - One of PAGES.
 */
export function snapshotItems(pagePath: string): SnapshotItem[] {
	const items = INDEX.items[pagePath];
	if (!items?.length) {
		throw new Error(
			`No items recorded for ${pagePath}; recapture the snapshots`
		);
	}

	return items;
}

/**
 * The list row (listitem) holding the title link with this exact text.
 *
 * @param page - Page with a pull request or issue list.
 * @param title - Title of the item.
 */
export function rowOf(page: Page, title: string): Locator {
	return page
		.getByRole('listitem')
		.filter({ has: page.getByRole('link', { name: title, exact: true }) });
}

/**
 * The title button of a pull request or issue page, by its accessible name.
 *
 * @param page - Detail page.
 * @param name - Accessible name, e.g. `Copy link to issue #10`.
 */
export function titleButton(page: Page, name: string): Locator {
	return page.getByRole('button', { name, exact: true });
}

/**
 * The element right before the title button: the `#number` in the header.
 *
 * @param page - Detail page.
 * @param name - Accessible name of the title button.
 */
export function elementBeforeTitleButton(page: Page, name: string): Locator {
	return page.locator(`:has(+ [aria-label="${name}"])`);
}

/**
 * The saved HTML of a snapshot page, for a test that serves a modified copy with `page.route`.
 *
 * @param pagePath - One of PAGES.
 */
export function snapshotHtml(pagePath: string): string {
	const file = INDEX.pages[pagePath];
	if (!file) {
		throw new Error(
			`No snapshot for ${pagePath}; add it to capture-pages.mjs`
		);
	}

	return readFileSync(path.join(PAGES_DIR, file), 'utf8');
}

/**
 * The first item whose title has no HTML special characters, so a spec can write the expected
 * payload as plain text. The lists change with every snapshot refresh, so the item is picked from
 * the data instead of being fixed.
 *
 * @param pagePath - One of PAGES (a list or search page).
 */
export function firstPlainItem(pagePath: string): SnapshotItem {
	const item = snapshotItems(pagePath).find(
		({ title }) => !/[&<>"']/.test(title)
	);
	if (!item) {
		throw new Error(
			`Every item of ${pagePath} has HTML special characters in its title`
		);
	}

	return item;
}

/** Well under the hydration guard's fallback (MAX_WAIT_MS, 10 s), so only the class change can inject */
export const HYDRATED_RESCAN_TIMEOUT_MS = 2000;

/**
 * Serves a snapshot page as it is before React hydrates it: GitHub marks a hydrated root with
 * class "loaded", so the class is removed from the repository's React root.
 *
 * @param page - Page of the test; call before `goto`.
 * @param pagePath - One of PAGES with a `react-app` root.
 */
export async function serveUnhydrated(
	page: Page,
	pagePath: string
): Promise<void> {
	const original = snapshotHtml(pagePath);
	const html = original.replace(
		/(<react-app app-name="repo"[^>]*) class="loaded"/,
		'$1'
	);
	expect(html, 'precondition: the repo root is not loaded').not.toBe(
		original
	);
	await page.route(snapshotUrl(pagePath), (route) =>
		route.fulfill({ contentType: 'text/html; charset=utf-8', body: html })
	);
}

/**
 * Marks the repository's React root as hydrated, as GitHub does after React rendered it.
 *
 * @param page - Page served with serveUnhydrated.
 */
export async function markHydrated(page: Page): Promise<void> {
	await page
		.locator('react-app[app-name="repo"]')
		.evaluate((root) => root.classList.add('loaded'));
}
