/**
 * Kind of GitHub page the content script supports.
 */
export enum PageKind {
	/** Pull Request / Issue lists: repo lists, global dashboards and search results */
	List = 'list',

	/** A single Pull Request, including its sub-tabs (`/files`, `/commits`, `/checks`) */
	PullRequest = 'pull-request',

	/** A single Issue */
	Issue = 'issue',

	/** Any other page; nothing is injected */
	Unsupported = 'unsupported',
}

/** `/{owner}/{repo}/pull/{n}` with optional sub-path (`/files`, `/commits`, ...) */
const PULL_REQUEST_PAGE_REGEX = /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/.*)?$/;

/** `/{owner}/{repo}/issues/{n}` */
const ISSUE_PAGE_REGEX = /^\/[^/]+\/[^/]+\/issues\/\d+\/?$/;

/**
 * Repository lists: `/{owner}/{repo}/pulls`, `/{owner}/{repo}/issues`, their filter sub-paths
 * (`/issues/assigned/{user}`, `/pulls/review-requested/{user}`, ...) and the PR author shortcut
 * `/pulls/{user}` (not `/pulls/new` or all-digit `/pulls/12`). Other sub-paths (`/issues/new`, `/issues/12/linked_closing_reference`) are not lists.
 */
const REPO_LIST_REGEXES = [
	/^\/[^/]+\/[^/]+\/(?:pulls|issues)\/?$/,
	/^\/[^/]+\/[^/]+\/(?:pulls|issues)\/(?:assigned|created_by|mentioned|review-requested)\/[^/]+\/?$/,
	/^\/[^/]+\/[^/]+\/pulls\/(?!new\/?$)(?!\d+\/?$)[^/]+\/?$/,
];

/** Global dashboards: `/pulls`, `/issues` and their filter tabs (`/pulls/review-requested`, ...) */
const GLOBAL_LIST_REGEX =
	/^\/(?:pulls|issues)(?:\/(?:assigned|created|mentioned|review-requested|recent-activity))?\/?$/;

/** Search result types that list Pull Requests or Issues */
const SEARCH_TYPES = new Set(['pullrequests', 'issues']);

/**
 * Detects the kind of the current GitHub page from its URL.
 *
 * @param location - Location to inspect (defaults to the current page).
 * @returns The detected page kind.
 */
export function detectPageKind(
	location: Location | URL = window.location
): PageKind {
	const { pathname } = location;

	if (PULL_REQUEST_PAGE_REGEX.test(pathname)) {
		return PageKind.PullRequest;
	}

	if (ISSUE_PAGE_REGEX.test(pathname)) {
		return PageKind.Issue;
	}

	if (
		GLOBAL_LIST_REGEX.test(pathname) ||
		REPO_LIST_REGEXES.some((regex) => regex.test(pathname))
	) {
		return PageKind.List;
	}

	if (pathname === '/search') {
		const type = new URLSearchParams(location.search).get('type');
		if (type && SEARCH_TYPES.has(type.toLowerCase())) {
			return PageKind.List;
		}
	}

	return PageKind.Unsupported;
}
