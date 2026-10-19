// @shared/utils/index.ts

export { escapeHtml } from './escape-html';
export {
	formatShortcut,
	formatShortcutParts,
	isMacPlatform,
	isReservedShortcut,
	matchesShortcut,
	MODIFIER_KEYS,
	normalizeShortcut,
	shortcutFromEvent,
	shortcutsEqual,
	toAriaKeyShortcuts,
	validateShortcut,
} from './shortcut-utils';
export type {
	ShortcutEventLike,
	ShortcutValidationResult,
} from './shortcut-utils';
