/**
 * Kind of GitHub item a copyable link points to.
 * The string values are stable and used as keys in the stored config.
 */
export enum LinkType {
	/** GitHub Pull Request (`/pull/{n}`) */
	PullRequest = 'pull-request',

	/** GitHub Issue (`/issues/{n}`) */
	Issue = 'issue',
}
