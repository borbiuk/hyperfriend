/**
 * Keyboard shortcut actions of the extension.
 * The string values are stable and used as keys in the stored config and in settings files.
 * New shortcuts are added here, with a default in DEFAULT_CONFIG and a handler in the content script.
 */
export enum ShortcutType {
	/** Copies the link of the open Pull Request, Issue, Discussion or workflow run */
	CopyLink = 'copy-link',
}
