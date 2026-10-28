import {
	CHIP_COLOURS,
	CUSTOM_CHIP_ICONS,
	CUSTOM_CHIP_ID_REGEX,
	FILTER_CHIPS,
	MAX_CUSTOM_CHIPS,
	MAX_CUSTOM_LABEL_BYTES,
	MAX_CUSTOM_LABEL_LENGTH,
	MAX_CUSTOM_QUERY_BYTES,
	MAX_CUSTOM_QUERY_LENGTH,
	MAX_CUSTOM_QUERY_TOKENS,
	ROLE_FACETS,
} from '@shared/constants';
import {
	ChipColour,
	CustomChipModel,
	FilterChipModel,
	FiltersModel,
} from '@shared/models';

import {
	getTokenKey,
	isGroupToken,
	joinQuery,
	tokenizeQuery,
} from './filter-query';

/** Qualifiers that take one value: a chip with one replaces the others of the same key. */
const SINGLE_VALUE_KEYS = [
	'status',
	'review',
	'base',
	'head',
	'milestone',
	'project',
	'sort',
	'language',
];

/** State words: a chip with one replaces the others and the `state:open` GitHub starts a list with. */
const STATE_TOKENS = [
	'is:open',
	'is:closed',
	'is:merged',
	'is:unmerged',
	'state:open',
	'state:closed',
	'state:merged',
];

/** Control characters (tabs, line breaks, line separators and the bidirectional controls), not allowed in names and filters. */
const CONTROL_CHARS_REGEX =
	// eslint-disable-next-line no-control-regex
	/[\u0000-\u001F\u007F\u2028\u2029\u202A-\u202E\u2066-\u2069]/;

/**
 * Returns the size of a text as `chrome.storage.sync` counts it: the UTF-8 bytes of its JSON string
 * (a quotation mark and a backslash take two), without the surrounding quotation marks.
 */
function byteLength(text: string): number {
	return new TextEncoder().encode(JSON.stringify(text)).length - 2;
}

/** Words that only restate the list: a chip with one would remove it from the search when turned off. */
const RESTATING_TOKENS = ['is:pr', 'is:issue', 'type:pr', 'type:issue'];

/** The shape of an icon name read from storage (a later version may have more icons). */
const ICON_SHAPE_REGEX = /^[a-z0-9-]{1,40}$/;

/** Result of reading the filter of a custom chip. */
export type CustomQueryResult =
	| { ok: true; tokens: string[]; query: string }
	| { ok: false; error: string };

/** Result of checking a custom chip. */
export type CustomChipResult =
	{ ok: true; chip: CustomChipModel } | { ok: false; error: string };

/**
 * Reads the filter of a custom chip: GitHub search words separated by spaces. Only the shape is
 * checked (GitHub decides which qualifiers exist): up to MAX_CUSTOM_QUERY_LENGTH characters and
 * MAX_CUSTOM_QUERY_TOKENS words, closed quotation marks, no control characters.
 *
 * @param text - Text typed by the user, or untrusted data from storage or a file.
 * @returns The words and the cleaned text (single spaces), or a short user-facing error.
 */
export function parseCustomQuery(text: unknown): CustomQueryResult {
	if (typeof text !== 'string' || text.trim() === '') {
		return { ok: false, error: 'Enter at least one search word.' };
	}

	const trimmed = text.trim();
	if (CONTROL_CHARS_REGEX.test(trimmed)) {
		return { ok: false, error: 'Use a single line of text.' };
	}

	if (trimmed.length > MAX_CUSTOM_QUERY_LENGTH) {
		return {
			ok: false,
			error: `Use up to ${MAX_CUSTOM_QUERY_LENGTH} characters.`,
		};
	}

	if (byteLength(trimmed) > MAX_CUSTOM_QUERY_BYTES) {
		return {
			ok: false,
			error: `Use a shorter filter (up to ${MAX_CUSTOM_QUERY_BYTES} bytes: letters outside the English alphabet count double).`,
		};
	}

	if ((trimmed.match(/"/g) ?? []).length % 2 !== 0) {
		return { ok: false, error: 'Close the quotation mark.' };
	}

	const words = tokenizeQuery(trimmed);
	if (words.some((word) => isGroupToken(word))) {
		return {
			ok: false,
			error: 'Groups (parentheses, OR, AND, NOT) are not supported.',
		};
	}

	if (words.some((word) => RESTATING_TOKENS.includes(word.toLowerCase()))) {
		return {
			ok: false,
			error: 'The list is already Pull Requests; leave out is:pr.',
		};
	}

	// A word typed twice is added once
	const tokens = words.filter(
		(word, index) =>
			words.findIndex(
				(other) => other.toLowerCase() === word.toLowerCase()
			) === index
	);
	if (tokens.length > MAX_CUSTOM_QUERY_TOKENS) {
		return {
			ok: false,
			error: `Use up to ${MAX_CUSTOM_QUERY_TOKENS} search words.`,
		};
	}

	return { ok: true, tokens, query: joinQuery(tokens) };
}

/**
 * Reads the name of a custom chip: one line, up to MAX_CUSTOM_LABEL_LENGTH characters.
 *
 * @returns The trimmed name, or `null` when it is not valid.
 */
export function parseCustomLabel(text: unknown): string | null {
	if (typeof text !== 'string') {
		return null;
	}

	const label = text.trim();
	if (
		label === '' ||
		label.length > MAX_CUSTOM_LABEL_LENGTH ||
		byteLength(label) > MAX_CUSTOM_LABEL_BYTES ||
		CONTROL_CHARS_REGEX.test(label)
	) {
		return null;
	}

	return label;
}

/**
 * Checks a custom chip of untrusted data (storage, an imported file) and cleans it.
 *
 * @param lenient - For data read from storage: an icon this build does not know (a later version
 *   may have more) is kept, and an unknown colour becomes `default`, so a chip made by a newer
 *   version is not lost when this one writes the settings. The import and the popup are strict.
 * @returns The chip with a trimmed name and a cleaned filter, or a user-facing error.
 */
export function validateCustomChip(
	raw: unknown,
	lenient = false
): CustomChipResult {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return { ok: false, error: 'A custom chip is not valid.' };
	}

	const { id, label, icon, colour, query } = raw as Record<string, unknown>;
	const name = parseCustomLabel(label);
	const shown = name ?? 'a chip';
	if (typeof id !== 'string' || !CUSTOM_CHIP_ID_REGEX.test(id)) {
		return { ok: false, error: `Custom chip "${shown}" has no valid id.` };
	}

	if (name === null) {
		return {
			ok: false,
			error: `The name of custom chip "${id}" must be one line of up to ${MAX_CUSTOM_LABEL_LENGTH} characters.`,
		};
	}

	const knownIcon =
		typeof icon === 'string' && CUSTOM_CHIP_ICONS.includes(icon);
	if (
		typeof icon !== 'string' ||
		!(knownIcon || (lenient && ICON_SHAPE_REGEX.test(icon)))
	) {
		return {
			ok: false,
			error: `Custom chip "${name}" has an unknown icon.`,
		};
	}

	const knownColour = CHIP_COLOURS.includes(colour as ChipColour);
	if (!knownColour && !lenient) {
		return {
			ok: false,
			error: `Custom chip "${name}" has an unknown colour.`,
		};
	}

	const parsed = parseCustomQuery(query);
	if (!parsed.ok) {
		return {
			ok: false,
			error: `The filter of custom chip "${name}" is not valid: ${parsed.error}`,
		};
	}

	return {
		ok: true,
		chip: {
			id,
			label: name,
			icon,
			colour: knownColour ? (colour as ChipColour) : 'default',
			query: parsed.query,
		},
	};
}

/**
 * Reads the custom chips of data from storage leniently (see validateCustomChip): invalid chips and
 * repeated ids are dropped, at most MAX_CUSTOM_CHIPS are kept.
 *
 * @returns The chips, or `null` when the value is not an array.
 */
export function normalizeCustomChips(value: unknown): CustomChipModel[] | null {
	if (!Array.isArray(value)) {
		return null;
	}

	const chips: CustomChipModel[] = [];
	for (const raw of value) {
		const result = validateCustomChip(raw, true);
		if (!result.ok || chips.some((chip) => chip.id === result.chip.id)) {
			continue;
		}

		chips.push(result.chip);
	}

	return chips.slice(0, MAX_CUSTOM_CHIPS);
}

/**
 * Works out which tokens a custom chip replaces when it turns on, so it does not clash with what
 * is already in the search text: the "who" words replace each other, single-value qualifiers
 * replace their own key, state words replace each other and the default `state:open`. Everything
 * else (`label:`, `repo:`, free text) is added next to the rest.
 */
export function deriveFacets(tokens: readonly string[]): {
	facets: string[];
	facetTokens: string[];
} {
	const facets = new Set<string>();
	let state = false;
	for (const token of tokens) {
		const key = getTokenKey(token);
		if (ROLE_FACETS.includes(key)) {
			ROLE_FACETS.forEach((facet) => facets.add(facet));
		}

		if (SINGLE_VALUE_KEYS.includes(key)) {
			facets.add(key);
		}

		if (STATE_TOKENS.includes(token.toLowerCase())) {
			state = true;
		}
	}

	return { facets: [...facets], facetTokens: state ? [...STATE_TOKENS] : [] };
}

/**
 * Turns a custom chip into the shape the catalog chips have, so the bar and the query logic
 * treat both the same way.
 */
export function toChipModel(custom: CustomChipModel): FilterChipModel {
	const tokens = tokenizeQuery(custom.query);

	return {
		id: custom.id,
		kind: 'tokens',
		label: custom.label,
		description: `Adds ${custom.query}`,
		icon: custom.icon,
		colour: custom.colour,
		tokens,
		...deriveFacets(tokens),
	};
}

/**
 * Builds the chips of the bar: the ids of `filters.chips` in their order, each one a catalog chip or
 * a custom chip. Ids that match neither are skipped.
 */
export function resolveChips(filters: FiltersModel): FilterChipModel[] {
	const chips: FilterChipModel[] = [];
	for (const id of filters.chips) {
		const builtIn = FILTER_CHIPS.find((chip) => chip.id === id);
		if (builtIn) {
			chips.push(builtIn);
			continue;
		}

		const custom = filters.custom.find((chip) => chip.id === id);
		if (custom) {
			chips.push(toChipModel(custom));
		}
	}

	return chips;
}
