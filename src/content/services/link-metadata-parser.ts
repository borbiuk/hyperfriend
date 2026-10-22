import { LinkTargetModel, LinkType } from '@shared/models';

/**
 * Optional details of a Pull Request or Issue (author, state, labels, ...) read from the page.
 * Every field is left out when the page does not show it.
 */
export type LinkMetadata = Pick<
	LinkTargetModel,
	| 'author'
	| 'state'
	| 'labels'
	| 'assignees'
	| 'milestone'
	| 'headBranch'
	| 'baseBranch'
>;

/** A GitHub login, including app bots such as `dependabot[bot]` */
const LOGIN_REGEX = /^[\w-]+(?:\[bot\])?$/;

/** Author filter link or button of a list row */
const ROW_AUTHOR_SELECTOR = '[data-testid="author-filter-link"]';

/** `author:login` in the filter query of an author link */
const AUTHOR_QUERY_REGEX = /(?:^|\s)author:(\S+)/;

/** `Filter by author <login>` (aria-label of the author link of a Pull Request row) */
const AUTHOR_LABEL_REGEX = /^Filter by author (.+)$/;

/** `/users/<login>/hovercard` (hovercard URL of an author button) */
const HOVERCARD_LOGIN_REGEX = /^\/users\/([^/]+)\/hovercard$/;

/** `Filter by label <name>` (aria-label of a label button of a list row) */
const LABEL_BUTTON_SELECTOR = 'button[aria-label^="Filter by label "]';
const LABEL_BUTTON_PREFIX = 'Filter by label ';

/** State icons of list rows: `Open`, `Open pull request`, `Draft pull request`, `Closed`, `Merged pull request` */
const ROW_STATE_ICON_SELECTOR = 'svg[data-component="Octicon"][aria-label]';

/** Row of a list: the element holding the title link */
const ROW_SELECTOR = 'li, [role="listitem"]';

/** State words in the order they are checked; the word the text starts with wins */
const STATE_WORDS = ['draft', 'merged', 'closed', 'open'] as const;

/** Labels of the detail page, classic and React */
const DETAIL_LABEL_SELECTOR = [
	'.js-issue-labels a[data-name]',
	'[data-testid="issue-labels"] a',
].join(', ');

/** Assignees of the detail page: classic sidebar and React sidebar */
const CLASSIC_ASSIGNEE_SELECTOR =
	'[data-channel-event-name="assignees_updated"] [data-assignee-name]';
const REACT_ASSIGNEE_LINK_SELECTOR =
	'[data-testid="sidebar-assignees-section"] a[href]';

/** `/login`: the path of a profile link */
const PROFILE_PATH_REGEX = /^\/([^/]+)\/?$/;

/** Milestone link of the detail page (classic and React sidebar) */
const MILESTONE_LINK_SELECTOR = [
	'[data-channel-event-name="milestone_updated"] a[href*="/milestone/"]',
	'[data-testid="sidebar-milestones-section"] a[href*="/milestone/"]',
].join(', ');

/** State label of the detail page (`data-status="issueOpened"`, `pullMerged`, `draft`, ...) */
const DETAIL_STATE_SELECTOR = '[data-component="StateLabel"][data-status]';

/** Classic state badge: `title="Status: Open"` */
const CLASSIC_STATE_SELECTOR = '.State[title^="Status: "]';

/** Branch names of the Pull Request header, base first, then head: React header and classic header */
const BRANCH_NAME_SELECTOR = '[data-component="BranchName"]';
const CLASSIC_BRANCH_SELECTOR = '.gh-header-meta .commit-ref';

/** `<meta property="og:url">`, used to make sure the author belongs to the item of the URL */
const OG_URL_SELECTOR = 'meta[property="og:url"]';
const OG_AUTHOR_SELECTOR = 'meta[property="og:author:username"]';

/** Author link of the classic Pull Request header */
const CLASSIC_AUTHOR_SELECTOR = '.gh-header-meta a.author';

/**
 * Collapses whitespace (including non-breaking spaces) and trims.
 * Same as `normalizeText` in link-target-parser.ts, which imports this file (no import cycle).
 */
function normalizeText(value: string | null | undefined): string {
	return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Maps a state text (`Open pull request`, `issueClosed`, `Status: Closed`) to
 * `open`, `closed`, `merged` or `draft`.
 */
function toState(text: string | null | undefined): string | undefined {
	const lower = (text ?? '')
		.toLowerCase()
		.replace(/^status:\s*/, '')
		.replace(/^(?:issue|pull)(?=[a-z])/, '');

	return STATE_WORDS.find((word) => lower.startsWith(word));
}

/**
 * Returns the unique, non-empty values in order.
 */
function unique(values: Array<string | null | undefined>): string[] {
	return Array.from(
		new Set(
			values
				.map((value) => normalizeText(value))
				.filter((value) => value !== '')
		)
	);
}

/**
 * Drops empty fields so the result only holds what the page showed.
 */
function compact(metadata: LinkMetadata): LinkMetadata {
	const result: LinkMetadata = {};

	if (metadata.author) {
		result.author = metadata.author;
	}
	if (metadata.state) {
		result.state = metadata.state;
	}
	if (metadata.labels?.length) {
		result.labels = metadata.labels;
	}
	if (metadata.assignees?.length) {
		result.assignees = metadata.assignees;
	}
	if (metadata.milestone) {
		result.milestone = metadata.milestone;
	}
	if (metadata.headBranch) {
		result.headBranch = metadata.headBranch;
	}
	if (metadata.baseBranch) {
		result.baseBranch = metadata.baseBranch;
	}

	return result;
}

/**
 * Reads the author login of a list row from its author link or button: the `author:` filter
 * of the link, the aria-label or the hovercard URL (the visible text can be a display name).
 */
function getRowAuthor(row: Element): string | undefined {
	const element = row.querySelector(ROW_AUTHOR_SELECTOR);
	if (!element) {
		return undefined;
	}

	let query: string | null = null;
	try {
		query = new URL(
			element.getAttribute('href') ?? '',
			window.location.href
		).searchParams.get('q');
	} catch {
		// Malformed href: use the other sources
	}

	const candidates = [
		AUTHOR_QUERY_REGEX.exec(query ?? '')?.[1],
		AUTHOR_LABEL_REGEX.exec(element.getAttribute('aria-label') ?? '')?.[1],
		HOVERCARD_LOGIN_REGEX.exec(
			element.getAttribute('data-hovercard-url') ?? ''
		)?.[1],
	];

	return candidates.find(
		(login): login is string => !!login && LOGIN_REGEX.test(login)
	);
}

/**
 * Reads the state of a list row from its state icon.
 */
function getRowState(row: Element): string | undefined {
	for (const icon of row.querySelectorAll(ROW_STATE_ICON_SELECTOR)) {
		const state = toState(icon.getAttribute('aria-label'));
		if (state) {
			return state;
		}
	}

	return undefined;
}

/**
 * Reads what a list row shows next to the title: author, state and labels.
 * Assignees, milestone and branches are not part of a row.
 *
 * @param anchor - Title link of the row.
 * @returns The details found; empty when the row can not be located.
 */
export function readListMetadata(anchor: Element): LinkMetadata {
	const row = anchor.closest(ROW_SELECTOR);
	if (!row) {
		return {};
	}

	const labels = unique([
		...Array.from(row.querySelectorAll(LABEL_BUTTON_SELECTOR)).map(
			(button) =>
				button
					.getAttribute('aria-label')
					?.slice(LABEL_BUTTON_PREFIX.length)
		),
		...Array.from(row.querySelectorAll('a.IssueLabel[data-name]')).map(
			(label) => label.getAttribute('data-name')
		),
	]);

	return compact({
		author: getRowAuthor(row),
		state: getRowState(row),
		labels,
	});
}

/**
 * Returns whether a URL points to the same Pull Request / Issue as the canonical URL.
 */
function isSameItem(url: string, reference: string): boolean {
	try {
		return (
			new URL(url).pathname.replace(/\/$/, '') ===
			new URL(reference).pathname
		);
	} catch {
		return false;
	}
}

/**
 * Reads the author of a detail page from the page metadata, only when it describes the item of
 * the URL (after a soft navigation the head can still hold the previous item).
 */
function getMetaAuthor(reference: string): string | undefined {
	const ogUrl = document
		.querySelector<HTMLMetaElement>(OG_URL_SELECTOR)
		?.getAttribute('content');
	if (!ogUrl || !isSameItem(ogUrl, reference)) {
		return undefined;
	}

	return (
		document
			.querySelector<HTMLMetaElement>(OG_AUTHOR_SELECTOR)
			?.getAttribute('content') || undefined
	);
}

/**
 * Reads the state badge of a detail page.
 */
function getDetailState(): string | undefined {
	return (
		toState(
			document
				.querySelector(DETAIL_STATE_SELECTOR)
				?.getAttribute('data-status')
		) ??
		toState(
			document
				.querySelector(CLASSIC_STATE_SELECTOR)
				?.getAttribute('title')
		)
	);
}

/**
 * Returns the login of a link to a profile on this site (`/octocat`), otherwise `undefined`.
 */
function getProfileLogin(href: string): string | undefined {
	try {
		const url = new URL(href, window.location.href);
		if (url.origin !== window.location.origin) {
			return undefined;
		}

		const login = PROFILE_PATH_REGEX.exec(url.pathname)?.[1];
		return login && LOGIN_REGEX.test(login) ? login : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Reads the assignee logins of a detail page.
 */
function getDetailAssignees(): string[] {
	const classic = unique(
		Array.from(document.querySelectorAll(CLASSIC_ASSIGNEE_SELECTOR)).map(
			(element) => element.getAttribute('data-assignee-name')
		)
	);
	if (classic.length > 0) {
		return classic;
	}

	return unique(
		Array.from(document.querySelectorAll(REACT_ASSIGNEE_LINK_SELECTOR)).map(
			(link) => getProfileLogin(link.getAttribute('href') ?? '')
		)
	);
}

/**
 * Reads the branches of a Pull Request header: the first two branch names are base and head.
 */
function getBranches(): Pick<LinkMetadata, 'baseBranch' | 'headBranch'> {
	let elements = Array.from(document.querySelectorAll(BRANCH_NAME_SELECTOR));
	if (elements.length < 2) {
		elements = Array.from(
			document.querySelectorAll(CLASSIC_BRANCH_SELECTOR)
		);
	}

	const [base, head] = elements.map((element) =>
		normalizeText(element.textContent)
	);

	return { baseBranch: base, headBranch: head };
}

/**
 * Reads the details of the Pull Request or Issue shown on a detail page.
 *
 * @param type - Kind of the open item.
 * @param reference - Canonical URL of the open item (from the page URL).
 * @param confirmed - The page is known to show this item (its header number matches the URL).
 * Otherwise only the author is read, and only from the page metadata, which checks its own URL;
 * the rest of the page can still show the previous item after an in-page navigation.
 * @returns The details found; fields the page does not show are left out.
 */
export function readDetailMetadata(
	type: LinkType,
	reference: string,
	confirmed: boolean
): LinkMetadata {
	const author = getMetaAuthor(reference);
	if (!confirmed) {
		return compact({ author });
	}

	const milestone = normalizeText(
		document.querySelector(MILESTONE_LINK_SELECTOR)?.textContent
	);

	return compact({
		author:
			author ??
			(normalizeText(
				document.querySelector(CLASSIC_AUTHOR_SELECTOR)?.textContent
			) ||
				undefined),
		state: getDetailState(),
		labels: unique(
			Array.from(document.querySelectorAll(DETAIL_LABEL_SELECTOR)).map(
				(label) => label.getAttribute('data-name') ?? label.textContent
			)
		),
		assignees: getDetailAssignees(),
		milestone,
		...(type === LinkType.PullRequest ? getBranches() : {}),
	});
}
