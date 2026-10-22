const LETTER_CODES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
	.split('')
	.map((letter) => `Key${letter}`);

const DIGIT_CODES = Array.from({ length: 10 }, (_, digit) => `Digit${digit}`);

const FUNCTION_KEY_CODES = Array.from({ length: 24 }, (_, i) => `F${i + 1}`);

const NUMPAD_CODES = [
	...Array.from({ length: 10 }, (_, digit) => `Numpad${digit}`),
	'NumpadAdd',
	'NumpadSubtract',
	'NumpadMultiply',
	'NumpadDivide',
	'NumpadDecimal',
	'NumpadComma',
	'NumpadEqual',
	'NumpadEnter',
];

/**
 * `KeyboardEvent.code` values allowed as the main (non-modifier) key of a shortcut:
 * letters, digits, F1–F24, arrows, US punctuation, editing and navigation keys, numpad keys.
 * `Escape` and `Tab` are deliberately missing (they cancel recording and move focus).
 */
export const SHORTCUT_MAIN_KEYS: readonly string[] = [
	...LETTER_CODES,
	...DIGIT_CODES,
	...FUNCTION_KEY_CODES,
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'Backquote',
	'Minus',
	'Equal',
	'BracketLeft',
	'BracketRight',
	'Backslash',
	'Semicolon',
	'Quote',
	'Comma',
	'Period',
	'Slash',
	'Space',
	'Enter',
	'Backspace',
	'Delete',
	'Insert',
	'Home',
	'End',
	'PageUp',
	'PageDown',
	...NUMPAD_CODES,
];

/**
 * Keys that browsers and text fields use with `Control` / `Meta`, alone or with `Shift`:
 * copy, paste, cut, select all, undo, redo, find, print, save, new / reopen tab, close tab,
 * reload, address bar, new window, quit, hide / history, bookmark, downloads, open file,
 * view source, find next, search, page info / developer tools (`KeyI`), bookmarks
 * (`KeyB`), switch to tab 1–9 and zoom (`Digit0`, `Equal`, `Minus`).
 */
const CONTROL_META_RESERVED_KEYS = [
	'KeyC',
	'KeyV',
	'KeyX',
	'KeyA',
	'KeyZ',
	'KeyY',
	'KeyF',
	'KeyP',
	'KeyS',
	'KeyT',
	'KeyW',
	'KeyR',
	'KeyL',
	'KeyN',
	'KeyQ',
	'KeyH',
	'KeyD',
	'KeyJ',
	'KeyO',
	'KeyU',
	'KeyG',
	'KeyE',
	'KeyI',
	'KeyB',
	...DIGIT_CODES,
	'Equal',
	'Minus',
];

/**
 * Normalized combinations used by the browser or by text editing; they can't be assigned,
 * and stored or imported bindings with them are treated as invalid (see normalizeShortcut).
 * - `Control` or `Meta`, alone or with `Shift`, plus a key of CONTROL_META_RESERVED_KEYS
 *   (covers `Meta+Shift+KeyZ` redo and `Control/Meta+Shift+KeyT` reopen tab);
 * - `Alt+ArrowLeft/ArrowRight` and `Meta+BracketLeft/BracketRight` (back / forward);
 * - `Shift+Meta+BracketLeft/BracketRight`, `Control+PageUp/PageDown` (switch tab) and
 *   `Control+Shift+PageUp/PageDown` (move tab);
 * - `Alt+Meta+KeyI/KeyJ/KeyC` (developer tools, console and inspect on macOS),
 *   `Control+Shift+Delete` and `Shift+Meta+Backspace` (clear browsing data).
 */
export const BROWSER_RESERVED_SHORTCUTS: readonly (readonly string[])[] = [
	...CONTROL_META_RESERVED_KEYS.flatMap((code) => [
		['Control', code],
		['Control', 'Shift', code],
		['Meta', code],
		['Shift', 'Meta', code],
	]),
	['Alt', 'ArrowLeft'],
	['Alt', 'ArrowRight'],
	['Meta', 'BracketLeft'],
	['Meta', 'BracketRight'],
	['Shift', 'Meta', 'BracketLeft'],
	['Shift', 'Meta', 'BracketRight'],
	['Control', 'PageUp'],
	['Control', 'PageDown'],
	['Control', 'Shift', 'PageUp'],
	['Control', 'Shift', 'PageDown'],
	['Alt', 'Meta', 'KeyI'],
	['Alt', 'Meta', 'KeyJ'],
	['Alt', 'Meta', 'KeyC'],
	['Control', 'Shift', 'Delete'],
	['Shift', 'Meta', 'Backspace'],
];

/**
 * Normalized combinations GitHub uses itself; they can be assigned, with a warning.
 * Command palette, keyboard shortcuts help (`?`), submit comment, command palette in
 * command mode, and the `Alt+Shift` comment-box shortcuts.
 * BROWSER_RESERVED_SHORTCUTS is checked first, so `Control/Meta+Shift+KeyP` (also the
 * browser's private window) ends up as an error.
 */
export const GITHUB_SHORTCUTS: readonly (readonly string[])[] = [
	['Control', 'KeyK'],
	['Meta', 'KeyK'],
	['Control', 'Slash'],
	['Meta', 'Slash'],
	['Shift', 'Slash'],
	['Control', 'Enter'],
	['Meta', 'Enter'],
	['Control', 'Shift', 'KeyP'],
	['Shift', 'Meta', 'KeyP'],
	['Alt', 'Shift', 'KeyC'],
	['Alt', 'Shift', 'KeyA'],
	['Alt', 'Shift', 'KeyP'],
];

/**
 * Normalized combinations the page uses for scrolling or extending a text selection
 * (`Shift` plus Space, an arrow, Home, End, PageUp or PageDown); they can be assigned,
 * with a warning.
 */
export const TEXT_NAVIGATION_SHORTCUTS: readonly (readonly string[])[] = [
	'Space',
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'Home',
	'End',
	'PageUp',
	'PageDown',
].map((code) => ['Shift', code]);
