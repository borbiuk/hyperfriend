import {
	DraftState,
	FilterChipId,
	FilterChipModel,
	FiltersModel,
} from '@shared/models';

/**
 * Query GitHub shows in the search box of a Pull Request list that has no `q` in its URL.
 */
export const DEFAULT_QUERY = 'is:pr state:open';

/** Query parameter that holds the search text. */
const QUERY_PARAM = 'q';

/** Query parameter of the page number, dropped when the query changes. */
const PAGE_PARAM = 'page';

/** Tokens that mean "without drafts". */
const HIDE_DRAFTS_TOKENS = ['-is:draft', 'draft:false'];

/** Tokens that mean "only drafts". */
const ONLY_DRAFTS_TOKENS = ['is:draft', 'draft:true'];

/** Token the drafts chip writes for each state (`any` writes nothing). */
const DRAFT_STATE_TOKENS: Record<DraftState, string[]> = {
	any: [],
	hide: ['-is:draft'],
	only: ['is:draft'],
};

/** A token of a grouped query: a parenthesis or a boolean operator */
const GROUP_TOKEN_REGEX = /[()]|^(?:OR|AND|NOT)$/;

/**
 * Returns true for a token that belongs to a group: a parenthesis or `OR`, `AND`, `NOT`.
 */
export function isGroupToken(token: string): boolean {
	return GROUP_TOKEN_REGEX.test(token);
}

/** The next state when the drafts chip is clicked. */
const NEXT_DRAFT_STATE: Record<DraftState, DraftState> = {
	any: 'hide',
	hide: 'only',
	only: 'any',
};

/**
 * Splits a search query into tokens at spaces outside double quotes,
 * so `label:"good first issue"` stays one token.
 *
 * @param query - Search text.
 * @returns The tokens, without empty ones.
 */
export function tokenizeQuery(query: string): string[] {
	const tokens: string[] = [];
	let current = '';
	let quoted = false;

	for (const char of query) {
		if (char === '"') {
			quoted = !quoted;
			current += char;
			continue;
		}

		if (/\s/.test(char) && !quoted) {
			if (current) {
				tokens.push(current);
			}
			current = '';
			continue;
		}

		current += char;
	}

	if (current) {
		tokens.push(current);
	}

	return tokens;
}

/**
 * Joins tokens into a search query.
 */
export function joinQuery(tokens: readonly string[]): string {
	return tokens.join(' ');
}

/**
 * Returns the key of a token: its qualifier in lower case with the leading `-` kept
 * (`-is:draft` has the key `-is`, `review:none` has `review`).
 *
 * @returns An empty string for free text, which belongs to no qualifier.
 */
export function getTokenKey(token: string): string {
	const colon = token.indexOf(':');
	if (colon <= 0) {
		return '';
	}

	return token.slice(0, colon).toLowerCase();
}

/**
 * Returns true when both tokens are the same, ignoring case (GitHub ignores it in qualifiers).
 */
function sameToken(first: string, second: string): boolean {
	return first.toLowerCase() === second.toLowerCase();
}

/**
 * Returns true when the list holds the token.
 */
function hasToken(tokens: readonly string[], token: string): boolean {
	return tokens.some((existing) => sameToken(existing, token));
}

/**
 * Returns the tokens without the ones that match any of the given tokens.
 */
function withoutTokens(
	tokens: readonly string[],
	removed: readonly string[]
): string[] {
	return tokens.filter((token) => !hasToken(removed, token));
}

/**
 * Reads the state of the drafts chip from the tokens of a query.
 * `draft:false` and `draft:true` count like `-is:draft` and `is:draft`.
 */
export function getDraftState(tokens: readonly string[]): DraftState {
	if (tokens.some((token) => hasToken(HIDE_DRAFTS_TOKENS, token))) {
		return 'hide';
	}

	if (tokens.some((token) => hasToken(ONLY_DRAFTS_TOKENS, token))) {
		return 'only';
	}

	return 'any';
}

/**
 * Returns the tokens with the drafts state set: every draft token is replaced by the one of the state.
 */
export function setDraftState(
	tokens: readonly string[],
	state: DraftState
): string[] {
	const others = withoutTokens(tokens, [
		...HIDE_DRAFTS_TOKENS,
		...ONLY_DRAFTS_TOKENS,
	]);

	return [...others, ...DRAFT_STATE_TOKENS[state]];
}

/**
 * Returns the state the drafts chip switches to when it is clicked: all, without drafts, only drafts.
 */
export function nextDraftState(state: DraftState): DraftState {
	return NEXT_DRAFT_STATE[state];
}

/**
 * Returns true when the query is filtered by the chip: all its tokens are present;
 * for the drafts chip, when drafts are hidden or the only ones shown.
 */
export function isChipActive(
	chip: FilterChipModel,
	tokens: readonly string[]
): boolean {
	if (chip.kind === 'drafts') {
		return getDraftState(tokens) !== 'any';
	}

	if (chip.tokens.length === 0) {
		return false;
	}

	return chip.tokens.every((token) => hasToken(tokens, token));
}

/**
 * Returns the tokens after a click on the chip.
 * An active chip removes its tokens. An inactive one first removes the tokens of its facets,
 * so `author:@me` makes room for `review-requested:@me`, then adds its own tokens.
 * The drafts chip goes to the next state.
 */
export function toggleChip(
	chip: FilterChipModel,
	tokens: readonly string[]
): string[] {
	if (chip.kind === 'drafts') {
		return setDraftState(tokens, nextDraftState(getDraftState(tokens)));
	}

	const chipTokens = chip.tokens;
	if (chipTokens.length === 0) {
		return [...tokens];
	}

	if (isChipActive(chip, tokens)) {
		return withoutTokens(tokens, chipTokens);
	}

	// In a grouped query (`(is:draft OR status:failure)`) a token can not be taken out alone
	const grouped = tokens.some((token) => isGroupToken(token));
	const facets = new Set(grouped ? [] : chip.facets);
	const facetTokens = grouped ? [] : chip.facetTokens;
	const kept = tokens.filter(
		(token) =>
			!facets.has(getTokenKey(token)) && !hasToken(facetTokens, token)
	);
	const added = chipTokens.filter((token) => !hasToken(kept, token));

	return [...kept, ...added];
}

/**
 * State of the sticky chips as the user left it.
 */
export interface RememberedFilterState {
	drafts: DraftState;
}

/**
 * Applies the remembered state of the drafts chip to a query.
 * It counts only when the chip is shown and its sticky setting is on. The query is left alone when
 * it already has a draft token.
 *
 * @returns The new tokens, or `null` when nothing has to change.
 */
export function applyRememberedState(
	tokens: readonly string[],
	remembered: RememberedFilterState,
	filters: FiltersModel
): string[] | null {
	const sticky =
		filters.sticky.drafts && filters.chips.includes(FilterChipId.Drafts);
	if (
		!sticky ||
		remembered.drafts === 'any' ||
		getDraftState(tokens) !== 'any'
	) {
		return null;
	}

	return setDraftState(tokens, remembered.drafts);
}

/**
 * Reads the search text from the query string of a URL.
 *
 * @param search - `location.search`.
 * @returns The `q` parameter, or `null` when the URL has none.
 */
export function readQuery(search: string): string | null {
	return new URLSearchParams(search).get(QUERY_PARAM);
}

/**
 * Builds the query string with a new search text. Other parameters stay;
 * the page number is dropped, because the result list changes.
 *
 * @param search - `location.search` of the current page.
 * @param tokens - Tokens of the new search text.
 * @returns A query string that starts with `?`.
 */
export function buildSearch(search: string, tokens: readonly string[]): string {
	const params = new URLSearchParams(search);
	params.set(QUERY_PARAM, joinQuery(tokens));
	params.delete(PAGE_PARAM);

	return `?${params.toString()}`;
}
