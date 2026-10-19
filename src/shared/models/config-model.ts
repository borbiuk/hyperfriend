import { LinkType } from './link-type';

/**
 * User configuration of the Hyperfriend extension, persisted in chrome.storage.sync.
 */
export interface ConfigModel {
	/** Link text template per link type, with {{placeholder}} tokens */
	templates: Record<LinkType, string>;
}
