import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from '@shared/constants';
import { ConfigModel, LinkType } from '@shared/models';

let warnedUnavailable = false;

/**
 * Returns `chrome.storage.sync` when available, otherwise `null` (logs a warning once).
 */
function getStorage(): chrome.storage.SyncStorageArea | null {
	if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
		return chrome.storage.sync;
	}

	if (!warnedUnavailable) {
		warnedUnavailable = true;
		console.warn(
			'[Hyperfriend] chrome.storage is unavailable, using the default config.'
		);
	}

	return null;
}

/**
 * Creates a fresh copy of the default config.
 */
function cloneDefaultConfig(): ConfigModel {
	return { templates: { ...DEFAULT_CONFIG.templates } };
}

/**
 * Merges a raw stored value over DEFAULT_CONFIG, ignoring unknown keys and non-string templates.
 *
 * @param stored - Raw value read from storage.
 * @returns A complete, valid config.
 */
function mergeWithDefaults(stored: unknown): ConfigModel {
	const config = cloneDefaultConfig();
	if (!stored || typeof stored !== 'object') {
		return config;
	}

	const templates = (stored as { templates?: unknown }).templates;
	if (!templates || typeof templates !== 'object') {
		return config;
	}

	for (const type of Object.values(LinkType)) {
		const value = (templates as Record<string, unknown>)[type];
		if (typeof value === 'string') {
			config.templates[type] = value;
		}
	}

	return config;
}

/**
 * Reads and merges the stored config from the given storage area.
 */
async function readConfig(
	storage: chrome.storage.SyncStorageArea
): Promise<ConfigModel> {
	const result = await storage.get(CONFIG_STORAGE_KEY);
	return mergeWithDefaults(result[CONFIG_STORAGE_KEY]);
}

/**
 * Service for reading and updating the extension config in chrome.storage.sync.
 * Falls back to DEFAULT_CONFIG (and no-op writes) when chrome.storage is unavailable.
 */
export const configService = {
	/**
	 * Returns the stored config merged over DEFAULT_CONFIG.
	 */
	async get(): Promise<ConfigModel> {
		const storage = getStorage();
		if (!storage) {
			return cloneDefaultConfig();
		}

		try {
			return await readConfig(storage);
		} catch (error) {
			console.warn('[Hyperfriend] Failed to read config.', error);
			return cloneDefaultConfig();
		}
	},

	/**
	 * Saves the template for the given link type (writes the full merged config).
	 *
	 * @param type - Link type whose template is updated.
	 * @param template - New template text.
	 */
	async setTemplate(type: LinkType, template: string): Promise<void> {
		const storage = getStorage();
		if (!storage) {
			return;
		}

		const config = await readConfig(storage);
		config.templates[type] = template;
		await storage.set({ [CONFIG_STORAGE_KEY]: config });
	},

	/**
	 * Restores DEFAULT_CONFIG by removing the stored value.
	 */
	async reset(): Promise<void> {
		const storage = getStorage();
		if (!storage) {
			return;
		}

		await storage.remove(CONFIG_STORAGE_KEY);
	},

	/**
	 * Calls the listener with the merged config whenever the stored config changes.
	 *
	 * @param listener - Receives the new merged config.
	 * @returns A function that removes the listener.
	 */
	subscribe(listener: (config: ConfigModel) => void): () => void {
		if (!getStorage() || !chrome.storage.onChanged) {
			return () => {};
		}

		const handler = (
			changes: Record<string, chrome.storage.StorageChange>,
			areaName: string
		): void => {
			if (areaName !== 'sync' || !(CONFIG_STORAGE_KEY in changes)) {
				return;
			}

			listener(mergeWithDefaults(changes[CONFIG_STORAGE_KEY].newValue));
		};

		chrome.storage.onChanged.addListener(handler);
		return () => chrome.storage.onChanged.removeListener(handler);
	},
};
