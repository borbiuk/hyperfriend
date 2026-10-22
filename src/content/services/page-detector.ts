/**
 * Kind of GitHub page the content script supports.
 */
export enum PageKind {
	/** Pull Request / Issue / Discussion / workflow run lists: repo lists, global dashboards and search results */
	List = 'list',

	/** A single Pull Request, including its sub-tabs (`/files`, `/commits`, `/checks`) */
	PullRequest = 'pull-request',

	/** A single Issue */
	Issue = 'issue',

	/** A single Discussion */
	Discussion = 'discussion',

	/** A single GitHub Actions workflow run, including its sub-pages (`/job/{id}`, `/attempts/{n}`) */
	WorkflowRun = 'workflow-run',

	/** Any other page; nothing is injected */
	Unsupported = 'unsupported',
}

/** `/{owner}/{repo}/pull/{n}` with optional sub-path (`/files`, `/commits`, ...) */
const PULL_REQUEST_PAGE_REGEX = /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/.*)?$/;

/** `/{owner}/{repo}/pull/{n}` only: the Conversation tab, no sub-path */
const PULL_REQUEST_CONVERSATION_REGEX = /^\/[^/]+\/[^/]+\/pull\/\d+\/?$/;

/** `/{owner}/{repo}/issues/{n}` */
const ISSUE_PAGE_REGEX = /^\/[^/]+\/[^/]+\/issues\/\d+\/?$/;

/** `/{owner}/{repo}/discussions/{n}` */
/** Organization discussions (`/orgs/{org}/discussions/{n}`) are not supported: they have no repository */
const DISCUSSION_PAGE_REGEX = /^\/(?!orgs\/)[^/]+\/[^/]+\/discussions\/\d+\/?$/;

/** `/{owner}/{repo}/actions/runs/{id}` with an optional sub-path (`/job/{id}`, `/attempts/{n}`, ...) */
const WORKFLOW_RUN_PAGE_REGEX = /^\/[^/]+\/[^/]+\/actions\/runs\/\d+(?:\/.*)?$/;

/** `/{owner}/{repo}/actions/runs/{id}`, also of one attempt (`/attempts/{n}`): the run summary, not a job page */
const WORKFLOW_RUN_SUMMARY_REGEX =
	/^\/[^/]+\/[^/]+\/actions\/runs\/\d+(?:\/attempts\/\d+)?\/?$/;

/**
 * Repository Discussion and Actions lists: `/{owner}/{repo}/discussions` (and a category,
 * `/discussions/categories/{slug}`), `/{owner}/{repo}/actions` and one workflow's runs,
 * `/actions/workflows/{file}`. Other paths below them (`/discussions/new`, `/actions/caches`, ...) are not lists.
 */
const DISCUSSION_AND_ACTIONS_LIST_REGEXES = [
	/^\/(?!orgs\/)[^/]+\/[^/]+\/discussions\/?$/,
	/^\/(?!orgs\/)[^/]+\/[^/]+\/discussions\/categories\/[^/]+\/?$/,
	/^\/[^/]+\/[^/]+\/actions\/?$/,
	/^\/[^/]+\/[^/]+\/actions\/workflows\/[^/]+\/?$/,
];

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

	if (DISCUSSION_PAGE_REGEX.test(pathname)) {
		return PageKind.Discussion;
	}

	if (WORKFLOW_RUN_PAGE_REGEX.test(pathname)) {
		return PageKind.WorkflowRun;
	}

	if (
		GLOBAL_LIST_REGEX.test(pathname) ||
		REPO_LIST_REGEXES.some((regex) => regex.test(pathname)) ||
		DISCUSSION_AND_ACTIONS_LIST_REGEXES.some((regex) =>
			regex.test(pathname)
		)
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

/**
 * Returns whether the page is the main Pull Request page (Conversation tab),
 * not one of its sub-tabs (`/files`, `/commits`, `/checks`, ...).
 *
 * @param location - Location to inspect (defaults to the current page).
 */
export function isPullRequestConversation(
	location: Location | URL = window.location
): boolean {
	return PULL_REQUEST_CONVERSATION_REGEX.test(location.pathname);
}

/**
 * Returns whether the page is the summary of a workflow run (or of one attempt), not one of its
 * other sub-pages (`/job/{id}`, ...).
 *
 * @param location - Location to inspect (defaults to the current page).
 */
export function isWorkflowRunSummary(
	location: Location | URL = window.location
): boolean {
	return WORKFLOW_RUN_SUMMARY_REGEX.test(location.pathname);
}

/**
 * Returns whether the page is a repository Discussion or Actions list. Their rows are found by
 * their own selectors only: the link fallback for Pull Request and Issue lists would match the
 * pull request links in the rows of a run list.
 *
 * @param location - Location to inspect (defaults to the current page).
 */
export function isDiscussionOrActionsList(
	location: Location | URL = window.location
): boolean {
	return DISCUSSION_AND_ACTIONS_LIST_REGEXES.some((regex) =>
		regex.test(location.pathname)
	);
}
