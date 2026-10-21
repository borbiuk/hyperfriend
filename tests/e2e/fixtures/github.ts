import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BrowserContext, Locator, Page } from '@playwright/test';

const PAGES_DIR = path.join(__dirname, 'pages');

/** A pull request or issue as the snapshot shows it */
export interface SnapshotItem {
	number: number;
	title: string;
	/** Login in the row's author filter link (list rows that show one) */
	author?: string;
}

/**
 * Known product gap: GitHub's new pull request layout (Conversation and Commits tabs) gets no title
 * button. Tests marked with it use `test.fail()` and fail on purpose until the issue is fixed.
 */
export const NEW_PULL_REQUEST_LAYOUT_GAP = {
	type: 'issue',
	description: 'https://github.com/borbiuk/hyperfriend/issues/4',
};

/** pages/index.json, written by capture-pages.mjs */
interface SnapshotIndex {
	/** Snapshot file per GitHub path + query */
	pages: Record<string, string>;
	/** Items per GitHub path + query: every row of a list page, the single item of a detail page */
	items: Record<string, SnapshotItem[]>;
}

const INDEX: SnapshotIndex = JSON.parse(
	readFileSync(path.join(PAGES_DIR, 'index.json'), 'utf8')
);

/** Repository the snapshots and the live tests use */
export const REPOSITORY = '/react/react';

/** GitHub paths (with the query for search pages) that have a snapshot */
export const PAGES = {
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
 * Serves github.com from the saved snapshots and keeps every other host offline.
 * The page URL stays real, so the content script (matches https://github.com/*) is injected as usual.
 *
 * @param context - Browser context of the test.
 * @param options - How avatar requests are answered.
 * @returns URLs the test requested that no snapshot or rule covers; the fixture fails the test when it is not empty.
 */
export async function routeGitHub(
	context: BrowserContext,
	options: GitHubRouteOptions
): Promise<string[]> {
	const unplanned: string[] = [];

	await context.route('**/*', async (route) => {
		const url = new URL(route.request().url());

		// The context route also sees the extension's own files (options.js, icons)
		if (url.protocol === 'chrome-extension:' || url.protocol === 'data:') {
			await route.continue();
			return;
		}

		if (url.hostname === 'github.com') {
			if (STATIC_GITHUB_PATH.test(url.pathname)) {
				await route.abort('blockedbyclient');
				return;
			}

			const file = INDEX.pages[url.pathname + url.search];
			if (!file) {
				unplanned.push(url.href);
				await route.fulfill({ status: 404, body: '' });
				return;
			}

			await route.fulfill({
				status: 200,
				contentType: 'text/html; charset=utf-8',
				body: readFileSync(path.join(PAGES_DIR, file), 'utf8'),
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
