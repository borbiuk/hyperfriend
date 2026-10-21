import { detectPageKind, PageKind } from './page-detector';

/** Quiet period after the last DOM change before rescanning */
const DEBOUNCE_MS = 150;

/** Upper bound for postponing a rescan while the DOM keeps changing */
const MAX_WAIT_MS = 500;

/** Navigation events of GitHub's SPA (Turbo) and of the history API */
const NAVIGATION_EVENTS = ['turbo:load', 'turbo:render', 'popstate'];

/**
 * Notifies about page changes of GitHub's SPA (Turbo + React): DOM mutations (debounced)
 * and navigation events. Mutations on unsupported pages are ignored, to keep the observer cheap,
 * unless the URL changed since the last notification (soft navigation).
 */
export class PageObserver {
	private timer: number | undefined;
	private firstRequestAt: number | undefined;
	private onChange: () => void = () => {};
	private lastUrl: string | undefined;

	/**
	 * Starts observing and runs an initial change notification.
	 *
	 * @param onChange - Called (debounced) after the page changed.
	 */
	public start(onChange: () => void): void {
		this.onChange = onChange;

		// The root element is observed, because Turbo replaces `document.body` on navigation
		new MutationObserver(this.handleMutations).observe(
			document.documentElement,
			{ childList: true, subtree: true }
		);

		// Turbo events are dispatched on `document` and bubble up to `window`
		for (const eventName of NAVIGATION_EVENTS) {
			window.addEventListener(eventName, this.schedule);
		}

		// Navigation API (Chromium; optional elsewhere): catches URL-only soft navigations
		const { navigation } = window as unknown as {
			navigation?: EventTarget;
		};
		navigation?.addEventListener('navigatesuccess', this.schedule);

		this.notify();
	}

	private readonly handleMutations = (): void => {
		if (
			window.location.href === this.lastUrl &&
			detectPageKind() === PageKind.Unsupported
		) {
			return;
		}

		this.schedule();
	};

	private notify(): void {
		this.lastUrl = window.location.href;
		this.onChange();
	}

	/**
	 * Requests a rescan through the same debounce as DOM changes.
	 */
	public requestScan(): void {
		this.schedule();
	}

	private readonly schedule = (): void => {
		const now = performance.now();
		this.firstRequestAt ??= now;
		window.clearTimeout(this.timer);

		const remaining = this.firstRequestAt + MAX_WAIT_MS - now;
		const delay = Math.max(0, Math.min(DEBOUNCE_MS, remaining));

		this.timer = window.setTimeout(() => {
			this.timer = undefined;
			this.firstRequestAt = undefined;
			this.notify();
		}, delay);
	};
}
