/** Tabs of the settings UI, in display order. The values are also URL hash tokens. */
export const OPTIONS_TABS = [
	'templates',
	'shortcuts',
	'filters',
	'general',
] as const;

/** A tab of the settings UI. */
export type OptionsTab = (typeof OPTIONS_TABS)[number];

/** Tab shown when the URL hash names none. */
export const DEFAULT_OPTIONS_TAB: OptionsTab = 'templates';

/** Hash token that forces the browser tab view (centered panel). */
const TAB_VIEW_TOKEN = 'tab';

/** What the URL hash of `options.html` asks for. */
export interface OptionsHash {
	/** Tab to open first, or `null` when the hash names none. */
	tab: OptionsTab | null;
	/** True when the hash forces the browser tab view (handy for manual tests). */
	forceTabView: boolean;
}

/**
 * Returns true for one of the tab names.
 */
function isOptionsTab(value: string): value is OptionsTab {
	return (OPTIONS_TABS as readonly string[]).includes(value);
}

/**
 * Parses the URL hash of the settings page.
 *
 * The hash is a list of tokens separated by `,` (or `&`), case-insensitive, in any order;
 * unknown tokens are ignored:
 * - `templates`, `shortcuts`, `filters`, `general`: the tab to open first (the last one wins);
 * - `tab`: force the browser tab view even when `chrome.tabs.getCurrent()` can't tell.
 *
 * Examples: `#general`, `#tab`, `#tab,general`.
 *
 * @param hash - `location.hash` (with or without the leading `#`).
 * @returns The requested tab and view override.
 */
export function parseOptionsHash(hash: string): OptionsHash {
	const result: OptionsHash = { tab: null, forceTabView: false };
	const tokens = hash.replace(/^#/, '').toLowerCase().split(/[,&]/);

	for (const raw of tokens) {
		const token = raw.trim();
		if (token === TAB_VIEW_TOKEN) {
			result.forceTabView = true;
			continue;
		}

		if (isOptionsTab(token)) {
			result.tab = token;
		}
	}

	return result;
}
