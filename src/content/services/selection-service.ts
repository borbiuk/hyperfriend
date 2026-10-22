import { LinkTargetModel } from '@shared/models';
import { copyLinks } from '@shared/services';

import { CopyButton } from '../components/copy-button';
import { SelectionBar } from '../components/selection-bar';
import { tooltip } from '../components/tooltip';

import { ConfigStore } from './config-store';
import { detectPageKind, PageKind } from './page-detector';
import {
	getDeepActiveElement,
	isKeyboardTarget,
	isModalDialogOpen,
} from './shortcut-service';

/** How long the result ("3 links copied") stays before the selection is cleared */
const RESULT_DURATION_MS = 1500;

/** Open popovers (menus, overlays of the page) own Escape */
const POPOVER_OPEN_SELECTOR = ':popover-open';

/**
 * The items a user collected with Shift+click on the copy buttons of a list, and the bar that
 * copies them as one list. An item is identified by its canonical URL, not by its button: React
 * may replace a row, and the new button of the same item shows the selection again.
 *
 * The selection belongs to one page. It is cleared when the page changes, after a successful
 * copy, with Escape and with "Clear"; an item whose row is gone from the page is dropped.
 */
export class SelectionService {
	/** Canonical URLs of the selected items */
	private readonly selected = new Set<string>();
	/** Row buttons of the page, in page order, as of the last scan */
	private rowButtons: CopyButton[] = [];
	private readonly bar = new SelectionBar(
		() => this.copy(),
		() => this.clear()
	);
	private pageKey = '';
	private lastToggled: string | null = null;
	private resultTimer: number | undefined;

	/**
	 * @param configStore - Source of the current config (templates, format).
	 */
	constructor(private readonly configStore: ConfigStore) {}

	/**
	 * Starts listening for Escape (the selection lives until it is cleared).
	 */
	public start(): void {
		// Bubble phase: GitHub's own Escape handling (menus, dialogs) has run and may have claimed the key
		document.addEventListener('keydown', this.handleKeydown);
		window.addEventListener('turbo:before-cache', () => this.bar.detach());
	}

	/**
	 * Adds the button's item to the selection, or removes it when it is selected.
	 *
	 * @param button - Row copy button that was Shift+clicked.
	 */
	public toggle(button: CopyButton): void {
		const url = button.getUrl();
		if (!url) {
			return;
		}

		window.clearTimeout(this.resultTimer);
		this.resultTimer = undefined;
		const first = this.selected.size === 0;
		if (first) {
			this.pageKey = this.getPageKey();
		}

		const added = !this.selected.has(url);
		if (added) {
			this.selected.add(url);
		} else {
			this.selected.delete(url);
		}

		this.lastToggled = url;
		this.applyToButtons();
		this.refresh();
		tooltip.announce(
			`${added ? 'Added to' : 'Removed from'} the selection, ${this.selected.size} selected${
				added && first
					? '. The Selected links region at the end of the page copies them'
					: ''
			}`
		);
	}

	/**
	 * Clears the selection and hides the bar. Focus inside the bar moves to a selected row button
	 * first, so a keyboard user does not drop to the top of the page.
	 */
	public clear(): void {
		window.clearTimeout(this.resultTimer);
		this.resultTimer = undefined;
		if (this.bar.containsFocus()) {
			this.getFocusTarget()?.element.focus();
		}

		this.selected.clear();
		this.lastToggled = null;
		this.applyToButtons();
		this.bar.hide();
	}

	/**
	 * Brings the selection in line with the page: clears it after a navigation or on a page that
	 * is not a list, re-marks the buttons GitHub (re)created, and drops the items whose row is
	 * gone. Call after every scan.
	 *
	 * @param buttons - The row copy buttons of the page, in page order.
	 */
	public sync(buttons: CopyButton[]): void {
		this.rowButtons = buttons;
		if (this.selected.size === 0) {
			return;
		}

		if (
			this.getPageKey() !== this.pageKey ||
			detectPageKind() !== PageKind.List
		) {
			this.clear();
			return;
		}

		const present = new Set(buttons.map((button) => button.getUrl()));
		let dropped = false;
		for (const url of this.selected) {
			if (!present.has(url)) {
				this.selected.delete(url);
				dropped = true;
			}
		}

		this.applyToButtons();
		if (dropped) {
			this.refresh();
		}
	}

	/**
	 * Copies the selected items as one list, in the order of the page. Runs inside the click on
	 * the bar's "Copy" button, so the clipboard write starts inside the user gesture.
	 */
	private copy(): void {
		const targets = this.getSelectedButtons()
			.map((button) => button.getTarget())
			.filter((target): target is LinkTargetModel => target !== null);
		if (targets.length === 0) {
			this.showResult('Copy failed', true);
			return;
		}

		copyLinks(targets, this.configStore.get()).then(
			() => {
				this.showResult(
					`${targets.length} ${targets.length === 1 ? 'link' : 'links'} copied`,
					false
				);
			},
			(error: unknown) => {
				console.warn('[Hyperfriend] Failed to copy the links.', error);
				this.showResult('Copy failed', true);
			}
		);
	}

	/**
	 * Shows the result in the bar and announces it. A success clears the selection afterwards;
	 * a failure keeps it, so the user can try again.
	 */
	private showResult(message: string, failed: boolean): void {
		window.clearTimeout(this.resultTimer);
		this.bar.setMessage(message, failed);
		tooltip.announce(message);
		this.resultTimer = window.setTimeout(() => {
			this.resultTimer = undefined;
			if (failed) {
				this.refresh();
				return;
			}

			this.clear();
		}, RESULT_DURATION_MS);
	}

	/**
	 * Shows the bar with the current count, or hides it when nothing is selected. A result that
	 * is on screen is left alone until its timer ends.
	 */
	private refresh(): void {
		if (this.resultTimer !== undefined) {
			return;
		}

		if (this.selected.size === 0) {
			this.bar.hide();
			return;
		}

		this.bar.show(this.selected.size);
	}

	/**
	 * Marks the buttons of the selected items (all buttons of an item, e.g. a pinned discussion
	 * that is also a row) and unmarks the others.
	 */
	private applyToButtons(): void {
		for (const button of this.rowButtons) {
			const url = button.getUrl();
			button.setSelected(url !== null && this.selected.has(url));
		}
	}

	/**
	 * Returns one connected button per selected item, in the order of the page.
	 */
	private getSelectedButtons(): CopyButton[] {
		const seen = new Set<string>();
		const buttons: CopyButton[] = [];
		for (const button of this.rowButtons) {
			const url = button.getUrl();
			if (
				url !== null &&
				this.selected.has(url) &&
				!seen.has(url) &&
				button.element.isConnected
			) {
				seen.add(url);
				buttons.push(button);
			}
		}

		return buttons;
	}

	/**
	 * Returns the button that should take the focus when the bar goes away: the last toggled
	 * item, otherwise the first selected one.
	 */
	private getFocusTarget(): CopyButton | null {
		const buttons = this.getSelectedButtons();
		return (
			buttons.find((button) => button.getUrl() === this.lastToggled) ??
			buttons[0] ??
			null
		);
	}

	private getPageKey(): string {
		return `${window.location.pathname}${window.location.search}`;
	}

	private readonly handleKeydown = (event: KeyboardEvent): void => {
		if (
			event.key !== 'Escape' ||
			this.selected.size === 0 ||
			event.defaultPrevented ||
			event.isComposing
		) {
			return;
		}

		if (
			isKeyboardTarget(event.composedPath()[0]) ||
			isKeyboardTarget(getDeepActiveElement()) ||
			isModalDialogOpen() ||
			document.querySelector(POPOVER_OPEN_SELECTOR)
		) {
			return;
		}

		this.clear();
	};
}
