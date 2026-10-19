import { ConfigModel, LinkType } from '@shared/models';

/**
 * Key under which the config is stored in chrome.storage.sync.
 */
export const CONFIG_STORAGE_KEY = 'hyperfriend-config';

/**
 * Default configuration, used when nothing is stored and as the base for merging stored values.
 */
export const DEFAULT_CONFIG: ConfigModel = {
	templates: {
		[LinkType.PullRequest]: 'Pull Request {{pr_number}}: {{pr_name}}',
		[LinkType.Issue]: 'Issue {{issue_number}}: {{issue_name}}',
	},
};

/**
 * Placeholder names (without braces) available in the template of each link type.
 * Used for hints in the settings popup.
 */
export const TEMPLATE_PLACEHOLDERS: Record<LinkType, string[]> = {
	[LinkType.PullRequest]: ['pr_number', 'pr_name', 'owner', 'repo', 'url'],
	[LinkType.Issue]: ['issue_number', 'issue_name', 'owner', 'repo', 'url'],
};
