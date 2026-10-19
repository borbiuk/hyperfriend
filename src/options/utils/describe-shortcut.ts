import {
	isMacPlatform,
	MODIFIER_KEYS,
	toAriaKeyShortcuts,
} from '@shared/utils';

/** Spoken names of the modifiers on macOS. */
const MAC_MODIFIER_NAMES: Record<string, string> = {
	Control: 'Control',
	Alt: 'Option',
	Shift: 'Shift',
	Meta: 'Command',
};

/** Spoken names of the modifiers elsewhere. */
const OTHER_MODIFIER_NAMES: Record<string, string> = {
	Control: 'Ctrl',
	Alt: 'Alt',
	Shift: 'Shift',
	Meta: 'Windows',
};

/** Spoken names of the arrow keys. */
const ARROW_NAMES: Record<string, string> = {
	ArrowUp: 'Up arrow',
	ArrowDown: 'Down arrow',
	ArrowLeft: 'Left arrow',
	ArrowRight: 'Right arrow',
};

/**
 * Returns the spoken name of a main key, e.g. `C`, `Up arrow`, `Numpad 1`, `Numpad Add`.
 */
function describeMainKey(code: string): string {
	if (code in ARROW_NAMES) {
		return ARROW_NAMES[code];
	}

	if (code.startsWith('Numpad')) {
		return `Numpad ${code.slice('Numpad'.length)}`;
	}

	return toAriaKeyShortcuts([code]);
}

/**
 * Describes a shortcut in words for screen readers (the visible `<kbd>` labels use
 * symbols such as `⇧` that are not read well).
 *
 * @param keys - Normalized shortcut.
 * @param isMac - Use macOS modifier names.
 * @returns E.g. `Shift C`, `Command Option Up arrow`, `Ctrl Numpad 1`.
 */
export function describeShortcut(
	keys: string[],
	isMac: boolean = isMacPlatform()
): string {
	const names = isMac ? MAC_MODIFIER_NAMES : OTHER_MODIFIER_NAMES;

	return keys
		.map((key) => {
			if ((MODIFIER_KEYS as readonly string[]).includes(key)) {
				return names[key];
			}

			return describeMainKey(key);
		})
		.join(' ');
}
