// @shared/utils/index.ts

export {
	deriveFacets,
	normalizeCustomChips,
	parseCustomLabel,
	parseCustomQuery,
	resolveChips,
	toChipModel,
	validateCustomChip,
} from './custom-chips';
export type { CustomChipResult, CustomQueryResult } from './custom-chips';
export { escapeHtml } from './escape-html';
export {
	applyRememberedState,
	buildSearch,
	DEFAULT_QUERY,
	getDraftState,
	isGroupToken,
	getTokenKey,
	isChipActive,
	joinQuery,
	nextDraftState,
	readQuery,
	setDraftState,
	tokenizeQuery,
	toggleChip,
} from './filter-query';
export type { RememberedFilterState } from './filter-query';
export { normalizeFilterChips } from './filter-settings';
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
