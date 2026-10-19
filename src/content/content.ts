/*
	See Google Chrome Extension documentation:
	Content scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
*/

import { AvatarInjector } from './services/avatar-injector';
import { ButtonInjector } from './services/button-injector';
import { ConfigStore } from './services/config-store';
import { detectPageKind, PageKind } from './services/page-detector';
import { PageObserver } from './services/page-observer';
import './styles/avatar.css';
import './styles/copy-button.css';
import './styles/tooltip.css';

/**
 * Main content script entry point.
 * Adds "copy link" buttons next to Pull Requests and Issues on github.com,
 * and author avatars to Pull Request list rows.
 */

// setup services:
/** Keeps the config available synchronously for click handlers */
const configStore = new ConfigStore();

/** Finds titles and injects the copy buttons */
const buttonInjector = new ButtonInjector(configStore);

/** Shows author avatars in Pull Request list rows */
const avatarInjector = new AvatarInjector();

/** Re-runs the injectors after SPA navigation and DOM changes */
const pageObserver = new PageObserver();

const scan = (): void => {
	buttonInjector.scan();
	if (detectPageKind() === PageKind.List) {
		avatarInjector.scan();
	}
};

// run core services (the config is loaded first, so button labels use the user's templates):
configStore.start(scan).finally(() => pageObserver.start(scan));
