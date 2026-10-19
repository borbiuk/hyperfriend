/**
 * Key combination of one shortcut and whether it is active.
 */
export interface ShortcutBindingModel {
	/**
	 * Normalized combination: modifiers in the order `Control`, `Alt`, `Shift`, `Meta`,
	 * then exactly one `KeyboardEvent.code` of a non-modifier key, e.g. `['Shift', 'KeyC']`.
	 */
	keys: string[];

	/** A disabled shortcut keeps its `keys`, so enabling it again restores the user's combination */
	enabled: boolean;
}
