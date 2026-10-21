/*
	See Google Chrome Extension documentation:
	Content scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
*/

import { ShortcutType } from '@shared/models';

import { AvatarInjector } from './services/avatar-injector';
import { ButtonInjector } from './services/button-injector';
import { ConfigStore } from './services/config-store';
import { HydrationGuard } from './services/hydration-guard';
import { detectPageKind, PageKind } from './services/page-detector';
import { PageObserver } from './services/page-observer';
import { ShortcutService } from './services/shortcut-service';
import { CopyLinkShortcutHandler } from './shortcut/copy-link-shortcut-handler';
import './styles/avatar.css';
import './styles/copy-button.css';
import './styles/toast.css';
import './styles/tooltip.css';

/**
 * Main content script entry point.
 * Adds "copy link" buttons next to Pull Requests and Issues on github.com,
 * author avatars to Pull Request list rows, and keyboard shortcuts.
 */

// setup services:
/** Keeps the config available synchronously for click and key handlers */
const configStore = new ConfigStore();

/** Runs keyboard shortcuts; one handler per shortcut type */
const shortcutService = new ShortcutService(configStore);

/** Re-runs the injectors after SPA navigation and DOM changes */
const pageObserver = new PageObserver();

/** Defers the injectors until GitHub's server-rendered React roots are hydrated, then rescans */
const hydrationGuard = new HydrationGuard(() => pageObserver.requestScan());

/** Finds titles and injects the copy buttons (the title button announces the copy link shortcut) */
const buttonInjector = new ButtonInjector(configStore, hydrationGuard, () =>
	shortcutService.getAriaKeyShortcuts(ShortcutType.CopyLink)
);

shortcutService.register(
	new CopyLinkShortcutHandler(configStore, buttonInjector)
);

/** Shows author avatars in Pull Request list rows */
const avatarInjector = new AvatarInjector(hydrationGuard);

const scan = (): void => {
	buttonInjector.scan();
	if (!configStore.get().display.authorAvatars) {
		avatarInjector.removeAll();
		return;
	}

	if (detectPageKind() === PageKind.List) {
		avatarInjector.scan();
	}
};

// run core services (the config is loaded first, so button labels use the user's templates
// and a disabled or changed shortcut never runs with the default keys):
configStore.start(scan).finally(() => {
	shortcutService.start();
	pageObserver.start(scan);
});
