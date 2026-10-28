/*
	See Google Chrome Extension documentation:
	Content scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
*/

import { ShortcutType } from '@shared/models';

import { AvatarInjector } from './services/avatar-injector';
import { ButtonInjector } from './services/button-injector';
import { ConfigStore } from './services/config-store';
import { FilterService } from './services/filter-service';
import { FilterStateStore } from './services/filter-state-store';
import { HydrationGuard } from './services/hydration-guard';
import { detectPageKind, PageKind } from './services/page-detector';
import { PageObserver } from './services/page-observer';
import { SelectionService } from './services/selection-service';
import { ShortcutService } from './services/shortcut-service';
import { CopyLinkShortcutHandler } from './shortcut/copy-link-shortcut-handler';
import './styles/avatar.css';
import './styles/copy-button.css';
import './styles/filter-bar.css';
import './styles/selection-bar.css';
import './styles/toast.css';
import './styles/tooltip.css';

/** Marks the page's isolated world once the content script has started in it */
const STARTED_KEY = '__hyperfriendContentScript';

/**
 * Main content script entry point.
 * Adds "copy link" buttons next to Pull Requests and Issues on github.com and GitHub Enterprise sites,
 * author avatars to Pull Request list rows, and keyboard shortcuts.
 */
function start(): void {
	// setup services:
	/** Keeps the config available synchronously for click and key handlers */
	const configStore = new ConfigStore();

	/** Runs keyboard shortcuts; one handler per shortcut type */
	const shortcutService = new ShortcutService(configStore);

	/** Re-runs the injectors after SPA navigation and DOM changes */
	const pageObserver = new PageObserver();

	/** Defers the injectors until GitHub's server-rendered React roots are hydrated, then rescans */
	const hydrationGuard = new HydrationGuard(() => pageObserver.requestScan());

	/** Collects the list rows that are Shift+clicked and copies them as one list */
	const selectionService = new SelectionService(configStore);

	/** Finds titles and injects the copy buttons (the title button announces the copy link shortcut) */
	const buttonInjector = new ButtonInjector(
		configStore,
		hydrationGuard,
		() => shortcutService.getAriaKeyShortcuts(ShortcutType.CopyLink),
		selectionService,
		() => pageObserver.requestScan()
	);

	shortcutService.register(
		new CopyLinkShortcutHandler(configStore, buttonInjector)
	);

	/** Shows author avatars in Pull Request list rows */
	const avatarInjector = new AvatarInjector(hydrationGuard);

	/** Remembers the state of the sticky filter chips */
	const filterStateStore = new FilterStateStore();

	/** Shows the quick filter chips on Pull Request lists */
	const filterService = new FilterService(
		configStore,
		filterStateStore,
		hydrationGuard
	);

	const scan = (): void => {
		buttonInjector.scan();
		filterService.scan();
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
	// configService.get never rejects, so the services always start
	void Promise.all([
		configStore.start(scan),
		filterStateStore.start(scan),
	]).finally(() => {
		filterService.start();
		shortcutService.start();
		selectionService.start();
		pageObserver.start(scan);
	});
}

// The script can be injected twice into one page (registered for a GitHub Enterprise domain and
// also run in a tab that was open when it was registered): the second copy must do nothing, or two
// copies would replace each other's buttons without end.
const world = globalThis as unknown as Record<string, unknown>;
if (!world[STARTED_KEY]) {
	world[STARTED_KEY] = true;
	start();
}
