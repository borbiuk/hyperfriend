import { expect, test } from '@playwright/test';
import { ShortcutBindingModel, ShortcutType } from '@shared/models';
import {
	formatShortcut,
	formatShortcutParts,
	isReservedShortcut,
	matchesShortcut,
	normalizeShortcut,
	shortcutFromEvent,
	shortcutsEqual,
	ShortcutEventLike,
	ShortcutValidationResult,
	toAriaKeyShortcuts,
	validateShortcut,
} from '@shared/utils';

/** Modifier flags of a key press; missing ones are not pressed */
type Modifiers = Partial<
	Pick<ShortcutEventLike, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>
>;

/**
 * Key press with the given `code` and modifiers.
 *
 * @param code - `KeyboardEvent.code` of the pressed key.
 * @param modifiers - Pressed modifiers.
 */
function keyPress(code: string, modifiers: Modifiers = {}): ShortcutEventLike {
	return {
		code,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		metaKey: false,
		...modifiers,
	};
}

test.describe('shortcutFromEvent', () => {
	const CASES: {
		title: string;
		event: ShortcutEventLike;
		expected: string[] | null;
	}[] = [
		{
			title: 'should read Shift+KeyC',
			event: keyPress('KeyC', { shiftKey: true }),
			expected: ['Shift', 'KeyC'],
		},
		{
			title: 'should put all four modifiers of a KeyK press in canonical order',
			event: keyPress('KeyK', {
				metaKey: true,
				shiftKey: true,
				altKey: true,
				ctrlKey: true,
			}),
			expected: ['Control', 'Alt', 'Shift', 'Meta', 'KeyK'],
		},
		{
			title: 'should read a KeyC press without modifiers',
			event: keyPress('KeyC'),
			expected: ['KeyC'],
		},
		{
			title: 'should read Alt+F24',
			event: keyPress('F24', { altKey: true }),
			expected: ['Alt', 'F24'],
		},
		{
			title: 'should read Control+NumpadAdd',
			event: keyPress('NumpadAdd', { ctrlKey: true }),
			expected: ['Control', 'NumpadAdd'],
		},
		{
			title: 'should return null for a lone ShiftLeft press',
			event: keyPress('ShiftLeft', { shiftKey: true }),
			expected: null,
		},
		{
			title: 'should return null for Shift+Escape',
			event: keyPress('Escape', { shiftKey: true }),
			expected: null,
		},
		{
			title: 'should return null for Shift+Tab',
			event: keyPress('Tab', { shiftKey: true }),
			expected: null,
		},
		{
			title: 'should return null for an empty code',
			event: keyPress('', { shiftKey: true }),
			expected: null,
		},
	];

	for (const c of CASES) {
		test(c.title, () => {
			expect(shortcutFromEvent(c.event)).toEqual(c.expected);
		});
	}
});

test.describe('normalizeShortcut', () => {
	const CASES: {
		title: string;
		value: unknown;
		expected: string[] | null;
	}[] = [
		{
			title: 'should keep ["Shift", "KeyC"]',
			value: ['Shift', 'KeyC'],
			expected: ['Shift', 'KeyC'],
		},
		{
			title: 'should order ["Meta", "Shift", "Alt", "Control", "KeyK"] canonically',
			value: ['Meta', 'Shift', 'Alt', 'Control', 'KeyK'],
			expected: ['Control', 'Alt', 'Shift', 'Meta', 'KeyK'],
		},
		{
			title: 'should move the main key of ["KeyC", "Shift"] last',
			value: ['KeyC', 'Shift'],
			expected: ['Shift', 'KeyC'],
		},
		{
			title: 'should accept ["Control", "Alt", "KeyC"], which the browser does not use',
			value: ['Control', 'Alt', 'KeyC'],
			expected: ['Control', 'Alt', 'KeyC'],
		},
		{
			title: 'should reject ["KeyC"] without a modifier',
			value: ['KeyC'],
			expected: null,
		},
		{
			title: 'should reject the browser-reserved ["Control", "KeyC"]',
			value: ['Control', 'KeyC'],
			expected: null,
		},
		{
			title: 'should reject the browser-reserved ["Meta", "KeyV"]',
			value: ['Meta', 'KeyV'],
			expected: null,
		},
		{
			title: 'should reject the browser-reserved ["Meta", "Shift", "KeyZ"] in any order',
			value: ['Meta', 'Shift', 'KeyZ'],
			expected: null,
		},
		{
			title: 'should reject the browser-reserved ["Alt", "ArrowLeft"]',
			value: ['Alt', 'ArrowLeft'],
			expected: null,
		},
		{
			title: 'should reject the developer tools shortcut ["Meta", "Alt", "KeyI"] in any order',
			value: ['Meta', 'Alt', 'KeyI'],
			expected: null,
		},
		{
			title: 'should reject the browser-reserved ["Control", "Shift", "PageDown"]',
			value: ['Control', 'Shift', 'PageDown'],
			expected: null,
		},
		{
			title: 'should reject the repeated modifier of ["Shift", "Shift", "KeyC"]',
			value: ['Shift', 'Shift', 'KeyC'],
			expected: null,
		},
		{
			title: 'should reject the two main keys of ["Shift", "KeyC", "KeyV"]',
			value: ['Shift', 'KeyC', 'KeyV'],
			expected: null,
		},
		{
			title: 'should reject ["Shift"] without a main key',
			value: ['Shift'],
			expected: null,
		},
		{
			title: 'should reject the disallowed main key of ["Shift", "Escape"]',
			value: ['Shift', 'Escape'],
			expected: null,
		},
		{
			title: 'should reject the key name instead of the code in ["Shift", "c"]',
			value: ['Shift', 'c'],
			expected: null,
		},
		{
			title: 'should reject the number in ["Shift", 67]',
			value: ['Shift', 67],
			expected: null,
		},
		{
			title: 'should reject an empty array',
			value: [],
			expected: null,
		},
		{
			title: 'should reject the string "Shift+KeyC"',
			value: 'Shift+KeyC',
			expected: null,
		},
		{
			title: 'should reject null',
			value: null,
			expected: null,
		},
		{
			title: 'should reject an object',
			value: { keys: ['Shift', 'KeyC'] },
			expected: null,
		},
	];

	for (const c of CASES) {
		test(c.title, () => {
			expect(normalizeShortcut(c.value)).toEqual(c.expected);
		});
	}
});

test.describe('shortcutsEqual', () => {
	const CASES: {
		title: string;
		a: string[];
		b: string[];
		expected: boolean;
	}[] = [
		{
			title: 'should ignore the modifier order of ["Shift", "Alt", "KeyC"] and ["Alt", "Shift", "KeyC"]',
			a: ['Shift', 'Alt', 'KeyC'],
			b: ['Alt', 'Shift', 'KeyC'],
			expected: true,
		},
		{
			title: 'should tell ["Shift", "KeyC"] from ["Shift", "KeyV"]',
			a: ['Shift', 'KeyC'],
			b: ['Shift', 'KeyV'],
			expected: false,
		},
		{
			title: 'should tell ["Shift", "KeyC"] from ["Control", "Shift", "KeyC"]',
			a: ['Shift', 'KeyC'],
			b: ['Control', 'Shift', 'KeyC'],
			expected: false,
		},
		{
			title: 'should tell ["KeyC"] from ["Shift", "KeyC"]',
			a: ['KeyC'],
			b: ['Shift', 'KeyC'],
			expected: false,
		},
	];

	for (const c of CASES) {
		test(c.title, () => {
			expect(shortcutsEqual(c.a, c.b)).toBe(c.expected);
		});
	}
});

test.describe('matchesShortcut', () => {
	const CASES: {
		title: string;
		event: ShortcutEventLike;
		keys: string[];
		expected: boolean;
	}[] = [
		{
			title: 'should match Shift+KeyC to ["Shift", "KeyC"]',
			event: keyPress('KeyC', { shiftKey: true }),
			keys: ['Shift', 'KeyC'],
			expected: true,
		},
		{
			title: 'should match Alt+Shift+KeyK to ["Shift", "Alt", "KeyK"] in any order',
			event: keyPress('KeyK', { altKey: true, shiftKey: true }),
			keys: ['Shift', 'Alt', 'KeyK'],
			expected: true,
		},
		{
			title: 'should not match Control+Shift+KeyC to ["Shift", "KeyC"]',
			event: keyPress('KeyC', { ctrlKey: true, shiftKey: true }),
			keys: ['Shift', 'KeyC'],
			expected: false,
		},
		{
			title: 'should not match a KeyC press without Shift to ["Shift", "KeyC"]',
			event: keyPress('KeyC'),
			keys: ['Shift', 'KeyC'],
			expected: false,
		},
		{
			title: 'should not match Shift+KeyV to ["Shift", "KeyC"]',
			event: keyPress('KeyV', { shiftKey: true }),
			keys: ['Shift', 'KeyC'],
			expected: false,
		},
		{
			title: 'should not match a lone ShiftLeft press to ["Shift", "KeyC"]',
			event: keyPress('ShiftLeft', { shiftKey: true }),
			keys: ['Shift', 'KeyC'],
			expected: false,
		},
	];

	for (const c of CASES) {
		test(c.title, () => {
			expect(matchesShortcut(c.event, c.keys)).toBe(c.expected);
		});
	}
});

test.describe('formatShortcutParts', () => {
	const CASES: { keys: string[]; mac: string[]; other: string[] }[] = [
		{ keys: ['Shift', 'KeyC'], mac: ['⇧', 'C'], other: ['Shift', 'C'] },
		{
			keys: ['Control', 'Alt', 'Shift', 'Meta', 'KeyK'],
			mac: ['⌃', '⌥', '⇧', '⌘', 'K'],
			other: ['Ctrl', 'Alt', 'Shift', 'Win', 'K'],
		},
		{ keys: ['Alt', 'Digit5'], mac: ['⌥', '5'], other: ['Alt', '5'] },
		{ keys: ['Shift', 'F5'], mac: ['⇧', 'F5'], other: ['Shift', 'F5'] },
		{ keys: ['Shift', 'ArrowUp'], mac: ['⇧', '↑'], other: ['Shift', '↑'] },
		{
			keys: ['Control', 'Numpad1'],
			mac: ['⌃', 'Num 1'],
			other: ['Ctrl', 'Num 1'],
		},
		{
			keys: ['Control', 'NumpadAdd'],
			mac: ['⌃', 'Num +'],
			other: ['Ctrl', 'Num +'],
		},
		{ keys: ['Shift', 'Slash'], mac: ['⇧', '/'], other: ['Shift', '/'] },
		{ keys: ['Alt', 'Backslash'], mac: ['⌥', '\\'], other: ['Alt', '\\'] },
		{
			keys: ['Alt', 'Space'],
			mac: ['⌥', 'Space'],
			other: ['Alt', 'Space'],
		},
		{ keys: ['Alt', 'Backspace'], mac: ['⌥', '⌫'], other: ['Alt', '⌫'] },
		{ keys: ['Alt', 'Delete'], mac: ['⌥', 'Del'], other: ['Alt', 'Del'] },
		{
			keys: ['Alt', 'PageDown'],
			mac: ['⌥', 'PgDn'],
			other: ['Alt', 'PgDn'],
		},
	];

	for (const c of CASES) {
		test(`should show ${JSON.stringify(c.keys)} with macOS symbols`, () => {
			expect(formatShortcutParts(c.keys, true)).toEqual(c.mac);
		});

		test(`should show ${JSON.stringify(c.keys)} with key names on other platforms`, () => {
			expect(formatShortcutParts(c.keys, false)).toEqual(c.other);
		});
	}
});

test.describe('formatShortcut', () => {
	const CASES: { keys: string[]; mac: string; other: string }[] = [
		{ keys: ['Shift', 'KeyC'], mac: '⇧C', other: 'Shift+C' },
		{ keys: ['Control', 'Alt', 'KeyK'], mac: '⌃⌥K', other: 'Ctrl+Alt+K' },
		{ keys: ['Alt', 'NumpadAdd'], mac: '⌥Num +', other: 'Alt+Num +' },
	];

	for (const c of CASES) {
		test(`should join ${JSON.stringify(c.keys)} without a separator on macOS`, () => {
			expect(formatShortcut(c.keys, true)).toBe(c.mac);
		});

		test(`should join ${JSON.stringify(c.keys)} with "+" on other platforms`, () => {
			expect(formatShortcut(c.keys, false)).toBe(c.other);
		});
	}
});

test.describe('toAriaKeyShortcuts', () => {
	const CASES: { keys: string[]; expected: string }[] = [
		{ keys: ['Shift', 'KeyC'], expected: 'Shift+C' },
		{ keys: ['Control', 'Alt', 'KeyK'], expected: 'Control+Alt+K' },
		{ keys: ['Shift', 'Meta', 'ArrowUp'], expected: 'Shift+Meta+ArrowUp' },
		{ keys: ['Alt', 'Digit5'], expected: 'Alt+5' },
		{ keys: ['Control', 'Numpad7'], expected: 'Control+7' },
		{ keys: ['Control', 'NumpadAdd'], expected: 'Control+Plus' },
		{ keys: ['Alt', 'NumpadEnter'], expected: 'Alt+Enter' },
		{ keys: ['Alt', 'Equal'], expected: 'Alt+=' },
		{ keys: ['Shift', 'Slash'], expected: 'Shift+/' },
		{ keys: ['Alt', 'F5'], expected: 'Alt+F5' },
		{ keys: ['Alt', 'Space'], expected: 'Alt+Space' },
		{ keys: ['Alt', 'Delete'], expected: 'Alt+Delete' },
	];

	for (const c of CASES) {
		test(`should name ${JSON.stringify(c.keys)} "${c.expected}"`, () => {
			expect(toAriaKeyShortcuts(c.keys)).toBe(c.expected);
		});
	}
});

test.describe('isReservedShortcut', () => {
	const CASES: { keys: string[]; expected: boolean }[] = [
		{ keys: ['Control', 'KeyC'], expected: true },
		{ keys: ['Meta', 'KeyC'], expected: true },
		{ keys: ['Shift', 'Meta', 'KeyT'], expected: true },
		{ keys: ['Meta', 'Shift', 'KeyT'], expected: true },
		{ keys: ['Control', 'Shift', 'Digit1'], expected: true },
		{ keys: ['Meta', 'BracketLeft'], expected: true },
		{ keys: ['Control', 'PageUp'], expected: true },
		{ keys: ['Alt', 'ArrowRight'], expected: true },
		{ keys: ['Control', 'Shift', 'KeyI'], expected: true },
		{ keys: ['Alt', 'Meta', 'KeyI'], expected: true },
		{ keys: ['Alt', 'Meta', 'KeyJ'], expected: true },
		{ keys: ['Alt', 'Meta', 'KeyC'], expected: true },
		{ keys: ['Control', 'Shift', 'KeyB'], expected: true },
		{ keys: ['Shift', 'Meta', 'KeyB'], expected: true },
		{ keys: ['Control', 'Shift', 'Delete'], expected: true },
		{ keys: ['Shift', 'Meta', 'Backspace'], expected: true },
		{ keys: ['Alt', 'KeyI'], expected: false },
		{ keys: ['Shift', 'KeyC'], expected: false },
		{ keys: ['Control', 'Alt', 'KeyC'], expected: false },
		{ keys: ['Control', 'KeyK'], expected: false },
		{ keys: ['Alt', 'KeyC'], expected: false },
	];

	for (const c of CASES) {
		test(`should ${c.expected ? '' : 'not '}treat ${JSON.stringify(c.keys)} as reserved by the browser`, () => {
			expect(isReservedShortcut(c.keys)).toBe(c.expected);
		});
	}
});

/** Bindings of every action: only Copy link, on Shift+C */
const BINDINGS: Record<ShortcutType, ShortcutBindingModel> = {
	[ShortcutType.CopyLink]: { keys: ['Shift', 'KeyC'], enabled: true },
};

/**
 * Pins the platform that isMacPlatform() reads (`navigator.platform`) for every test of the
 * enclosing describe, and restores Node's own navigator afterwards.
 *
 * @param platform - Value of `navigator.platform`.
 */
function usePlatform(platform: string): void {
	let original: PropertyDescriptor | undefined;

	test.beforeEach(() => {
		original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
		Object.defineProperty(globalThis, 'navigator', {
			configurable: true,
			value: { platform, userAgent: '' },
		});
	});

	test.afterEach(() => {
		if (original) {
			Object.defineProperty(globalThis, 'navigator', original);
		} else {
			Reflect.deleteProperty(globalThis, 'navigator');
		}
	});
}

test.describe('validateShortcut on macOS', () => {
	usePlatform('MacIntel');

	test('should ask for a macOS modifier when ["KeyC"] has none', () => {
		expect(
			validateShortcut(['KeyC'], ShortcutType.CopyLink, BINDINGS)
		).toEqual({
			ok: false,
			error: 'Add Shift, Option, Control or Command to the shortcut.',
		});
	});
});

test.describe('validateShortcut on Linux', () => {
	usePlatform('Linux x86_64');

	test('should ask for a modifier by its Windows and Linux name when ["KeyC"] has none', () => {
		expect(
			validateShortcut(['KeyC'], ShortcutType.CopyLink, BINDINGS)
		).toEqual({
			ok: false,
			error: 'Add Shift, Alt, Ctrl or Win to the shortcut.',
		});
	});

	const CASES: {
		title: string;
		keys: string[];
		expected: ShortcutValidationResult;
	}[] = [
		{
			title: 'should refuse the disallowed key of ["Shift", "Escape"]',
			keys: ['Shift', 'Escape'],
			expected: {
				ok: false,
				error: "This key can't be used in a shortcut.",
			},
		},
		{
			title: 'should refuse the repeated modifier of ["Shift", "Shift", "KeyC"]',
			keys: ['Shift', 'Shift', 'KeyC'],
			expected: {
				ok: false,
				error: "This key can't be used in a shortcut.",
			},
		},
		{
			title: 'should refuse an empty recording',
			keys: [],
			expected: {
				ok: false,
				error: "This key can't be used in a shortcut.",
			},
		},
		{
			title: 'should refuse the browser-reserved ["Control", "KeyC"]',
			keys: ['Control', 'KeyC'],
			expected: {
				ok: false,
				error: 'This shortcut is used by the browser.',
			},
		},
		{
			title: 'should refuse ["Shift", "Meta", "KeyP"], reserved by the browser and used by GitHub',
			keys: ['Shift', 'Meta', 'KeyP'],
			expected: {
				ok: false,
				error: 'This shortcut is used by the browser.',
			},
		},
		{
			title: 'should accept the GitHub shortcut ["Meta", "KeyK"] with a warning',
			keys: ['Meta', 'KeyK'],
			expected: { ok: true, warning: 'GitHub also uses this shortcut.' },
		},
		{
			title: 'should accept the GitHub shortcut ["Shift", "Slash"] with a warning',
			keys: ['Shift', 'Slash'],
			expected: { ok: true, warning: 'GitHub also uses this shortcut.' },
		},
		{
			title: 'should accept the text selection shortcut ["Shift", "ArrowDown"] with a warning',
			keys: ['Shift', 'ArrowDown'],
			expected: {
				ok: true,
				warning:
					'This shortcut is used for scrolling or selecting text.',
			},
		},
		{
			title: 'should accept ["Alt", "Shift", "KeyL"] without a warning',
			keys: ['Alt', 'Shift', 'KeyL'],
			expected: { ok: true },
		},
		{
			title: 'should accept ["KeyL", "Shift"] recorded out of order',
			keys: ['KeyL', 'Shift'],
			expected: { ok: true },
		},
		{
			title: 'should accept the keys the action already has',
			keys: ['Shift', 'KeyC'],
			expected: { ok: true },
		},
	];

	for (const c of CASES) {
		test(c.title, () => {
			expect(
				validateShortcut(c.keys, ShortcutType.CopyLink, BINDINGS)
			).toEqual(c.expected);
		});
	}

	// ShortcutType has one action only, so the conflict check is reached by validating the keys
	// for a not yet existing action against the Copy link binding.
	const NEW_ACTION = 'new-action' as ShortcutType;

	test('should refuse the keys of another enabled Hyperfriend shortcut', () => {
		expect(
			validateShortcut(['Shift', 'KeyC'], NEW_ACTION, BINDINGS)
		).toEqual({
			ok: false,
			error: 'Another Hyperfriend shortcut already uses these keys.',
		});
	});

	test('should refuse the keys of another enabled shortcut in a different modifier order', () => {
		const bindings: Record<ShortcutType, ShortcutBindingModel> = {
			[ShortcutType.CopyLink]: {
				keys: ['Alt', 'Shift', 'KeyL'],
				enabled: true,
			},
		};

		expect(
			validateShortcut(['Shift', 'Alt', 'KeyL'], NEW_ACTION, bindings)
		).toEqual({
			ok: false,
			error: 'Another Hyperfriend shortcut already uses these keys.',
		});
	});

	test('should accept the keys of another shortcut that is disabled', () => {
		const bindings: Record<ShortcutType, ShortcutBindingModel> = {
			[ShortcutType.CopyLink]: {
				keys: ['Shift', 'KeyC'],
				enabled: false,
			},
		};

		expect(
			validateShortcut(['Shift', 'KeyC'], NEW_ACTION, bindings)
		).toEqual({ ok: true });
	});
});
