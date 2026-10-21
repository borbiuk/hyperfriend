/*
	Captures the GitHub page snapshots the e2e tests run against (tests/e2e/fixtures/pages/).

	It opens public react/react pages signed out in Playwright's Chromium, waits until GitHub has
	rendered them, and saves the DOM without anything that is not needed or must not be committed:
	scripts and embedded JSON, comment and description bodies (also in attributes and meta tags),
	tokens, nonces, signed channels, analytics attributes and email addresses. A final scan fails the
	run if any of that is still present. Pages are written to a temporary folder and swapped in only
	when every page succeeded.

	pages/index.json maps each GitHub path to its file and lists the items (number and title) the page
	shows, so tests take expected values from the fixture data instead of the page under test.

	Usage: npm run test:snapshots   (needs network access; review the diff before committing)
*/

import {
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(FIXTURES_DIR, 'pages');

const LIST_LINKS =
	'a[data-testid="listitem-title-link"], a[data-testid="issue-listitem-title-link"], a[data-testid="issue-pr-title-link"], a[id^="issue_"][id$="_link"], [data-testid="results-list"] .search-title a[href]';

/**
 * Pages to capture: file name (without .html), URL, and the kind of page.
 * `list` pages record every title link; `detail` pages record the item in the URL.
 */
const PAGES = [
	{
		file: 'pull-list',
		url: 'https://github.com/react/react/pulls',
		kind: 'list',
	},
	{
		file: 'pull',
		url: 'https://github.com/react/react/pull/9713',
		kind: 'detail',
	},
	{
		file: 'pull-files',
		url: 'https://github.com/react/react/pull/9713/files',
		kind: 'detail',
	},
	{
		file: 'pull-commits',
		url: 'https://github.com/react/react/pull/9713/commits',
		kind: 'detail',
	},
	{
		file: 'issue-list',
		url: 'https://github.com/react/react/issues',
		kind: 'list',
	},
	{
		file: 'issue',
		url: 'https://github.com/react/react/issues/10',
		kind: 'detail',
	},
	{
		file: 'search-pulls',
		url: 'https://github.com/search?q=repo%3Areact%2Freact+useActionState&type=pullrequests',
		kind: 'list',
	},
	{
		file: 'search-issues',
		url: 'https://github.com/search?q=repo%3Areact%2Freact+useActionState&type=issues',
		kind: 'list',
	},
];

/** Content that must never reach a committed snapshot */
const FORBIDDEN = [
	/<script\b/i,
	/name="(csrf-token|fetch-nonce|html-safe-nonce|description|twitter:description)"/,
	/property="og:description"/,
	/\snonce="/,
	/data-nonce=/,
	/data-channel=/,
	/authenticity_token/,
	/<clipboard-copy\b[^>]*\svalue="[^"]+"/,
	/[\w.%+-]+@(?!example\.com)[\w-]+(\.[\w-]+)+/,
];

/** Runs in the page: removes everything the tests don't need or that must not be committed. */
function sanitize() {
	const remove = (selector) => {
		document.querySelectorAll(selector).forEach((el) => el.remove());
	};
	remove('script, noscript, iframe, template[data-target*="embedded"]');
	remove(
		'link[rel="preload"], link[rel="modulepreload"], link[rel="prefetch"], link[rel="dns-prefetch"], link[rel="preconnect"], link[rel="manifest"]'
	);
	remove(
		[
			'meta[name="csrf-token"]',
			'meta[name="fetch-nonce"]',
			'meta[name="html-safe-nonce"]',
			'meta[name^="octolytics"]',
			'meta[name^="analytics"]',
			'meta[name="request-id"]',
			'meta[name="visitor-payload"]',
			'meta[name="visitor-hmac"]',
			'meta[name="hovercard-subject-tag"]',
			'meta[name="google-site-verification"]',
			// Per-request server details that change on every load
			'meta[name^="voltron"]',
			'meta[name="ui-target"]',
			// Description meta tags repeat the pull request / issue body
			'meta[name="description"]',
			'meta[name="twitter:description"]',
			'meta[property="og:description"]',
		].join(', ')
	);
	remove(
		'input[name="authenticity_token"], input[name="timestamp"], input[name="timestamp_secret"], input[name="partial_last_updated"]'
	);
	// Comment, review and description bodies belong to their authors and are not used by the tests
	document
		.querySelectorAll(
			'.comment-body, .markdown-body, [data-testid="markdown-body"]'
		)
		.forEach((el) => {
			el.replaceChildren();
		});
	// "Copy Markdown" menu items carry the whole comment in their value
	document.querySelectorAll('clipboard-copy[value]').forEach((el) => {
		el.setAttribute('value', '');
	});
	const dropped =
		/^(nonce|integrity|data-nonce|data-channel|data-hydro-.*|data-hmac|data-csrf|data-.*-hmac|data-.*-token)$/;
	// No email addresses in committed fixtures, not even public ones
	const email = /[\w.%+-]+@[\w-]+(\.[\w-]+)+/g;
	const noEmail = (text) => text.replace(email, 'email@example.com');
	document.querySelectorAll('*').forEach((el) => {
		for (const { name, value } of [...el.attributes]) {
			if (dropped.test(name)) {
				el.removeAttribute(name);
			} else if (noEmail(value) !== value) {
				el.setAttribute(name, noEmail(value));
			}
		}
	});
	const walker = document.createTreeWalker(
		document.body,
		NodeFilter.SHOW_TEXT
	);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		node.textContent = noEmail(node.textContent);
	}
	// GitHub generates random ids (UUIDs, label-xxxxxx) for elements and the for / aria-* attributes
	// that point to them on every render; number them in document order so unchanged pages give
	// unchanged files
	const uuid =
		/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\blabel-[0-9a-f]{6}\b/g;
	const stableIds = new Map();
	const stable = (text) =>
		text.replace(uuid, (match) => {
			if (!stableIds.has(match)) {
				stableIds.set(match, `id-${stableIds.size + 1}`);
			}
			return stableIds.get(match);
		});
	document.querySelectorAll('*').forEach((el) => {
		for (const { name, value } of [...el.attributes]) {
			if (stable(value) !== value) {
				el.setAttribute(name, stable(value));
			}
		}
	});
}

/**
 * Waits until the page stops changing (React finishes rendering lists, counters and hovercards),
 * so two captures of an unchanged page give the same file.
 *
 * @param {import('@playwright/test').Page} page - Page being captured.
 */
async function waitForStableDom(page) {
	let previous = '';
	for (let attempt = 0; attempt < 30; attempt++) {
		const current = await page.evaluate(
			() => document.documentElement.outerHTML
		);
		if (current === previous) {
			return;
		}
		previous = current;
		await page.waitForTimeout(500);
	}
	throw new Error(`${page.url()} kept changing for 15 s`);
}

/** Runs in the page: number, title and (where the row shows one) author login of every list item, in page order. */
function readListItems(selector) {
	return [...document.querySelectorAll(selector)].map((link) => {
		const author = link
			.closest('li, [role="listitem"]')
			?.querySelector('[data-testid="author-filter-link"]')
			// Issue lists render it as a button labelled "Filter by author <login>"
			?.textContent.trim()
			.replace(/^Filter by author /, '');
		return {
			number: Number(new URL(link.href).pathname.split('/').pop()),
			title: link.textContent.trim(),
			...(author ? { author } : {}),
		};
	});
}

const browser = await chromium.launch();
const context = await browser.newContext({
	colorScheme: 'light',
	locale: 'en-US',
	timezoneId: 'UTC',
});
const page = await context.newPage();
const tmpDir = mkdtempSync(join(FIXTURES_DIR, '.pages-'));
const index = { pages: {}, items: {} };

try {
	for (const { file, url, kind } of PAGES) {
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		const { pathname, search } = new URL(url);
		// Search pages are told apart by their query; other pages have none
		const key = pathname + search;

		if (kind === 'list') {
			await page
				.locator(LIST_LINKS)
				.first()
				.waitFor({ state: 'attached' });
			index.items[key] = await page.evaluate(readListItems, LIST_LINKS);
		} else {
			await page
				.locator('main h1')
				.first()
				.waitFor({ state: 'attached' });
			const number = Number(pathname.split('/')[4]);
			// The page title is "<title> by <author> · Pull Request #<n> · …" / "<title> · Issue #<n> · …"
			const title = (await page.title()).split(
				/ (?:by \S+ )?· (?:Pull Request|Issue) #/
			)[0];
			index.items[key] = [{ number, title }];
		}

		await waitForStableDom(page);
		await page.evaluate(sanitize);
		const html = `<!DOCTYPE html>\n${await page.evaluate(() => document.documentElement.outerHTML)}\n`;
		const leak = FORBIDDEN.find((pattern) => pattern.test(html));
		if (leak) {
			throw new Error(
				`${file}.html still matches ${leak}; extend sanitize()`
			);
		}

		writeFileSync(join(tmpDir, `${file}.html`), html);
		index.pages[key] = `${file}.html`;
		console.log(
			`${file}.html  ${Math.round(html.length / 1024)} KB  ${url}`
		);
	}

	writeFileSync(
		join(tmpDir, 'index.json'),
		`${JSON.stringify(index, null, '\t')}\n`
	);
	rmSync(PAGES_DIR, { recursive: true, force: true });
	renameSync(tmpDir, PAGES_DIR);
} finally {
	await browser.close();
	rmSync(tmpDir, { recursive: true, force: true });
}

// Sanity check of the swapped folder
JSON.parse(readFileSync(join(PAGES_DIR, 'index.json'), 'utf8'));
