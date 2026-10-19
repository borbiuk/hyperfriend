import { DisplayModel } from './display-model';
import { LinkType } from './link-type';
import { ShortcutBindingModel } from './shortcut-binding-model';
import { ShortcutType } from './shortcut-type';

/**
 * Exported settings file (schema version 2), used to share settings between users.
 * Version 1 files (`templates` only) are still accepted on import.
 */
export interface SettingsFileModel {
	/** Marker identifying a Hyperfriend settings file */
	app: 'hyperfriend';

	/** File format version */
	schemaVersion: 2;

	/** Export time as an ISO 8601 string */
	exportedAt: string;

	/** Link text template per link type */
	templates: Record<LinkType, string>;

	/** Keyboard shortcut per action */
	shortcuts: Record<ShortcutType, ShortcutBindingModel>;

	/** Display preferences */
	display: DisplayModel;
}

/**
 * Settings read from an imported file. Missing parts keep their current value.
 */
export interface SettingsImportModel {
	templates?: Partial<Record<LinkType, string>>;
	shortcuts?: Partial<Record<ShortcutType, ShortcutBindingModel>>;
	display?: Partial<DisplayModel>;
}
