import { DisplayModel } from './display-model';
import { LinkType } from './link-type';
import { ShortcutBindingModel } from './shortcut-binding-model';
import { ShortcutType } from './shortcut-type';

/**
 * Exported settings file (schema version 3), used to share settings between users.
 * Version 3 templates use the `[link]` syntax. Version 2 files (2.0.0) and version 1 files
 * (`templates` only) are still accepted on import; their templates are converted.
 */
export interface SettingsFileModel {
	/** Marker identifying a Hyperfriend settings file */
	app: 'hyperfriend';

	/** File format version */
	schemaVersion: 3;

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
