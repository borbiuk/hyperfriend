import { CHECK_ICON, createOcticon, X_ICON } from '../icons/octicons';

import { tooltip } from './tooltip';

/** How long the toast stays on screen */
const VISIBLE_DURATION_MS = 2000;

/** Marker value of the toast element (also used to remove copies, e.g. from Turbo snapshots) */
const TOAST_MARKER = 'toast';

/** Navigation events after which a visible toast must not stay on screen */
const NAVIGATION_EVENTS = ['turbo:visit', 'popstate', 'pagehide'];

/**
 * Look of the toast.
 */
export enum ToastVariant {
	/** Something worked, e.g. "Link copied" */
	Success = 'success',

	/** Something failed, e.g. "Copy failed" */
	Danger = 'danger',
}

/**
 * A small Primer-like toast at the bottom of the viewport, shared by the whole content script.
 * Used for feedback when the element that triggered an action is not visible (e.g. a keyboard
 * shortcut while the title button is scrolled out of view). It is decorative (`aria-hidden`):
 * the message is announced through the tooltip's polite live region.
 */
class Toast {
	private element: HTMLDivElement | null = null;
	private hideTimer: number | undefined;
	private listening = false;

	/**
	 * Shows the toast (replacing a visible one) and announces the message.
	 *
	 * @param message - Text to show and announce.
	 * @param variant - Success or danger look.
	 */
	public show(message: string, variant: ToastVariant): void {
		this.listen();
		window.clearTimeout(this.hideTimer);

		const element = this.getElement();
		const icon = document.createElement('span');
		icon.className = 'hyperfriend-toast__icon';
		icon.appendChild(
			createOcticon(
				variant === ToastVariant.Success ? CHECK_ICON : X_ICON
			)
		);

		const text = document.createElement('span');
		text.className = 'hyperfriend-toast__text';
		text.textContent = message;

		element.replaceChildren(icon, text);
		element.dataset.variant = variant;

		// Restart the appear animation when a toast is replaced by the next one
		element.removeAttribute('data-visible');
		element.getBoundingClientRect();
		element.setAttribute('data-visible', '');

		tooltip.announce(message);

		this.hideTimer = window.setTimeout(
			() => this.hide(),
			VISIBLE_DURATION_MS
		);
	}

	/**
	 * Hides the toast.
	 */
	public hide(): void {
		window.clearTimeout(this.hideTimer);
		this.hideTimer = undefined;
		this.element?.removeAttribute('data-visible');
	}

	/**
	 * Removes the toast, so Turbo does not keep it in its page snapshot.
	 */
	private detach(): void {
		this.hide();
		this.element?.remove();
	}

	private getElement(): HTMLDivElement {
		// Turbo replaces `document.body` on navigation, so the element is re-attached when needed
		if (this.element?.isConnected) {
			return this.element;
		}

		const element = this.element ?? document.createElement('div');
		element.className = 'hyperfriend-toast';
		element.setAttribute('aria-hidden', 'true');
		element.dataset.hyperfriend = TOAST_MARKER;
		document
			.querySelectorAll(`[data-hyperfriend="${TOAST_MARKER}"]`)
			.forEach((copy) => {
				if (copy !== element) {
					copy.remove();
				}
			});
		document.body.appendChild(element);
		this.element = element;

		return element;
	}

	/**
	 * Installs the global listeners (once).
	 */
	private listen(): void {
		if (this.listening) {
			return;
		}

		this.listening = true;
		window.addEventListener('turbo:before-cache', () => this.detach());
		for (const eventName of NAVIGATION_EVENTS) {
			window.addEventListener(eventName, () => this.hide());
		}
	}
}

/** The shared toast instance */
export const toast = new Toast();
