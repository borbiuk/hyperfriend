/*
	Captures the GitHub page snapshots the e2e tests run against (tests/e2e/fixtures/pages/).

	It opens public react/react pages signed out in Playwright's Chromium, waits until GitHub has
	rendered them, and saves the DOM without anything that is not needed or must not be committed:
	scripts and embedded JSON, comment and description bodies (also in attributes and meta tags),
	tokens, nonces, signed channels, analytics attributes and email addresses. A final scan fails the
	run if any of that is still present. Pages are written to a temporary folder and swapped in only
	when every page succeeded.

	pages/index.json maps each GitHub path to its file and lists the items (number and title) the page
	shows, so tests take expected values from the fixture data instead of the page under test. An older
	run list page that holds the captured run (see the `run` page) has its items but no file.

	Usage: npm run test:snapshots   (needs network access; review the diff before committing)
	       node tests/e2e/fixtures/capture-pages.mjs discussion-list discussion   (only these pages, the others stay as they are)
*/

import {
	cpSync,
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
 * `requireState` fails the run when no row of the list shows a state (the markup changed).
 * `discussion-list`, `discussion`, `run-list` and `run` pages have their own readers; the `run` page has
 * no fixed URL (see PAGES).
 */
const PAGES = [
	{
		file: 'pull-list',
		url: 'https://github.com/react/react/pulls',
		kind: 'list',
		requireState: true,
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
		requireState: true,
	},
	{
		file: 'issue',
		url: 'https://github.com/react/react/issues/10',
		kind: 'detail',
	},
	{
		file: 'discussion-list',
		url: 'https://github.com/vercel/next.js/discussions',
		kind: 'discussion-list',
	},
	{
		// The pinned (spotlight) discussion of that repository: stable, and also shown in the list above
		file: 'discussion',
		url: 'https://github.com/vercel/next.js/discussions/10640',
		kind: 'discussion',
	},
	{
		file: 'run-list',
		url: 'https://github.com/react/react/actions',
		kind: 'run-list',
	},
	{
		// Runs are deleted after a while, so the page is that of the first finished, named run of the list above
		// (or of its next pages)
		file: 'run',
		kind: 'run',
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
	// Every element of the page, also those inside <template> contents (menus, dialogs)
	const allElements = (root = document) =>
		[...root.querySelectorAll('*')].flatMap((el) =>
			el.tagName === 'TEMPLATE' ? [el, ...allElements(el.content)] : [el]
		);
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
	allElements().forEach((el) => {
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
	allElements().forEach((el) => {
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

/**
 * Runs in the page: number, title and, where the row shows them, author login, state and label
 * names of every list item, in page order.
 */
function readListItems(selector) {
	const toState = (text) => {
		const lower = (text ?? '').toLowerCase();
		return ['draft', 'merged', 'closed', 'open'].find((word) =>
			lower.includes(word)
		);
	};

	return [...document.querySelectorAll(selector)].map((link) => {
		const row = link.closest('li, [role="listitem"]');
		const author = row
			?.querySelector('[data-testid="author-filter-link"]')
			// Issue lists render it as a button labelled "Filter by author <login>"
			?.textContent.trim()
			.replace(/^Filter by author /, '');
		const state = [...(row?.querySelectorAll('svg[aria-label]') ?? [])]
			.map((icon) => toState(icon.getAttribute('aria-label')))
			.find(Boolean);
		const labels = [
			...(row?.querySelectorAll(
				'button[aria-label^="Filter by label "]'
			) ?? []),
		].map((button) =>
			button.getAttribute('aria-label').replace('Filter by label ', '')
		);
		return {
			number: Number(new URL(link.href).pathname.split('/').pop()),
			title: link.textContent.trim(),
			...(author ? { author } : {}),
			...(state ? { state } : {}),
			...(labels.length > 0 ? { labels } : {}),
		};
	});
}

/**
 * Runs in the page: author, state, label names, assignee logins, milestone and (pull requests)
 * base and head branch of a detail page; fields the page does not show are left out.
 */
function readDetailMetadata() {
	const toState = (text) => {
		const lower = (text ?? '').toLowerCase();
		return ['draft', 'merged', 'closed', 'open'].find((word) =>
			lower.includes(word)
		);
	};
	const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
	const author =
		document
			.querySelector('meta[property="og:author:username"]')
			?.getAttribute('content') ??
		text(document.querySelector('.gh-header-meta a.author'));
	const state =
		toState(
			document
				.querySelector('[data-component="StateLabel"][data-status]')
				?.getAttribute('data-status')
		) ??
		toState(document.querySelector('.State[title^="Status: "]')?.title);
	const labels = [
		...new Set(
			[
				...document.querySelectorAll(
					'.js-issue-labels a[data-name], [data-testid="issue-labels"] a'
				),
			]
				.map((label) => label.dataset.name ?? text(label))
				.filter(Boolean)
		),
	];
	const assignees = [
		...new Set(
			[
				...document.querySelectorAll(
					'[data-channel-event-name="assignees_updated"] [data-assignee-name]'
				),
			].map((el) => el.dataset.assigneeName)
		),
	];
	const milestone = text(
		document.querySelector(
			'[data-channel-event-name="milestone_updated"] a[href*="/milestone/"], [data-testid="sidebar-milestones-section"] a[href*="/milestone/"]'
		)
	);
	const branches = [
		...document.querySelectorAll('[data-component="BranchName"]'),
	];
	const [base, head] = (
		branches.length >= 2
			? branches
			: [...document.querySelectorAll('.gh-header-meta .commit-ref')]
	).map(text);

	return {
		...(author ? { author } : {}),
		...(state ? { state } : {}),
		...(labels.length > 0 ? { labels } : {}),
		...(assignees.length > 0 ? { assignees } : {}),
		...(milestone ? { milestone } : {}),
		...(base ? { baseBranch: base } : {}),
		...(head ? { headBranch: head } : {}),
	};
}

/** Runs in the page: number, title, author and category of every Discussion row (and of the pinned one), in page order. */
function readDiscussionItems() {
	const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
	return [
		...document.querySelectorAll(
			'a.markdown-title[href*="/discussions/"], a.discussion-title'
		),
	].map((link) => {
		const row = link.closest('li');
		const author = text(row?.querySelector('a[aria-label$=" (author)"]'));
		const category = text(
			row?.querySelector('a[aria-label$=" (category)"]')
		);
		return {
			number: Number(new URL(link.href).pathname.split('/').pop()),
			title: text(link),
			...(author ? { author } : {}),
			...(category ? { category } : {}),
		};
	});
}

/** Runs in the page: author and category of a Discussion page, from the line under the title. */
function readDiscussionMetadata() {
	const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
	const author = text(
		document.querySelector(
			'.gh-header-title ~ * a[data-hovercard-type="user"]'
		)
	);
	const category = text(
		document.querySelector(
			'.gh-header-title ~ * a[href*="/discussions/categories/"]'
		)
	);
	return {
		...(author ? { author } : {}),
		...(category ? { category } : {}),
	};
}

/**
 * Runs in the page: run number, run id, run name, workflow, status and branch of every workflow
 * run row, in page order. The number, the workflow and the status come from the visible texts of
 * the row (`#20481:`, the bold workflow name, the screen reader text).
 */
function readRunItems() {
	const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
	return [
		...document.querySelectorAll(
			'[data-listview-item-title-container] a[href*="/actions/runs/"]'
		),
	].map((link) => {
		const row = link.closest('li');
		const number = [...(row?.querySelectorAll('span') ?? [])]
			.map((span) => /^#(\d+):$/.exec(text(span)))
			.find(Boolean)?.[1];
		const workflow = text(row?.querySelector('strong'));
		const status = text(row?.querySelector('.sr-only'))?.replace(/:$/, '');
		const branch = text(
			row?.querySelector('[data-component="BranchName"]')
		);
		return {
			number: Number(number),
			runId: Number(new URL(link.href).pathname.split('/').pop()),
			title: text(link),
			...(workflow ? { workflow } : {}),
			...(status ? { status } : {}),
			...(branch ? { branch } : {}),
		};
	});
}

/** Runs in the page: run number, workflow, status and branch from the header of a workflow run page. */
function readRunMetadata() {
	const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
	const heading = document.querySelector('h1.PageHeader-title');
	const number = text(heading?.querySelector('.color-fg-muted'))?.replace(
		'#',
		''
	);
	const workflow = text(
		document.querySelector('.PageHeader-parentLink-label')
	);
	const status = document
		.querySelector('.actions-workflow-runs-status svg[aria-label]')
		?.getAttribute('aria-label')
		.replace(/:\s*$/, '');
	const branch = text(document.querySelector('a.branch-name'));
	return {
		number: Number(number),
		title: text(heading?.querySelector('.markdown-title')),
		...(workflow ? { workflow } : {}),
		...(status ? { status } : {}),
		...(branch ? { branch } : {}),
	};
}

const browser = await chromium.launch();
const context = await browser.newContext({
	colorScheme: 'light',
	locale: 'en-US',
	timezoneId: 'UTC',
});
const page = await context.newPage();
const tmpDir = mkdtempSync(join(FIXTURES_DIR, '.pages-'));
// Pages named on the command line are captured on top of the existing folder, the others stay as they are
const only = process.argv.slice(2);
const index = { pages: {}, items: {} };
if (only.length > 0) {
	cpSync(PAGES_DIR, tmpDir, { recursive: true });
	Object.assign(
		index,
		JSON.parse(readFileSync(join(PAGES_DIR, 'index.json'), 'utf8'))
	);
}

try {
	for (const { file, url: fixedUrl, kind, requireState } of PAGES) {
		if (only.length > 0 && !only.includes(file)) {
			continue;
		}

		let url = fixedUrl;
		if (kind === 'run') {
			// The first finished run of the run list (captured before this page) whose name differs from
			// its workflow (a scheduled run is named after its workflow, which would hide a mix-up
			// of the two) and that ran on a branch
			const isCandidate = (item) =>
				/^(completed|failed|cancel)/i.test(item.status ?? '') &&
				item.title !== item.workflow &&
				item.branch;
			// Rows of older list pages from an earlier capture are not kept
			for (const key of Object.keys(index.items)) {
				if (key.startsWith('/react/react/actions?page=')) {
					delete index.items[key];
				}
			}
			let listKey = '/react/react/actions';
			let finished = index.items[listKey]?.find(isCandidate);
			// The first page can hold no such run (for example, only fork pull request runs that wait
			// for approval), so older pages of the list are read too. Their HTML is not saved, but the
			// rows of the page with the run are, so tests can check the run against its list row
			for (let listPage = 2; !finished && listPage <= 5; listPage++) {
				listKey = `/react/react/actions?page=${listPage}`;
				await page.goto(`https://github.com${listKey}`, {
					waitUntil: 'domcontentloaded',
				});
				await page
					.locator(
						'[data-listview-item-title-container] a[href*="/actions/runs/"]'
					)
					.first()
					.waitFor({ state: 'attached' });
				await waitForStableDom(page);
				const items = await page.evaluate(readRunItems);
				finished = items.find(isCandidate);
				if (finished) {
					index.items[listKey] = items;
				}
			}
			if (!finished) {
				throw new Error(
					'run: no finished run with its own name in the run list'
				);
			}
			index.runListPage = listKey;
			url = `https://github.com/react/react/actions/runs/${finished.runId}`;
			index.runPage = new URL(url).pathname;
		}

		await page.goto(url, { waitUntil: 'domcontentloaded' });
		const { pathname, search } = new URL(url);
		// Search pages are told apart by their query; other pages have none
		const key = pathname + search;

		if (kind === 'discussion-list') {
			await page
				.locator('a.markdown-title[href*="/discussions/"]')
				.first()
				.waitFor({ state: 'attached' });
			await waitForStableDom(page);
			index.items[key] = await page.evaluate(readDiscussionItems);
		} else if (kind === 'discussion') {
			await page
				.locator('.gh-header-title')
				.first()
				.waitFor({ state: 'attached' });
			await waitForStableDom(page);
			// "<title> · owner/repo · Discussion #<n> · GitHub"
			const title = (await page.title()).split(
				/ · [^\s·]+ · Discussion #/
			)[0];
			index.items[key] = [
				{
					number: Number(pathname.split('/')[4]),
					title,
					...(await page.evaluate(readDiscussionMetadata)),
				},
			];
		} else if (kind === 'run-list') {
			await page
				.locator(
					'[data-listview-item-title-container] a[href*="/actions/runs/"]'
				)
				.first()
				.waitFor({ state: 'attached' });
			await waitForStableDom(page);
			index.items[key] = await page.evaluate(readRunItems);
		} else if (kind === 'run') {
			await page
				.locator('h1.PageHeader-title')
				.first()
				.waitFor({ state: 'attached' });
			await waitForStableDom(page);
			index.items[key] = [
				{
					runId: Number(pathname.split('/').pop()),
					...(await page.evaluate(readRunMetadata)),
				},
			];
		} else if (kind === 'list') {
			await page
				.locator(LIST_LINKS)
				.first()
				.waitFor({ state: 'attached' });
			await waitForStableDom(page);
			index.items[key] = await page.evaluate(readListItems, LIST_LINKS);
			// A repository list shows the state of its rows: none recorded means the markup changed
			if (requireState && !index.items[key].some((item) => item.state)) {
				throw new Error(
					`${file}: no row shows a state; update readListItems`
				);
			}
		} else {
			await page
				.locator('main h1')
				.first()
				.waitFor({ state: 'attached' });
			await waitForStableDom(page);
			const number = Number(pathname.split('/')[4]);
			// The page title is "<title> by <author> · Pull Request #<n> · …" / "<title> · Issue #<n> · …"
			const title = (await page.title()).split(
				/ (?:by \S+ )?· (?:Pull Request|Issue) #/
			)[0];
			index.items[key] = [
				{ number, title, ...(await page.evaluate(readDetailMetadata)) },
			];
		}

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
