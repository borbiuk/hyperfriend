import { LinkTargetModel, LinkType } from '@shared/models';

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

/** Elements that are never part of the title text */
const NON_TITLE_SELECTOR = '.sr-only, [aria-hidden="true"], [data-hyperfriend]';

/**
 * Identity of a Pull Request or Issue parsed from a URL (everything except the title).
 */
type ItemReference = Omit<LinkTargetModel, 'title'>;

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
 * @returns The target, or `null` if the link is not a PR / Issue title link.
 */
export function parseListLink(
	anchor: HTMLAnchorElement
): LinkTargetModel | null {
	const reference = parseItemUrl(anchor.getAttribute('href') ?? '', false);
	if (!reference) {
		return null;
	}

	const title = normalizeText(anchor.textContent);
	if (!title || NUMBER_ONLY_REGEX.test(title)) {
		return null;
	}

	return { ...reference, title };
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
 * @returns The target, or `null` if the URL or the title can not be resolved.
 */
export function parseDetailPage(
	header: Element | null
): LinkTargetModel | null {
	const reference = parseItemUrl(window.location.href, true);
	if (!reference) {
		return null;
	}

	const title =
		(header ? getHeaderTitle(header) : '') || getDocumentTitle(reference);
	if (!title) {
		return null;
	}

	return { ...reference, title };
}
