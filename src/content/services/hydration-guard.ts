/** GitHub's React roots (custom elements); a server-rendered one is hydrated after the page loads */
const REACT_ROOT_SELECTOR = 'react-app, react-partial';

/** Class GitHub sets on a React root once React has rendered it */
const LOADED_CLASS = 'loaded';

/**
 * Inject anyway after this long, in case GitHub stops marking its roots as loaded
 * (if the root hydrates later after all, React renders it again once and the scan re-adds the buttons)
 */
const MAX_WAIT_MS = 10_000;

/**
 * Keeps the injectors out of server-rendered React roots until React has hydrated them.
 * An element added before hydration makes React's hydration fail: React then renders the whole
 * root again on the client, which removes the injected element and costs GitHub a full re-render.
 */
export class HydrationGuard {
	/** Roots with a pending wait */
	private readonly waiting = new WeakSet<Element>();

	/** Roots that were not marked as loaded in time; no longer waited for */
	private readonly expired = new WeakSet<Element>();

	/**
	 * @param onHydrated - Called when a root that was waited for has hydrated (or the wait timed out).
	 */
	constructor(private readonly onHydrated: () => void) {}

	/**
	 * Tells whether the element is inside a React root that is not hydrated yet; if so, waits
	 * for the root and calls `onHydrated` once it is.
	 *
	 * @param element - Element the injector would change.
	 * @returns `true` when the element must not be changed yet.
	 */
	public isPending(element: Element): boolean {
		const root = element.closest(REACT_ROOT_SELECTOR);
		if (
			!root ||
			root.getAttribute('data-ssr') !== 'true' ||
			root.classList.contains(LOADED_CLASS) ||
			this.expired.has(root)
		) {
			return false;
		}

		this.wait(root);
		return true;
	}

	private wait(root: Element): void {
		if (this.waiting.has(root)) {
			return;
		}

		this.waiting.add(root);
		// The callbacks run asynchronously, after `finish` is defined
		const observer = new MutationObserver(() => {
			if (root.classList.contains(LOADED_CLASS)) {
				finish();
			}
		});
		const timer = window.setTimeout(() => {
			this.expired.add(root);
			finish();
		}, MAX_WAIT_MS);
		const finish = (): void => {
			observer.disconnect();
			window.clearTimeout(timer);
			this.waiting.delete(root);
			// A root replaced by navigation needs no rescan: the page observer sees the new page
			if (root.isConnected) {
				this.onHydrated();
			}
		};

		observer.observe(root, {
			attributes: true,
			attributeFilter: ['class'],
		});
	}
}
