/** Delay before the tooltip appears on hover / focus (as measured for Primer TooltipV2) */
const SHOW_DELAY_MS = 50;

/** Distance between the anchor and the tooltip (Primer `--overlay-offset`) */
const OFFSET_PX = 4;

/** Minimal distance between the tooltip and the viewport edges */
const VIEWPORT_MARGIN_PX = 8;

/** Marker values of the shared elements (also used to remove copies, e.g. from Turbo snapshots) */
const TOOLTIP_MARKER = 'tooltip';
const LIVE_REGION_MARKER = 'live-region';

/** Navigation events after which a visible tooltip must not stay on screen */
const NAVIGATION_EVENTS = [
	'turbo:visit',
	'turbo:before-render',
	'popstate',
	'pagehide',
];

/**
 * A single Primer-like tooltip shared by all copy buttons.
 * It is decorative (`aria-hidden`): buttons carry the same text as `aria-label`,
 * state changes are announced through a polite live region.
 */
class Tooltip {
	private element: HTMLDivElement | null = null;
	private liveRegion: HTMLDivElement | null = null;
	/** Element the tooltip is shown for */
	private anchor: HTMLElement | null = null;
	/** Element the tooltip is about to be shown for (hover delay) */
	private pendingAnchor: HTMLElement | null = null;
	private showTimer: number | undefined;
	private listening = false;

	/**
	 * Attaches the tooltip and the live region to the page (once at startup and after
	 * Turbo replaced `document.body`), so the first announcement is not lost.
	 * Removes copies of them, e.g. restored from a Turbo snapshot.
	 */
	public attach(): void {
		this.listen();
		this.getElement();
		this.getLiveRegion();
	}

	/**
	 * Shows the tooltip below (or above, if there is no room) the anchor.
	 *
	 * @param anchor - Element the tooltip belongs to.
	 * @param text - Tooltip text.
	 * @param immediate - Skip the hover delay (e.g. for "Copied!").
	 */
	public show(anchor: HTMLElement, text: string, immediate = false): void {
		this.cancelPending();
		this.listen();

		if (immediate) {
			this.render(anchor, text);
			return;
		}

		this.pendingAnchor = anchor;
		this.showTimer = window.setTimeout(() => {
			this.pendingAnchor = null;
			this.render(anchor, text);
		}, SHOW_DELAY_MS);
	}

	/**
	 * Hides the tooltip.
	 *
	 * @param anchor - Hide only what belongs to this element (its pending or visible tooltip);
	 * without it, everything is hidden.
	 */
	public hide(anchor?: HTMLElement): void {
		if (!anchor || anchor === this.pendingAnchor) {
			this.cancelPending();
		}

		if (!anchor || anchor === this.anchor) {
			this.anchor = null;
			this.element?.removeAttribute('data-visible');
		}
	}

	/**
	 * Hides the tooltip if its anchor was removed from the page (e.g. by a re-render).
	 */
	public hideIfDetached(): void {
		if (this.pendingAnchor && !this.pendingAnchor.isConnected) {
			this.cancelPending();
		}

		if (this.anchor && !this.anchor.isConnected) {
			this.hide(this.anchor);
		}
	}

	/**
	 * Returns whether the tooltip is visible for the given element.
	 */
	public isShownFor(anchor: HTMLElement): boolean {
		return this.anchor === anchor;
	}

	/**
	 * Announces a message to screen readers.
	 *
	 * @param message - Text to announce.
	 */
	public announce(message: string): void {
		const region = this.getLiveRegion();
		// Clear first, so repeating the same message is announced again
		region.textContent = '';
		window.setTimeout(() => {
			region.textContent = message;
		}, 50);
	}

	private cancelPending(): void {
		window.clearTimeout(this.showTimer);
		this.showTimer = undefined;
		this.pendingAnchor = null;
	}

	private isActive(): boolean {
		return this.anchor !== null || this.pendingAnchor !== null;
	}

	/**
	 * Removes the shared elements, so Turbo does not keep them in its page snapshot.
	 */
	private detach(): void {
		this.hide();
		this.element?.remove();
		this.liveRegion?.remove();
	}

	/**
	 * Removes elements with the marker other than the given one (copies from snapshots,
	 * or left by a previous instance of the content script).
	 */
	private removeCopies(marker: string, keep: Element): void {
		document
			.querySelectorAll(`[data-hyperfriend="${marker}"]`)
			.forEach((element) => {
				if (element !== keep) {
					element.remove();
				}
			});
	}

	private render(anchor: HTMLElement, text: string): void {
		if (!anchor.isConnected) {
			this.hide();
			return;
		}

		const element = this.getElement();
		element.textContent = text;
		element.setAttribute('data-visible', '');
		this.anchor = anchor;
		this.position(anchor, element);
	}

	private position(anchor: HTMLElement, element: HTMLDivElement): void {
		const anchorRect = anchor.getBoundingClientRect();
		const { width, height } = element.getBoundingClientRect();
		const viewportWidth = document.documentElement.clientWidth;
		const viewportHeight = document.documentElement.clientHeight;

		// Centered below the anchor; flipped above when there is no room below
		let top = anchorRect.bottom + OFFSET_PX;
		let direction = 's';
		if (
			top + height > viewportHeight - VIEWPORT_MARGIN_PX &&
			anchorRect.top - OFFSET_PX - height >= VIEWPORT_MARGIN_PX
		) {
			top = anchorRect.top - OFFSET_PX - height;
			direction = 'n';
		}

		const centeredLeft = anchorRect.left + anchorRect.width / 2 - width / 2;
		const maxLeft = viewportWidth - VIEWPORT_MARGIN_PX - width;
		const left = Math.max(
			VIEWPORT_MARGIN_PX,
			Math.min(centeredLeft, maxLeft)
		);

		element.style.top = `${Math.round(top)}px`;
		element.style.left = `${Math.round(left)}px`;
		element.dataset.direction = direction;
	}

	private getElement(): HTMLDivElement {
		// Turbo replaces `document.body` on navigation, so the element is re-attached when needed
		if (this.element?.isConnected) {
			return this.element;
		}

		const element = this.element ?? document.createElement('div');
		element.className = 'hyperfriend-tooltip';
		element.setAttribute('aria-hidden', 'true');
		element.dataset.hyperfriend = TOOLTIP_MARKER;
		this.removeCopies(TOOLTIP_MARKER, element);
		document.body.appendChild(element);
		this.element = element;

		return element;
	}

	private getLiveRegion(): HTMLDivElement {
		if (this.liveRegion?.isConnected) {
			return this.liveRegion;
		}

		const region = this.liveRegion ?? document.createElement('div');
		region.className = 'hyperfriend-sr-only';
		region.setAttribute('aria-live', 'polite');
		region.setAttribute('aria-atomic', 'true');
		region.dataset.hyperfriend = LIVE_REGION_MARKER;
		this.removeCopies(LIVE_REGION_MARKER, region);
		document.body.appendChild(region);
		this.liveRegion = region;

		return region;
	}

	/**
	 * Installs the global listeners (once).
	 */
	private listen(): void {
		if (this.listening) {
			return;
		}

		this.listening = true;
		const hide = (): void => {
			if (this.isActive()) {
				this.hide();
			}
		};

		window.addEventListener('scroll', hide, {
			capture: true,
			passive: true,
		});
		window.addEventListener('resize', hide, { passive: true });
		window.addEventListener('blur', hide);
		window.addEventListener('turbo:before-cache', () => this.detach());
		window.addEventListener('turbo:load', () => this.attach());
		document.addEventListener(
			'keydown',
			(event: KeyboardEvent) => {
				if (event.key === 'Escape' && this.isActive()) {
					this.hide();
				}
			},
			true
		);
		document.addEventListener(
			'pointerdown',
			(event: PointerEvent) => {
				if (
					!this.isActive() ||
					(this.anchor &&
						event.target instanceof Node &&
						this.anchor.contains(event.target))
				) {
					return;
				}

				this.hide();
			},
			true
		);

		for (const eventName of NAVIGATION_EVENTS) {
			window.addEventListener(eventName, hide);
		}

		const { navigation } = window as unknown as {
			navigation?: EventTarget;
		};
		navigation?.addEventListener('navigate', hide);
	}
}

/** The shared tooltip instance */
export const tooltip = new Tooltip();
