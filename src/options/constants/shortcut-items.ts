import { ShortcutType } from '@shared/models';

/** How a shortcut is presented on the Shortcuts tab. */
export interface ShortcutItem {
	type: ShortcutType;
	/** Name of the action, e.g. "Copy link". */
	title: string;
	/** Where the shortcut works. */
	description: string;
}

/**
 * Rows of the Shortcuts tab, in display order. A new ShortcutType gets a row here.
 */
export const SHORTCUT_ITEMS: readonly ShortcutItem[] = [
	{
		type: ShortcutType.CopyLink,
		title: 'Copy link',
		description: 'On an open pull request or issue',
	},
];
