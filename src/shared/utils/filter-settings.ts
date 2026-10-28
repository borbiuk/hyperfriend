import { FILTER_CHIPS } from '@shared/constants';

/**
 * Reads the chip list of untrusted data (storage, imported file): known ids only (the catalog and
 * the given custom ids), without repeats, in the order of the list.
 *
 * @param value - The list.
 * @param customIds - Ids of the custom chips that exist.
 * @returns The ids, or `null` when the value is not an array.
 */
export function normalizeFilterChips(
	value: unknown,
	customIds: readonly string[] = []
): string[] | null {
	if (!Array.isArray(value)) {
		return null;
	}

	const known = new Set<string>([
		...FILTER_CHIPS.map((chip) => chip.id),
		...customIds,
	]);
	const ids: string[] = [];
	for (const id of value) {
		if (typeof id === 'string' && known.has(id) && !ids.includes(id)) {
			ids.push(id);
		}
	}

	return ids;
}
