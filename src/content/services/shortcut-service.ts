import { ShortcutType } from '@shared/models';
import { matchesShortcut, toAriaKeyShortcuts } from '@shared/utils';

import { ShortcutHandler } from '../shortcut/shortcut-handler';

import { ConfigStore } from './config-store';
import { detectPageKind } from './page-detector';

/** Focus targets where key presses are typing, not shortcuts */
const EDITABLE_SELECTOR = [
	'input',
	'textarea',
	'select',
	'[contenteditable]:not([contenteditable="false"])',
	'[role="textbox"]',
	'[role="combobox"]',
	'[role="searchbox"]',
].join(', ');

/** Composite widgets with their own key handling (e.g. Primer ActionMenu type-ahead) */
const COMPOSITE_WIDGET_SELECTOR = [
	'[role="menu"]',
	'[role="menubar"]',
	'[role="listbox"]',
	'[role="tree"]',
	'[role="grid"]',
].join(', ');

/** Open modal dialogs; shortcuts must not act on the page behind them */
const MODAL_DIALOG_SELECTOR =
	'dialog[open], [role="dialog"][aria-modal="true"]';

/**
 * Runs keyboard shortcuts: one `keydown` listener (capture phase) matches the pressed keys
 * against the enabled bindings from the config and runs the registered handler.
 * The page is evaluated on every key press, because GitHub navigates without page loads.
 * Key presses that match nothing, or a shortcut not available on this page, are left untouched.
 */
export class ShortcutService {
	/** Handler registry, one per shortcut type */
	private readonly handlers: ShortcutHandler[] = [];

	/**
	 * @param configStore - Source of the current shortcut bindings.
	 */
	constructor(private readonly configStore: ConfigStore) {}

	/**
	 * Adds the handler of a shortcut type to the registry.
	 *
	 * @param handler - Handler to run when its shortcut is pressed.
	 */
	public register(handler: ShortcutHandler): void {
		this.handlers.push(handler);
	}

	/**
	 * Starts listening to key presses.
	 */
	public start(): void {
		document.addEventListener('keydown', this.handleKeyDown, true);
	}

	/**
	 * Returns the `aria-keyshortcuts` value of a shortcut on the current page.
	 *
	 * @param type - Shortcut to describe.
	 * @param location - Location to inspect (defaults to the current page).
	 * @returns The value, or `null` when the shortcut is disabled or not available on this page.
	 */
	public getAriaKeyShortcuts(
		type: ShortcutType,
		location: Location | URL = window.location
	): string | null {
		const binding = this.configStore.get().shortcuts[type];
		const handler = this.handlers.find((item) => item.type === type);
		if (
			!binding?.enabled ||
			!handler?.isAvailable(detectPageKind(location), location)
		) {
			return null;
		}

		return toAriaKeyShortcuts(binding.keys);
	}

	private readonly handleKeyDown = (event: KeyboardEvent): void => {
		if (event.repeat || event.isComposing || event.defaultPrevented) {
			return;
		}

		const { shortcuts } = this.configStore.get();
		const handler = this.handlers.find((item) => {
			const binding = shortcuts[item.type];
			return binding?.enabled && matchesShortcut(event, binding.keys);
		});
		if (!handler) {
			return;
		}

		const { location } = window;
		if (
			!handler.isAvailable(detectPageKind(location), location) ||
			isKeyboardTarget(event.composedPath()[0]) ||
			isKeyboardTarget(getDeepActiveElement()) ||
			isModalDialogOpen()
		) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		// Synchronously, so a clipboard write still has the user activation
		handler.handle(event);
	};
}

/**
 * Returns whether key presses on the target are handled by it: typing into a text field,
 * or navigating a composite widget such as a menu or a listbox.
 */
function isKeyboardTarget(target: EventTarget | null | undefined): boolean {
	if (!(target instanceof Element)) {
		return false;
	}

	if (target instanceof HTMLElement && target.isContentEditable) {
		return true;
	}

	return (
		target.closest(EDITABLE_SELECTOR) !== null ||
		target.closest(COMPOSITE_WIDGET_SELECTOR) !== null
	);
}

/**
 * Returns the focused element, looking into open shadow roots (e.g. web components).
 */
function getDeepActiveElement(): Element | null {
	let active = document.activeElement;
	while (active?.shadowRoot?.activeElement) {
		active = active.shadowRoot.activeElement;
	}

	return active;
}

/**
 * Returns whether a modal dialog is open (rendered, not just present in the DOM).
 */
function isModalDialogOpen(): boolean {
	for (const dialog of document.querySelectorAll(MODAL_DIALOG_SELECTOR)) {
		if (dialog.getClientRects().length > 0) {
			return true;
		}
	}

	return false;
}
