/*
	See Google Chrome Extension documentation:
	Content scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
*/

import { ButtonInjector } from './services/button-injector';
import { ConfigStore } from './services/config-store';
import { PageObserver } from './services/page-observer';
import './styles/copy-button.css';

/**
 * Main content script entry point.
 * Adds "copy link" buttons next to Pull Requests and Issues on github.com.
 */

// setup services:
/** Keeps the config available synchronously for click handlers */
const configStore = new ConfigStore();

/** Finds titles and injects the copy buttons */
const buttonInjector = new ButtonInjector(configStore);

/** Re-runs the injector after SPA navigation and DOM changes */
const pageObserver = new PageObserver();

const scan = (): void => buttonInjector.scan();

// run core services (the config is loaded first, so button labels use the user's templates):
configStore.start(scan).finally(() => pageObserver.start(scan));
