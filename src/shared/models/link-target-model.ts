import { LinkType } from './link-type';

/**
 * A GitHub Pull Request, Issue, Discussion or workflow run found on the page, used to build a link.
 */
export interface LinkTargetModel {
	/** Kind of item (Pull Request, Issue, Discussion or workflow run) */
	type: LinkType;

	/** Repository owner, e.g. 'borbiuk' */
	owner: string;

	/** Repository name, e.g. 'hyperfriend' */
	repo: string;

	/** Pull Request, Issue or Discussion number, e.g. 12; the run number (`#20481`) of a workflow run */
	number: number;

	/** Raw, unescaped title text (the run name of a workflow run) */
	title: string;

	/** Canonical URL on the site of the page: https://github.com/{owner}/{repo}/pull/{n}, /issues/{n}, /discussions/{n} or /actions/runs/{id} */
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

	/** Discussion category name, e.g. `Help` */
	category?: string;

	/** Workflow name of a workflow run, e.g. `CI` */
	workflow?: string;

	/** Branch of a workflow run, as the page shows it (`owner:branch` for forks) */
	branch?: string;

	/** Status of a workflow run in the words of the page, e.g. `completed successfully` */
	status?: string;
}
