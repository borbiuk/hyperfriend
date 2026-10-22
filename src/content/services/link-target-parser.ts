import { LinkTargetModel, LinkType } from '@shared/models';

import { readDetailMetadata, readListMetadata } from './link-metadata-parser';

/** Pull Request / Issue path with an optional sub-path: `/{owner}/{repo}/pull/{n}/files` */
const ITEM_PATH_REGEX = /^\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)(\/.*)?$/;

/** Text that is only a number reference, e.g. `#123` */
const NUMBER_ONLY_REGEX = /^#?\d+$/;

/** `<title> by <author> · Pull Request #<n> · owner/repo[ · GitHub]` */
const PULL_REQUEST_DOCUMENT_TITLE_REGEX =
	/^(.+?)(?: by [^\s·]+)? · Pull Request #(\d+) · /;

/** `<title> · Issue #<n> · owner/repo[ · GitHub]` */
const ISSUE_DOCUMENT_TITLE_REGEX = /^(.+?) · Issue #(\d+) · /;

/** Elements holding only the title text inside a detail page header */
const DETAIL_TITLE_TEXT_SELECTORS = [
	'[data-testid="issue-title"]',
	'.js-issue-title',
	'.markdown-title',
];

/** Text of a `#123` number element next to a detail page title */
const NUMBER_TEXT_REGEX = /^#\d+$/;

/** Title text (may contain `#123` references) and our own UI, never the number element */
const TITLE_TEXT_SELECTOR =
	'[data-testid="issue-title"], .markdown-title, .js-issue-title, [data-hyperfriend]';

/** Elements that are never part of the title text */
const NON_TITLE_SELECTOR = '.sr-only, [aria-hidden="true"], [data-hyperfriend]';

/**
 * Identity of a Pull Request or Issue parsed from a URL (everything except the title).
 */
type ItemReference = Pick<
	LinkTargetModel,
	'type' | 'owner' | 'repo' | 'number' | 'url'
>;

/**
 * Collapses whitespace (including non-breaking spaces) and trims.
 */
export function normalizeText(value: string | null | undefined): string {
	return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Parses a Pull Request or Issue reference from a URL or path.
 *
 * @param href - Absolute URL or path, resolved against the current page.
 * @param allowSubPath - Accept sub-paths such as `/pull/12/files` (detail pages); list links must be exact.
 * @returns The reference with a canonical URL, or `null` if the URL is not a github.com PR / Issue.
 */
export function parseItemUrl(
	href: string,
	allowSubPath: boolean
): ItemReference | null {
	let url: URL;
	try {
		url = new URL(href, window.location.href);
	} catch {
		return null;
	}

	if (url.origin !== window.location.origin) {
		return null;
	}

	const match = ITEM_PATH_REGEX.exec(url.pathname);
	if (!match) {
		return null;
	}

	const [, owner, repo, kind, rawNumber, subPath] = match;
	if (subPath && !allowSubPath) {
		return null;
	}

	const type = kind === 'pull' ? LinkType.PullRequest : LinkType.Issue;
	const number = Number(rawNumber);

	return {
		type,
		owner,
		repo,
		number,
		url: `${url.origin}/${owner}/${repo}/${kind}/${number}`,
	};
}

/**
 * Builds a link target from a list row title link (its text is the title).
 *
 * @param anchor - Title link of a list row.
 * @param withMetadata - Also read author, state and labels of the row (more DOM work; only needed to copy).
 * @returns The target, or `null` if the link is not a PR / Issue title link.
 */
export function parseListLink(
	anchor: HTMLAnchorElement,
	withMetadata = false
): LinkTargetModel | null {
	const reference = parseItemUrl(anchor.getAttribute('href') ?? '', false);
	if (!reference) {
		return null;
	}

	const title = normalizeText(anchor.textContent);
	if (!title || NUMBER_ONLY_REGEX.test(title)) {
		return null;
	}

	if (!withMetadata) {
		return { ...reference, title };
	}

	return { ...reference, ...readListMetadata(anchor), title };
}

/**
 * Returns the innermost `#123` element in a detail page header or right next to it
 * (React PR header: the number is in a wrapper after the `h1`).
 *
 * @param header - Title header element of the page.
 * @returns The number element, or `null` if the header shows no number.
 */
export function findNumberElement(header: Element): Element | null {
	const scope = header.parentElement ?? header;
	const sibling = header.nextElementSibling;

	for (const element of scope.querySelectorAll('span')) {
		if (
			!(header.contains(element) || sibling?.contains(element)) ||
			element.closest(TITLE_TEXT_SELECTOR) ||
			!NUMBER_TEXT_REGEX.test(normalizeText(element.textContent))
		) {
			continue;
		}

		const innerNumber = Array.from(element.children).some((child) =>
			NUMBER_TEXT_REGEX.test(normalizeText(child.textContent))
		);
		if (!innerNumber) {
			return element;
		}
	}

	return null;
}

/**
 * Extracts the title text from a detail page header element.
 */
function getHeaderTitle(header: Element): string {
	for (const selector of DETAIL_TITLE_TEXT_SELECTORS) {
		const element = header.matches(selector)
			? header
			: header.querySelector(selector);
		const text = normalizeText(element?.textContent);
		if (text) {
			return text;
		}
	}

	// Fallback: the header text without hidden helpers and the trailing `#123`
	const clone = header.cloneNode(true) as Element;
	clone.querySelectorAll(NON_TITLE_SELECTOR).forEach((node) => node.remove());

	return normalizeText(clone.textContent).replace(/\s*#\d+$/, '');
}

/**
 * Extracts the title from `document.title` or `og:title` for the given item.
 */
function getDocumentTitle(reference: ItemReference): string {
	const regex =
		reference.type === LinkType.PullRequest
			? PULL_REQUEST_DOCUMENT_TITLE_REGEX
			: ISSUE_DOCUMENT_TITLE_REGEX;
	const sources = [
		document.title,
		document
			.querySelector<HTMLMetaElement>('meta[property="og:title"]')
			?.getAttribute('content'),
	];

	for (const source of sources) {
		const match = regex.exec(normalizeText(source));
		if (match && Number(match[2]) === reference.number) {
			return match[1];
		}
	}

	return '';
}

/**
 * Builds the link target of the current Pull Request / Issue detail page.
 *
 * @param header - Title header element of the page, if found.
 * @param withMetadata - Also read author, state, labels, assignees, milestone and branches (only needed to copy).
 * @returns The target, or `null` if the URL or the title can not be resolved.
 */
export function parseDetailPage(
	header: Element | null,
	withMetadata = false
): LinkTargetModel | null {
	const reference = parseItemUrl(window.location.href, true);
	if (!reference) {
		return null;
	}

	// After a soft navigation the URL changes before the header re-renders: a header showing
	// another number still holds the previous item's title. Use the (number-checked) document
	// title then, or fail rather than copy a wrong link.
	const number = header ? findNumberElement(header) : null;
	if (
		number &&
		Number(normalizeText(number.textContent).slice(1)) !== reference.number
	) {
		const title = getDocumentTitle(reference);
		return title ? { ...reference, title } : null;
	}

	const title =
		(header ? getHeaderTitle(header) : '') || getDocumentTitle(reference);
	if (!title) {
		return null;
	}

	if (!withMetadata) {
		return { ...reference, title };
	}

	// The sidebar and the branches are trusted only while the header shows the item of the URL
	const confirmed =
		number !== null &&
		Number(normalizeText(number.textContent).slice(1)) === reference.number;

	return {
		...reference,
		...readDetailMetadata(reference.type, reference.url, confirmed),
		title,
	};
}
