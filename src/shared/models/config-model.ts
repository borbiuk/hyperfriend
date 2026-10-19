import { DisplayModel } from './display-model';
import { LinkType } from './link-type';
import { ShortcutBindingModel } from './shortcut-binding-model';
import { ShortcutType } from './shortcut-type';

/**
 * User configuration of the Hyperfriend extension, persisted in chrome.storage.sync.
 */
export interface ConfigModel {
	/** Link text template per link type, with {{placeholder}} tokens */
	templates: Record<LinkType, string>;

	/** Keyboard shortcut per action */
	shortcuts: Record<ShortcutType, ShortcutBindingModel>;

	/** Display preferences */
	display: DisplayModel;
}
