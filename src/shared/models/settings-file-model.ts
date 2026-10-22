import { DisplayModel } from './display-model';
import { LinkFormat } from './link-format';
import { LinkType } from './link-type';
import { ShortcutBindingModel } from './shortcut-binding-model';
import { ShortcutType } from './shortcut-type';

/**
 * Exported settings file (schema version 4), used to share settings between users.
 * Version 4 adds the copy `format`. Version 3 files (2.1.x to 2.2.x) have no format; their
 * templates already use the `[link]` syntax. Version 2 files (2.0.0) and version 1 files
 * (`templates` only) are still accepted on import; their templates are converted.
 */
export interface SettingsFileModel {
	/** Marker identifying a Hyperfriend settings file */
	app: 'hyperfriend';

	/** File format version */
	schemaVersion: 4;

	/** Export time as an ISO 8601 string */
	exportedAt: string;

	/** Link text template per link type */
	templates: Record<LinkType, string>;

	/** Clipboard format of a copied link */
	format: LinkFormat;

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
	format?: LinkFormat;
	shortcuts?: Partial<Record<ShortcutType, ShortcutBindingModel>>;
	display?: Partial<DisplayModel>;
}
