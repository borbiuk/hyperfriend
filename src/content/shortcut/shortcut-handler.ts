import { ShortcutType } from '@shared/models';

import { PageKind } from '../services/page-detector';

/**
 * Action of one keyboard shortcut, registered in the ShortcutService.
 * The key combination comes from the config (`shortcuts[type]`), not from the handler.
 */
export interface ShortcutHandler {
	/** Shortcut this handler runs for */
	readonly type: ShortcutType;

	/**
	 * Returns whether the shortcut works on the given page. Evaluated on every key press
	 * (GitHub navigates without page loads); when `false`, the key press is left to the page.
	 *
	 * @param kind - Kind of the page, detected from `location`.
	 * @param location - Current location.
	 */
	isAvailable(kind: PageKind, location: Location | URL): boolean;

	/**
	 * Runs the action. Called synchronously inside the `keydown` handler (user activation),
	 * after the event was prevented and stopped.
	 *
	 * @param event - The matching key press.
	 */
	handle(event: KeyboardEvent): void;
}
