import { LinkType } from './link-type';

/**
 * A GitHub Pull Request or Issue found on the page, used to build a rich link.
 */
export interface LinkTargetModel {
	/** Kind of item (Pull Request or Issue) */
	type: LinkType;

	/** Repository owner, e.g. 'borbiuk' */
	owner: string;

	/** Repository name, e.g. 'hyperfriend' */
	repo: string;

	/** Pull Request or Issue number, e.g. 12 */
	number: number;

	/** Raw, unescaped title text */
	title: string;

	/** Canonical URL: https://github.com/{owner}/{repo}/pull/{n} or /issues/{n} */
	url: string;

	/** Author login; unknown when the page does not show it */
	author?: string;

	/** Lowercase state: `open`, `closed`, `merged` or `draft`; unknown when the page does not show it */
	state?: string;

	/** Label names, in page order */
	labels?: string[];

	/** Assignee logins, in page order */
	assignees?: string[];

	/** Milestone title */
	milestone?: string;

	/** Pull Request source branch, as the page shows it (`owner:branch` for forks) */
	headBranch?: string;

	/** Pull Request target branch, as the page shows it */
	baseBranch?: string;
}
