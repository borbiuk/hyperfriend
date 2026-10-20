import { ConfigModel, LinkType, ShortcutType } from '@shared/models';

/**
 * Key under which the config is stored in chrome.storage.sync.
 */
export const CONFIG_STORAGE_KEY = 'hyperfriend-config';

/**
 * Default configuration, used when nothing is stored and as the base for merging stored values.
 */
export const DEFAULT_CONFIG: ConfigModel = {
	templates: {
		[LinkType.PullRequest]: '[PR {{pr_number}}]: {{pr_name}}',
		[LinkType.Issue]: '[Issue {{issue_number}}]: {{issue_name}}',
	},
	shortcuts: {
		[ShortcutType.CopyLink]: { keys: ['Shift', 'KeyC'], enabled: true },
	},
	display: {
		authorAvatars: true,
	},
};

/**
 * Default templates of versions 1.x and 2.0.0, written before the `[link]` syntax existed.
 * A stored or imported old template equal to one of these becomes the new default.
 */
export const LEGACY_DEFAULT_TEMPLATES: Record<LinkType, string> = {
	[LinkType.PullRequest]: 'PR {{pr_number}}: {{pr_name}}',
	[LinkType.Issue]: 'Issue {{issue_number}}: {{issue_name}}',
};

/**
 * Maximum length of a link template in characters (after trimming), enforced on import
 * and by the popup fields.
 */
export const MAX_TEMPLATE_LENGTH = 500;

/**
 * Placeholder names (without braces) available in the template of each link type.
 * Used for hints in the settings popup.
 */
export const TEMPLATE_PLACEHOLDERS: Record<LinkType, string[]> = {
	[LinkType.PullRequest]: ['pr_number', 'pr_name', 'owner', 'repo', 'url'],
	[LinkType.Issue]: ['issue_number', 'issue_name', 'owner', 'repo', 'url'],
};
