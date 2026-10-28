import { DraftState } from '@shared/models';
import { RememberedFilterState } from '@shared/utils';

/** Key under which the remembered state is stored in chrome.storage.local. */
export const FILTER_STATE_STORAGE_KEY = 'hyperfriend-filter-state';

/** State used until the user chooses one: hide drafts (what the sticky chip is for). */
const DEFAULT_STATE: RememberedFilterState = { drafts: 'hide' };

/** The values a stored drafts state can have. */
const DRAFT_STATES: readonly DraftState[] = ['any', 'hide', 'only'];

/**
 * Reads a stored value over the default state; anything invalid keeps the default.
 */
function parseState(stored: unknown): RememberedFilterState {
	const state = { ...DEFAULT_STATE };
	if (typeof stored !== 'object' || stored === null) {
		return state;
	}

	const { drafts } = stored as Record<string, unknown>;
	if (DRAFT_STATES.includes(drafts as DraftState)) {
		state.drafts = drafts as DraftState;
	}

	return state;
}

/**
 * Returns `chrome.storage.local` when available, otherwise `null`.
 */
function getStorage(): chrome.storage.LocalStorageArea | null {
	if (typeof chrome !== 'undefined' && chrome.storage?.local) {
		return chrome.storage.local;
	}

	return null;
}

/**
 * Keeps the state the sticky drafts chip remembers (drafts shown, hidden or the only ones) in
 * memory, so the page scan can read it synchronously. It is stored in `chrome.storage.local`:
 * it changes with every click on a chip, so it stays out of the synced settings and the settings file.
 */
export class FilterStateStore {
	private state: RememberedFilterState = { ...DEFAULT_STATE };

	/**
	 * Loads the stored state and keeps it fresh.
	 *
	 * @param onChange - Called when another tab changes the state.
	 * @returns Resolves when the stored state is loaded.
	 */
	public async start(onChange: () => void): Promise<void> {
		const storage = getStorage();
		if (!storage) {
			return;
		}

		let changed = false;
		chrome.storage.onChanged?.addListener((changes, areaName) => {
			if (
				areaName !== 'local' ||
				!(FILTER_STATE_STORAGE_KEY in changes)
			) {
				return;
			}

			changed = true;
			this.state = parseState(changes[FILTER_STATE_STORAGE_KEY].newValue);
			onChange();
		});

		try {
			const result = await storage.get(FILTER_STATE_STORAGE_KEY);
			if (!changed) {
				this.state = parseState(result[FILTER_STATE_STORAGE_KEY]);
			}
		} catch (error) {
			console.warn(
				'[Hyperfriend] Failed to read the filter state.',
				error
			);
		}
	}

	/**
	 * Returns the remembered state.
	 */
	public get(): RememberedFilterState {
		return this.state;
	}

	/**
	 * Remembers a new state (the given parts replace the current ones).
	 *
	 * @returns Resolves when the state is written; never rejects.
	 */
	public async set(part: Partial<RememberedFilterState>): Promise<void> {
		this.state = { ...this.state, ...part };
		const storage = getStorage();
		if (!storage) {
			return;
		}

		try {
			await storage.set({ [FILTER_STATE_STORAGE_KEY]: this.state });
		} catch (error) {
			console.warn(
				'[Hyperfriend] Failed to save the filter state.',
				error
			);
		}
	}
}
