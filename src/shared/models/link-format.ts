/**
 * What the copy button puts on the clipboard.
 * The string values are stable and used in the stored config and in settings files.
 */
export enum LinkFormat {
	/** Rich hyperlink: `text/html` link plus `text/plain` fallback */
	Rich = 'rich',

	/** Markdown link in `text/plain`: `[text](url)` */
	Markdown = 'markdown',
}
