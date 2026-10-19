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
}
