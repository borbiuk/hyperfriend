import {
	DraftState,
	FilterChipId,
	FilterChipModel,
	FiltersModel,
} from '@shared/models';
import {
	applyRememberedState,
	buildSearch,
	DEFAULT_QUERY,
	getDraftState,
	isChipActive,
	joinQuery,
	readQuery,
	tokenizeQuery,
	resolveChips,
	toggleChip,
} from '@shared/utils';

import { FilterBar, FilterBarChip } from '../components/filter-bar';

import { ConfigStore } from './config-store';
import { FilterStateStore } from './filter-state-store';
import { HydrationGuard } from './hydration-guard';
import { isPullRequestList } from './page-detector';

/** Areas of a list page that hold its content (the site header also has a search box) */
const CONTENT_SELECTOR =
	'[data-component="PageLayout"], main, [role="main"], #js-repo-pjax-container';

/** Search boxes: React lists (`role="search"`) and classic server-rendered lists */
const SEARCH_SELECTOR = '[role="search"]';

/** The search text field of the classic server-rendered lists */
const CLASSIC_INPUT_SELECTOR = 'input[name="q"]';

/** Repository Pull Request lists, whose search box starts with GitHub's default text */
const REPOSITORY_LIST_REGEX = /^\/[^/]+\/[^/]+\/pulls(?:\/|$)/;

/** A search text of a Pull Request list (other lists, such as Issues, have `is:issue`) */
const PULL_REQUEST_QUERY_REGEX = /(?:^|\s)is:pr(?:\s|$)/i;

/** sessionStorage key of the last address the sticky chips redirected to (loop guard) */
const REDIRECT_KEY = 'hyperfriend-filter-redirect';

/** The same redirect is not repeated within this time (GitHub may drop the tokens again) */
const REDIRECT_WINDOW_MS = 10_000;

/** A soft change of the address must show in the search box of the list within this time */
const SOFT_CHECK_MS = 2000;

/** The React app of a GitHub list: its router follows the address (see openAddress) */
const REACT_ROOT_SELECTOR = 'react-app';

/** Chip texts of the three states of the drafts chip */
const DRAFT_LABELS: Record<DraftState, string> = {
	any: 'Drafts: all',
	hide: 'Drafts: hidden',
	only: 'Drafts: only',
};

/**
 * Shows the quick filter chips on Pull Request lists and applies the remembered state of the
 * sticky chips. A click on a chip changes the `q` of the address and opens it, so the list is
 * always filtered by GitHub itself and the address is the only state of the page.
 */
export class FilterService {
	private readonly bar: FilterBar;

	/** The sticky chips are applied after the config and the remembered state are loaded */
	private started = false;

	/** Address whose search text was already checked against the remembered state */
	private checkedHref: string | null = null;

	/**
	 * @param config - Source of the filter settings.
	 * @param state - Remembered state of the sticky chips.
	 * @param hydration - Keeps the bar out of React roots that are not hydrated yet.
	 */
	constructor(
		private readonly config: ConfigStore,
		private readonly state: FilterStateStore,
		private readonly hydration: HydrationGuard
	) {
		this.bar = new FilterBar((id) => this.toggle(id));
		// Turbo keeps a copy of the page for Back: the bar must not be in it
		window.addEventListener('turbo:before-cache', () => this.detach());
	}

	/**
	 * Lets the sticky chips redirect. Call it when the config and the remembered state are loaded,
	 * before the first scan: with the defaults a redirect would use the wrong state.
	 */
	public start(): void {
		this.started = true;
	}

	/**
	 * Adds, updates or removes the bar for the current page; may redirect to apply the
	 * sticky chips. Idempotent: safe to call on every DOM change.
	 */
	public scan(): void {
		if (!isPullRequestList()) {
			this.bar.remove();
			this.checkedHref = null;
			return;
		}

		const filters = this.config.get().filters;
		const anchor = findSearch();
		const ready = anchor !== null && !this.hydration.isPending(anchor);
		if (this.started && this.applyRemembered(filters, ready)) {
			return;
		}

		const chips = resolveChips(filters);
		if (chips.length === 0 || !anchor) {
			this.bar.remove();
			return;
		}

		if (!ready) {
			return;
		}

		const tokens = readTokens(true) ?? [];
		this.bar.sync(
			anchor,
			chips.map((chip) => toBarChip(chip, tokens))
		);
	}

	/**
	 * Removes the bar, so Turbo does not keep it in its page snapshot.
	 */
	public detach(): void {
		this.bar.remove();
	}

	/**
	 * Opens the list with the chip toggled. A sticky chip remembers its new state first.
	 */
	private toggle(id: string): void {
		const filters = this.config.get().filters;
		const chip = resolveChips(filters).find((item) => item.id === id);
		if (!chip) {
			return;
		}

		// Without a search text on a page whose default is unknown (`/pulls` has its own) nothing is
		// opened: GitHub's default search of that page would be lost
		const tokens =
			readTokens(true) ??
			(REPOSITORY_LIST_REGEX.test(window.location.pathname)
				? tokenizeQuery(DEFAULT_QUERY)
				: null);
		if (!tokens) {
			return;
		}

		const next = toggleChip(chip, tokens);
		if (joinQuery(next) === joinQuery(tokens)) {
			return;
		}

		const remembered: { drafts: DraftState } = {
			drafts: getDraftState(next),
		};
		const changed =
			id === FilterChipId.Drafts &&
			filters.sticky.drafts &&
			remembered.drafts !== this.state.get().drafts;
		const target = `${window.location.pathname}${buildSearch(window.location.search, next)}`;
		// `set` never rejects; the address opens after the state is written. A write that changes
		// nothing is skipped: it would wake the scans of every other tab.
		void (changed ? this.state.set(remembered) : Promise.resolve()).finally(
			() => openAddress(target, next, false, true)
		);
	}

	/**
	 * Opens the same list again with the remembered state of the sticky drafts chip added, when the
	 * address has nothing about drafts yet. Each address is checked once: a change of the settings
	 * or of the remembered state in another tab must not reload this page.
	 *
	 * @param ready - The search box of the list is hydrated, so its text can be read.
	 * @returns `true` when the page is being replaced.
	 */
	private applyRemembered(filters: FiltersModel, ready: boolean): boolean {
		const href = window.location.href;
		if (this.checkedHref === href) {
			return false;
		}

		const tokens = readTokens(ready);
		if (!tokens) {
			// The search text is not known yet; the next scan tries again
			return false;
		}

		this.checkedHref = href;
		const next = applyRememberedState(tokens, this.state.get(), filters);
		if (!next) {
			return false;
		}

		const target = `${window.location.pathname}${buildSearch(window.location.search, next)}`;
		if (wasRedirectedTo(target)) {
			return false;
		}

		rememberRedirect(target);
		openAddress(target, next, true, ready);
		return true;
	}
}

/**
 * Opens an address of the list. On a React list the address is changed in place and GitHub's
 * router is told (`popstate`), so the list updates without a page load and the bar stays where it
 * is; a full load would remove the bar until the page is rendered again, and the list would jump.
 * When the search box does not show the new search text soon after (no router listens, as on the
 * classic lists), the page is loaded the usual way.
 *
 * @param target - Path and query string to open.
 * @param tokens - Tokens of the new search text.
 * @param replace - Replace the current history entry instead of adding one.
 * @param soft - The page is hydrated, so GitHub's router can take the change; before that a page load is needed.
 */
function openAddress(
	target: string,
	tokens: readonly string[],
	replace: boolean,
	soft: boolean
): void {
	const load = (): void => {
		if (replace) {
			window.location.replace(target);
			return;
		}

		window.location.assign(target);
	};
	if (!soft || !findSearch()?.closest(REACT_ROOT_SELECTOR)) {
		load();
		return;
	}

	if (replace) {
		window.history.replaceState(null, '', target);
	} else {
		window.history.pushState(null, '', target);
	}
	window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

	window.setTimeout(() => {
		const current = `${window.location.pathname}${window.location.search}`;
		// The user moved on, or the router has shown the new search text
		if (current !== target || boxShows(tokens)) {
			return;
		}

		load();
	}, SOFT_CHECK_MS);
}

/**
 * Returns true when the search box of the list shows exactly these tokens (in any order, ignoring
 * case), or when there is no box to compare.
 */
function boxShows(tokens: readonly string[]): boolean {
	const input = findSearch()?.querySelector('input');
	if (!input) {
		return true;
	}

	const norm = (list: readonly string[]): string =>
		[...list]
			.map((token) => token.toLowerCase())
			.sort()
			.join(' ');
	return norm(tokenizeQuery(input.value)) === norm(tokens);
}

/**
 * Builds what the bar shows for a chip on the page with the given query. The drafts chip
 * has three states, which its text tells; the others are toggles.
 */
function toBarChip(
	chip: FilterChipModel,
	tokens: readonly string[]
): FilterBarChip {
	const drafts = chip.kind === 'drafts';

	return {
		id: chip.id,
		label: drafts ? DRAFT_LABELS[getDraftState(tokens)] : chip.label,
		title: chip.description,
		icon: chip.icon,
		colour: chip.colour,
		active: isChipActive(chip, tokens),
		toggle: !drafts,
	};
}

/**
 * Finds the search box of the list (not the one of the site header).
 */
function findSearch(): Element | null {
	for (const search of document.querySelectorAll(SEARCH_SELECTOR)) {
		if (search.querySelector('input') && search.closest(CONTENT_SELECTOR)) {
			return search;
		}
	}

	return (
		document
			.querySelector(`main ${CLASSIC_INPUT_SELECTOR}`)
			?.closest('form') ?? null
	);
}

/**
 * Reads the tokens of the search text of the page: the `q` of the address, otherwise (when
 * `readBox`) what the search box shows, which is GitHub's default for the page and differs between
 * lists. The box counts only when it holds a Pull Request search: during a soft navigation it can
 * still be the box of the previous page.
 *
 * @param readBox - The search box is hydrated and may be read.
 * @returns `null` when the text is not known.
 */
function readTokens(readBox: boolean): string[] | null {
	const query = readQuery(window.location.search);
	if (query !== null && query.trim() !== '') {
		return tokenizeQuery(query);
	}

	if (!readBox) {
		return null;
	}

	const value = findSearch()?.querySelector('input')?.value.trim();
	return value && PULL_REQUEST_QUERY_REGEX.test(value)
		? tokenizeQuery(value)
		: null;
}

/**
 * Returns true when this tab redirected to the same address a moment ago, which means GitHub
 * dropped the tokens again and another redirect would loop.
 */
function wasRedirectedTo(target: string): boolean {
	try {
		const stored = window.sessionStorage.getItem(REDIRECT_KEY);
		if (!stored) {
			return false;
		}

		const { target: last, at } = JSON.parse(stored) as {
			target?: unknown;
			at?: unknown;
		};
		return (
			last === target &&
			typeof at === 'number' &&
			Date.now() - at < REDIRECT_WINDOW_MS
		);
	} catch {
		return false;
	}
}

function rememberRedirect(target: string): void {
	try {
		window.sessionStorage.setItem(
			REDIRECT_KEY,
			JSON.stringify({ target, at: Date.now() })
		);
	} catch {
		// Without sessionStorage a loop is still impossible while GitHub keeps the tokens
	}
}
