import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from '@shared/constants';
import {
	ConfigModel,
	DisplayModel,
	FiltersUpdate,
	LinkFormat,
	LinkType,
	SettingsImportModel,
	ShortcutBindingModel,
	ShortcutType,
} from '@shared/models';
import {
	normalizeCustomChips,
	normalizeFilterChips,
	normalizeShortcut,
} from '@shared/utils';

import { convertLegacyTemplate } from './template-service';

/**
 * Key of the template format marker in the stored object (next to the ConfigModel fields,
 * not part of ConfigModel). Every write stores TEMPLATE_FORMAT; a stored object without
 * it (1.x / 2.0.0) holds templates without the `[link]` syntax, converted on read.
 */
const TEMPLATE_FORMAT_KEY = 'templateFormat';

/** Template format with the `[link]` syntax (2.1.0). */
const TEMPLATE_FORMAT = 2;

/** Size limit of one item of `chrome.storage.sync`, used when the browser does not tell it. */
const DEFAULT_ITEM_QUOTA_BYTES = 8192;

/**
 * Thrown by the writers when the config would be larger than one item of `chrome.storage.sync`
 * allows (the key and the JSON text count). Nothing is written.
 */
export class ConfigTooLargeError extends Error {
	constructor(
		public readonly bytes: number,
		public readonly limit: number
	) {
		super(
			`The settings take ${bytes} bytes, more than the ${limit} the browser allows.`
		);
		this.name = 'ConfigTooLargeError';
	}
}

let warnedUnavailable = false;

/**
 * Tail of the queue of storage writes. Every read-modify-write (and `reset`) runs after
 * the previous one settles, so overlapping calls in one context can't lose updates or
 * bring back data after a reset. Always resolves, so a failed write doesn't block it.
 */
let writeQueue: Promise<void> = Promise.resolve();

/**
 * Last config this context read, wrote or got from a change notification (`null` when
 * unknown). Only `setTemplateBeforeClose` uses it, to skip the storage read.
 */
let lastKnownConfig: ConfigModel | null = null;

/**
 * Number of writes (and resets) this context started. A read that a write overtook brings an
 * older value, so it must not replace lastKnownConfig.
 */
let writeCount = 0;

/**
 * Remembers the config of a write that is about to be sent (`null` when the stored value is unknown).
 */
function rememberWrite(config: ConfigModel | null): void {
	writeCount++;
	lastKnownConfig = config ? cloneConfig(config) : null;
}

/**
 * Runs `task` after all previously queued writes have settled.
 *
 * @returns Settles with the task's own result.
 */
function enqueueWrite(task: () => Promise<void>): Promise<void> {
	const run = writeQueue.then(task);
	writeQueue = run.catch(() => {});
	return run;
}

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
 * Creates a deep copy of a config, so callers can change it without touching the original.
 *
 * @param config - Config to copy.
 * @returns An independent copy.
 */
export function cloneConfig(config: ConfigModel): ConfigModel {
	const shortcuts = {} as Record<ShortcutType, ShortcutBindingModel>;
	for (const type of Object.values(ShortcutType)) {
		const binding = config.shortcuts[type];
		shortcuts[type] = { keys: [...binding.keys], enabled: binding.enabled };
	}

	return {
		templates: { ...config.templates },
		format: config.format,
		shortcuts,
		display: { ...config.display },
		filters: {
			chips: [...config.filters.chips],
			sticky: { ...config.filters.sticky },
			custom: config.filters.custom.map((chip) => ({ ...chip })),
		},
	};
}

/**
 * Creates a fresh copy of DEFAULT_CONFIG.
 */
export function cloneDefaultConfig(): ConfigModel {
	return cloneConfig(DEFAULT_CONFIG);
}

/**
 * Builds the object written to storage: the config plus the current template format marker.
 *
 * @param config - Complete config.
 * @returns The value stored under CONFIG_STORAGE_KEY.
 */
export function toStoredConfig(config: ConfigModel): Record<string, unknown> {
	return { ...config, [TEMPLATE_FORMAT_KEY]: TEMPLATE_FORMAT };
}

/**
 * Returns true for a plain (non-null, non-array) object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Copies the string templates of known link types into the config; anything else is ignored.
 *
 * @param legacy - The templates predate the `[link]` syntax and are converted
 * (see convertLegacyTemplate).
 */
function applyTemplates(
	config: ConfigModel,
	templates: unknown,
	legacy = false
): void {
	if (!isObject(templates)) {
		return;
	}

	for (const type of Object.values(LinkType)) {
		const value = templates[type];
		if (typeof value === 'string') {
			config.templates[type] = legacy
				? convertLegacyTemplate(value, type)
				: value;
		}
	}
}

/**
 * Copies the copy format into the config when it is a known value; anything else is ignored.
 */
function applyFormat(config: ConfigModel, format: unknown): void {
	if (Object.values(LinkFormat).includes(format as LinkFormat)) {
		config.format = format as LinkFormat;
	}
}

/**
 * Copies the valid parts of the bindings of known shortcut types into the config.
 * Invalid `keys` (see normalizeShortcut: no modifier, browser-reserved, unknown keys) or a
 * non-boolean `enabled` keep the config's value.
 */
function applyShortcuts(config: ConfigModel, shortcuts: unknown): void {
	if (!isObject(shortcuts)) {
		return;
	}

	for (const type of Object.values(ShortcutType)) {
		const binding = shortcuts[type];
		if (!isObject(binding)) {
			continue;
		}

		const current = config.shortcuts[type];
		const keys = normalizeShortcut(binding.keys);
		config.shortcuts[type] = {
			keys: keys ?? current.keys,
			enabled:
				typeof binding.enabled === 'boolean'
					? binding.enabled
					: current.enabled,
		};
	}
}

/**
 * Copies the boolean display preferences into the config; anything else is ignored.
 */
function applyDisplay(config: ConfigModel, display: unknown): void {
	if (!isObject(display)) {
		return;
	}

	if (typeof display.authorAvatars === 'boolean') {
		config.display.authorAvatars = display.authorAvatars;
	}
}

/**
 * Copies the valid parts of the quick filter settings into the config: the custom chips and the shown chip ids (known ids, in
 * the order given) and the boolean sticky flag; anything else is ignored (also the parts of earlier builds).
 */
function applyFilters(config: ConfigModel, filters: unknown): void {
	if (!isObject(filters)) {
		return;
	}

	const custom = normalizeCustomChips(filters.custom);
	if (custom) {
		config.filters.custom = custom;
	}

	// The ids of chips that do not exist (a custom chip that was deleted) are dropped, so the
	// list is checked again after every change of the custom chips
	const customIds = config.filters.custom.map((chip) => chip.id);
	config.filters.chips =
		normalizeFilterChips(filters.chips, customIds) ??
		normalizeFilterChips(config.filters.chips, customIds) ??
		[];

	if (
		isObject(filters.sticky) &&
		typeof filters.sticky.drafts === 'boolean'
	) {
		config.filters.sticky.drafts = filters.sticky.drafts;
	}
}

/**
 * Merges a raw stored value over DEFAULT_CONFIG, ignoring unknown keys and invalid values.
 * Data saved by 1.0.0 (`{ templates }` only) gets the default shortcuts, display and filter settings.
 * Without the TEMPLATE_FORMAT marker (1.x / 2.0.0) the templates are converted to the
 * `[link]` syntax; nothing is written here, the next write stores them with the marker.
 *
 * @param stored - Raw value read from storage.
 * @returns A complete, valid config.
 */
function mergeWithDefaults(stored: unknown): ConfigModel {
	const config = cloneDefaultConfig();
	if (!isObject(stored)) {
		return config;
	}

	const format = stored[TEMPLATE_FORMAT_KEY];
	const legacy = typeof format !== 'number' || format < TEMPLATE_FORMAT;
	applyTemplates(config, stored.templates, legacy);
	applyFormat(config, stored.format);
	applyShortcuts(config, stored.shortcuts);
	applyDisplay(config, stored.display);
	applyFilters(config, stored.filters);
	return config;
}

/**
 * Reads and merges the stored config from the given storage area.
 */
async function readConfig(
	storage: chrome.storage.SyncStorageArea
): Promise<ConfigModel> {
	const writesBefore = writeCount;
	const result = await storage.get(CONFIG_STORAGE_KEY);
	const config = mergeWithDefaults(result[CONFIG_STORAGE_KEY]);
	if (writeCount === writesBefore) {
		lastKnownConfig = cloneConfig(config);
	}
	return config;
}

/**
 * Reads the stored config, lets `change` modify it and writes it back in a single write,
 * queued after earlier writes. Does nothing when chrome.storage is unavailable.
 *
 * @param change - Modifies the config in place.
 * @param useLastKnown - Start from the last known config instead of reading storage (when one
 *   is known), so `storage.set` is called in the same task when the queue is idle.
 */
function updateConfig(
	change: (config: ConfigModel) => void,
	useLastKnown = false
): Promise<void> {
	return enqueueWrite(async () => {
		const storage = getStorage();
		if (!storage) {
			return;
		}

		const config =
			useLastKnown && lastKnownConfig
				? cloneConfig(lastKnownConfig)
				: await readConfig(storage);
		change(config);
		const stored = toStoredConfig(config);
		// The whole config is one item of the sync storage: a write over its size limit is refused
		// by the browser, so it is refused here first, with a reason the popup can name
		const bytes = new TextEncoder().encode(
			`${CONFIG_STORAGE_KEY}${JSON.stringify(stored)}`
		).length;
		const limit = storage.QUOTA_BYTES_PER_ITEM ?? DEFAULT_ITEM_QUOTA_BYTES;
		if (bytes > limit) {
			throw new ConfigTooLargeError(bytes, limit);
		}

		rememberWrite(config);
		try {
			await storage.set({ [CONFIG_STORAGE_KEY]: stored });
		} catch (error) {
			// The stored value is unknown now; the next write reads it again
			rememberWrite(null);
			throw error;
		}
	});
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
		await configService.setTemplates({ [type]: template });
	},

	/**
	 * Saves several templates at once with a single write of the full merged config.
	 * Link types not present in `templates` keep their current value.
	 *
	 * @param templates - New template text per link type.
	 */
	async setTemplates(
		templates: Partial<Record<LinkType, string>>
	): Promise<void> {
		await updateConfig((config) => applyTemplates(config, templates));
	},

	/**
	 * Saves one template when the page is about to close (pagehide, hidden popup). It skips
	 * the storage read and starts from the last config this context knows, so the write is
	 * sent before the page is torn down (a read reply would arrive too late). Still queued
	 * after earlier writes; without a known config it works like setTemplate.
	 *
	 * @param type - Link type whose template is updated.
	 * @param template - New template text.
	 */
	async setTemplateBeforeClose(
		type: LinkType,
		template: string
	): Promise<void> {
		await updateConfig(
			(config) => applyTemplates(config, { [type]: template }),
			true
		);
	},

	/**
	 * Saves the copy format (writes the full merged config).
	 * An unknown value is ignored.
	 *
	 * @param format - New clipboard format.
	 */
	async setFormat(format: LinkFormat): Promise<void> {
		await updateConfig((config) => applyFormat(config, format));
	},

	/**
	 * Saves the binding of one shortcut (writes the full merged config).
	 * Invalid `keys` (see normalizeShortcut) are ignored; missing fields keep their value.
	 *
	 * @param type - Shortcut whose binding is updated.
	 * @param binding - New keys and/or enabled state.
	 */
	async setShortcut(
		type: ShortcutType,
		binding: Partial<ShortcutBindingModel>
	): Promise<void> {
		await updateConfig((config) =>
			applyShortcuts(config, { [type]: binding })
		);
	},

	/**
	 * Saves display preferences (writes the full merged config).
	 * Missing fields keep their value.
	 *
	 * @param display - New display preferences.
	 */
	async setDisplay(display: Partial<DisplayModel>): Promise<void> {
		await updateConfig((config) => applyDisplay(config, display));
	},

	/**
	 * Saves quick filter settings (writes the full merged config).
	 * Missing fields keep their value; invalid parts are ignored. The shown ids and the custom
	 * chips can be written together, so a new chip is in the list from the first write.
	 *
	 * @param filters - New quick filter settings; `sticky` may hold one flag.
	 */
	async setFilters(filters: FiltersUpdate): Promise<void> {
		await updateConfig((config) => applyFilters(config, filters));
	},

	/**
	 * Applies settings read from an imported file with a single write of the full merged
	 * config. Settings missing from the file keep their current value.
	 *
	 * @param settings - Result of parseSettings.
	 */
	async importSettings(settings: SettingsImportModel): Promise<void> {
		await updateConfig((config) => {
			applyTemplates(config, settings.templates);
			applyFormat(config, settings.format);
			applyShortcuts(config, settings.shortcuts);
			applyDisplay(config, settings.display);
			applyFilters(config, settings.filters);
		});
	},

	/**
	 * Restores DEFAULT_CONFIG (templates, format, shortcuts, display and filters) by removing the stored value.
	 */
	async reset(): Promise<void> {
		await enqueueWrite(async () => {
			const storage = getStorage();
			if (!storage) {
				return;
			}

			rememberWrite(null);
			await storage.remove(CONFIG_STORAGE_KEY);
		});
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

			const config = mergeWithDefaults(
				changes[CONFIG_STORAGE_KEY].newValue
			);
			lastKnownConfig = cloneConfig(config);
			listener(config);
		};

		chrome.storage.onChanged.addListener(handler);
		return () => chrome.storage.onChanged.removeListener(handler);
	},
};
