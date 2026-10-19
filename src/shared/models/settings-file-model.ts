import { LinkType } from './link-type';

/**
 * Exported settings file (schema version 1), used to share templates between users.
 */
export interface SettingsFileModel {
	/** Marker identifying a Hyperfriend settings file */
	app: 'hyperfriend';

	/** File format version */
	schemaVersion: 1;

	/** Export time as an ISO 8601 string */
	exportedAt: string;

	/** Link text template per link type */
	templates: Record<LinkType, string>;
}
