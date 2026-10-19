import {
	BROWSER_RESERVED_SHORTCUTS,
	GITHUB_SHORTCUTS,
	SHORTCUT_MAIN_KEYS,
	TEXT_NAVIGATION_SHORTCUTS,
} from '@shared/constants';
import { ShortcutBindingModel, ShortcutType } from '@shared/models';

/**
 * Modifier names of a normalized shortcut, in their canonical order.
 */
export const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta'] as const;

/** A modifier name of a normalized shortcut. */
type ModifierKey = (typeof MODIFIER_KEYS)[number];

/** Keyboard event fields a shortcut is read from. */
export type ShortcutEventLike = Pick<
	KeyboardEvent,
	'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'
>;

/**
 * Result of validating a shortcut: ok (optionally with a warning) or a user-facing error.
 */
export type ShortcutValidationResult =
	{ ok: true; warning?: string } | { ok: false; error: string };

/** Navigator with the optional User-Agent Client Hints API (Chromium only). */
type NavigatorWithUserAgentData = Navigator & {
	userAgentData?: { platform?: string };
};

const MAIN_KEY_SET = new Set<string>(SHORTCUT_MAIN_KEYS);

const MAC_MODIFIER_LABELS: Record<ModifierKey, string> = {
	Control: '⌃',
	Alt: '⌥',
	Shift: '⇧',
	Meta: '⌘',
};

const OTHER_MODIFIER_LABELS: Record<ModifierKey, string> = {
	Control: 'Ctrl',
	Alt: 'Alt',
	Shift: 'Shift',
	Meta: 'Win',
};

/** Display labels of main keys that are not a letter, digit, F-key or numpad key. */
const KEY_LABELS: Record<string, string> = {
	ArrowUp: '↑',
	ArrowDown: '↓',
	ArrowLeft: '←',
	ArrowRight: '→',
	Backquote: '`',
	Minus: '-',
	Equal: '=',
	BracketLeft: '[',
	BracketRight: ']',
	Backslash: '\\',
	Semicolon: ';',
	Quote: "'",
	Comma: ',',
	Period: '.',
	Slash: '/',
	Space: 'Space',
	Enter: 'Enter',
	Backspace: '⌫',
	Delete: 'Del',
	Insert: 'Ins',
	Home: 'Home',
	End: 'End',
	PageUp: 'PgUp',
	PageDown: 'PgDn',
};

/** Characters of the numpad operator keys (`NumpadAdd` → `+`). */
const NUMPAD_LABELS: Record<string, string> = {
	NumpadAdd: '+',
	NumpadSubtract: '-',
	NumpadMultiply: '*',
	NumpadDivide: '/',
	NumpadDecimal: '.',
	NumpadComma: ',',
	NumpadEqual: '=',
	NumpadEnter: 'Enter',
};

/** Main keys whose WAI-ARIA name (a `KeyboardEvent.key` value) is the code itself. */
const ARIA_NAMED_KEYS = new Set([
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'Space',
	'Enter',
	'Backspace',
	'Delete',
	'Insert',
	'Home',
	'End',
	'PageUp',
	'PageDown',
]);

/**
 * Returns true for one of the normalized modifier names.
 */
function isModifier(value: string): value is ModifierKey {
	return (MODIFIER_KEYS as readonly string[]).includes(value);
}

/**
 * Returns true when the extension runs on macOS or iOS / iPadOS.
 */
export function isMacPlatform(): boolean {
	if (typeof navigator === 'undefined') {
		return false;
	}

	const nav = navigator as NavigatorWithUserAgentData;
	const platform =
		nav.userAgentData?.platform || nav.platform || nav.userAgent || '';

	return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * Builds the normalized shortcut of a key press.
 *
 * @param event - The keyboard event (only `code` and the modifier flags are read).
 * @returns Modifiers in canonical order plus `event.code`, or `null` when the pressed
 * key is a modifier, unidentified or not allowed as a shortcut key.
 */
export function shortcutFromEvent(event: ShortcutEventLike): string[] | null {
	if (!MAIN_KEY_SET.has(event.code)) {
		return null;
	}

	const keys: string[] = [];
	if (event.ctrlKey) {
		keys.push('Control');
	}

	if (event.altKey) {
		keys.push('Alt');
	}

	if (event.shiftKey) {
		keys.push('Shift');
	}

	if (event.metaKey) {
		keys.push('Meta');
	}

	keys.push(event.code);
	return keys;
}

/**
 * Puts a key list in canonical order without requiring a modifier.
 *
 * @param value - Any value.
 * @returns Modifiers in canonical order plus the main key, or `null` unless it is an
 * array of unique known modifiers plus exactly one allowed main key.
 */
function orderKeys(value: unknown): string[] | null {
	if (!Array.isArray(value) || value.length === 0) {
		return null;
	}

	const modifiers = new Set<ModifierKey>();
	let mainKey: string | null = null;
	for (const key of value) {
		if (typeof key !== 'string') {
			return null;
		}

		if (isModifier(key)) {
			if (modifiers.has(key)) {
				return null;
			}

			modifiers.add(key);
			continue;
		}

		if (mainKey !== null || !MAIN_KEY_SET.has(key)) {
			return null;
		}

		mainKey = key;
	}

	if (mainKey === null) {
		return null;
	}

	return [...MODIFIER_KEYS.filter((key) => modifiers.has(key)), mainKey];
}

/**
 * Returns true when the shortcut is one of the given combinations.
 */
function isListed(
	keys: readonly string[],
	list: readonly (readonly string[])[]
): boolean {
	return list.some((entry) => shortcutsEqual(keys, entry));
}

/**
 * Returns true when the browser or text editing uses the combination
 * (BROWSER_RESERVED_SHORTCUTS), e.g. `Meta+KeyC`. Modifier order is ignored.
 */
export function isReservedShortcut(keys: readonly string[]): boolean {
	return isListed(keys, BROWSER_RESERVED_SHORTCUTS);
}

/**
 * Validates an untrusted shortcut (from storage or an imported file).
 *
 * @param value - Any value.
 * @returns The shortcut in canonical order (modifiers, then the main key), or `null`
 * unless it is an array of at least one unique known modifier plus exactly one
 * allowed main key, and not a browser-reserved combination (see isReservedShortcut).
 */
export function normalizeShortcut(value: unknown): string[] | null {
	const keys = orderKeys(value);
	if (!keys || keys.length < 2 || isReservedShortcut(keys)) {
		return null;
	}

	return keys;
}

/**
 * Returns true when both shortcuts are the same combination (modifier order is ignored).
 */
export function shortcutsEqual(
	a: readonly string[],
	b: readonly string[]
): boolean {
	const left = orderKeys(a) ?? a;
	const right = orderKeys(b) ?? b;

	return (
		left.length === right.length &&
		left.every((key, index) => key === right[index])
	);
}

/**
 * Returns true when the key press is exactly the shortcut (same modifiers and main key).
 *
 * @param event - The keyboard event.
 * @param keys - Normalized shortcut.
 */
export function matchesShortcut(
	event: ShortcutEventLike,
	keys: string[]
): boolean {
	const pressed = shortcutFromEvent(event);
	if (!pressed) {
		return false;
	}

	return shortcutsEqual(pressed, keys);
}

/**
 * Returns the display label of a main key, e.g. `C`, `5`, `F5`, `↑`, `/`, `Num 1`.
 */
function formatMainKey(code: string): string {
	if (/^Key[A-Z]$/.test(code)) {
		return code.slice(3);
	}

	if (/^Digit\d$/.test(code)) {
		return code.slice(5);
	}

	if (/^Numpad\d$/.test(code)) {
		return `Num ${code.slice(6)}`;
	}

	if (code in NUMPAD_LABELS) {
		return `Num ${NUMPAD_LABELS[code]}`;
	}

	return KEY_LABELS[code] ?? code;
}

/**
 * Returns one display label per key, for rendering as separate `<kbd>` elements.
 *
 * @param keys - Normalized shortcut.
 * @param isMac - Use macOS symbols (`⌃ ⌥ ⇧ ⌘`) instead of `Ctrl Alt Shift Win`.
 * @returns E.g. `['⇧', 'C']` on macOS, `['Shift', 'C']` elsewhere.
 */
export function formatShortcutParts(
	keys: string[],
	isMac: boolean = isMacPlatform()
): string[] {
	const labels = isMac ? MAC_MODIFIER_LABELS : OTHER_MODIFIER_LABELS;

	return keys.map((key) => {
		if (isModifier(key)) {
			return labels[key];
		}

		return formatMainKey(key);
	});
}

/**
 * Returns the shortcut as one display string.
 *
 * @param keys - Normalized shortcut.
 * @param isMac - Use macOS symbols.
 * @returns E.g. `⇧C` on macOS, `Shift+C` elsewhere.
 */
export function formatShortcut(
	keys: string[],
	isMac: boolean = isMacPlatform()
): string {
	return formatShortcutParts(keys, isMac).join(isMac ? '' : '+');
}

/**
 * Returns the WAI-ARIA name (a `KeyboardEvent.key` value) of a main key.
 */
function toAriaKey(code: string): string {
	if (/^Key[A-Z]$/.test(code)) {
		return code.slice(3);
	}

	if (/^Digit\d$/.test(code)) {
		return code.slice(5);
	}

	if (/^Numpad\d$/.test(code)) {
		return code.slice(6);
	}

	if (ARIA_NAMED_KEYS.has(code)) {
		return code;
	}

	const char = NUMPAD_LABELS[code] ?? KEY_LABELS[code] ?? code;
	// `+` separates keys in aria-keyshortcuts, so the key itself is named `Plus`.
	if (char === '+') {
		return 'Plus';
	}

	return char;
}

/**
 * Returns the shortcut in the `aria-keyshortcuts` format.
 *
 * @param keys - Normalized shortcut.
 * @returns E.g. `Shift+C`, `Control+Alt+K`, `Shift+Meta+ArrowUp`.
 */
export function toAriaKeyShortcuts(keys: string[]): string {
	return keys
		.map((key) => {
			if (isModifier(key)) {
				return key;
			}

			return toAriaKey(key);
		})
		.join('+');
}

/**
 * Checks a shortcut the user recorded for an action.
 *
 * @param keys - Recorded shortcut.
 * @param type - Action the shortcut is for.
 * @param all - Current bindings of every action (to detect conflicts).
 * @returns `{ ok: true }`, possibly with a warning (GitHub, scrolling or text selection
 * uses the combination), or
 * `{ ok: false, error }` with a short user-facing message.
 */
export function validateShortcut(
	keys: string[],
	type: ShortcutType,
	all: Record<ShortcutType, ShortcutBindingModel>
): ShortcutValidationResult {
	// Not normalizeShortcut: the checks below give more specific messages.
	const normalized = orderKeys(keys);
	if (!normalized) {
		return { ok: false, error: "This key can't be used in a shortcut." };
	}

	if (!normalized.some(isModifier)) {
		const error = isMacPlatform()
			? 'Add Shift, Option, Control or Command to the shortcut.'
			: 'Add Shift, Alt, Ctrl or Win to the shortcut.';
		return { ok: false, error };
	}

	if (isReservedShortcut(normalized)) {
		return { ok: false, error: 'This shortcut is used by the browser.' };
	}

	const conflict = Object.values(ShortcutType).some((other) => {
		const binding = all[other];
		return (
			other !== type &&
			binding?.enabled === true &&
			shortcutsEqual(binding.keys, normalized)
		);
	});
	if (conflict) {
		return {
			ok: false,
			error: 'Another Hyperfriend shortcut already uses these keys.',
		};
	}

	if (isListed(normalized, GITHUB_SHORTCUTS)) {
		return { ok: true, warning: 'GitHub also uses this shortcut.' };
	}

	if (isListed(normalized, TEXT_NAVIGATION_SHORTCUTS)) {
		return {
			ok: true,
			warning: 'This shortcut is used for scrolling or selecting text.',
		};
	}

	return { ok: true };
}
