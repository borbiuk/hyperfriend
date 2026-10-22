/**
 * The default settings as the extension stores them, written out literally so tests never take an
 * expected value from `DEFAULT_CONFIG` / `cloneDefaultConfig()` (the code under test). Spread it and
 * override the part a test changes.
 */
export const DEFAULT_STORED_CONFIG = {
	templates: {
		'pull-request': '[PR {{pr_number}}]: {{pr_name}}',
		issue: '[Issue {{issue_number}}]: {{issue_name}}',
		discussion: '[Discussion {{discussion_number}}]: {{discussion_name}}',
		'workflow-run': '[{{workflow}} #{{run_number}}]: {{run_name}}',
	},
	shortcuts: {
		'copy-link': { keys: ['Shift', 'KeyC'], enabled: true },
	},
	format: 'rich',
	display: { authorAvatars: true },
	templateFormat: 2,
} as const;
