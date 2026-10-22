/** Marker value of the bar element (also used to remove copies, e.g. from Turbo snapshots) */
const BAR_MARKER = 'selection-bar';

/**
 * A small bar at the bottom of the viewport that shows how many list items are selected and
 * offers "Copy" and "Clear". It is a labelled region with two real buttons; the caller announces
 * the result messages through the tooltip's live region.
 *
 * Text and attributes are written only when they change: a write is a DOM mutation, and the
 * page observer rescans the page on every mutation.
 */
export class SelectionBar {
	private element: HTMLDivElement | null = null;
	private text: HTMLSpanElement | null = null;
	private copyButton: HTMLButtonElement | null = null;

	/**
	 * @param onCopy - Called when "Copy" is clicked (inside the click, to keep user activation).
	 * @param onClear - Called when "Clear" is clicked.
	 */
	constructor(
		private readonly onCopy: () => void,
		private readonly onClear: () => void
	) {}

	/**
	 * Shows the bar with the number of selected items.
	 *
	 * @param count - Selected items.
	 */
	public show(count: number): void {
		const element = this.getElement();
		this.setCount(count);
		setAttribute(element, 'data-visible', '');
	}

	/**
	 * Shows a result message instead of the count; "Copy" waits until the count is back
	 * (unless the result is a failure, so the user can try again).
	 *
	 * @param message - Text to show, e.g. "3 links copied".
	 * @param failed - The message reports a failure.
	 */
	public setMessage(message: string, failed = false): void {
		const element = this.getElement();
		setText(this.text, message);
		setAttribute(element, 'data-state', failed ? 'failed' : 'done');
		if (this.copyButton) {
			// Not `disabled`: the focused button must stay focusable until the bar goes away
			setAttribute(
				this.copyButton,
				'aria-disabled',
				failed ? 'false' : 'true'
			);
		}
	}

	/**
	 * Hides the bar.
	 */
	public hide(): void {
		this.element?.removeAttribute('data-visible');
		this.element?.removeAttribute('data-state');
	}

	/**
	 * Removes the bar, so Turbo does not keep it in its page snapshot.
	 */
	public detach(): void {
		this.hide();
		this.element?.remove();
	}

	/**
	 * Returns whether the keyboard focus is inside the bar.
	 */
	public containsFocus(): boolean {
		return this.element?.contains(document.activeElement) === true;
	}

	private setCount(count: number): void {
		const element = this.getElement();
		setText(this.text, `${count} selected`);
		element.removeAttribute('data-state');
		if (this.copyButton) {
			setText(this.copyButton, count === 1 ? 'Copy link' : 'Copy links');
			this.copyButton.removeAttribute('aria-disabled');
		}
	}

	private getElement(): HTMLDivElement {
		// Turbo replaces `document.body` on navigation, so the element is re-attached when needed
		if (this.element?.isConnected) {
			return this.element;
		}

		const element = this.element ?? this.create();
		document
			.querySelectorAll(`[data-hyperfriend="${BAR_MARKER}"]`)
			.forEach((copy) => {
				if (copy !== element) {
					copy.remove();
				}
			});
		document.body.appendChild(element);
		this.element = element;

		return element;
	}

	private create(): HTMLDivElement {
		const element = document.createElement('div');
		element.className = 'hyperfriend-selection-bar';
		element.dataset.hyperfriend = BAR_MARKER;
		element.setAttribute('role', 'region');
		element.setAttribute('aria-label', 'Selected links');

		const text = document.createElement('span');
		text.className = 'hyperfriend-selection-bar__text';

		const copyButton = document.createElement('button');
		copyButton.type = 'button';
		copyButton.className =
			'hyperfriend-selection-bar__button hyperfriend-selection-bar__button--primary';
		copyButton.addEventListener('click', () => {
			if (copyButton.getAttribute('aria-disabled') !== 'true') {
				this.onCopy();
			}
		});

		const clearButton = document.createElement('button');
		clearButton.type = 'button';
		clearButton.className = 'hyperfriend-selection-bar__button';
		clearButton.textContent = 'Clear';
		clearButton.addEventListener('click', () => this.onClear());

		element.append(text, copyButton, clearButton);
		this.text = text;
		this.copyButton = copyButton;

		return element;
	}
}

/**
 * Sets the text of an element when it differs.
 */
function setText(element: HTMLElement | null, value: string): void {
	if (element && element.textContent !== value) {
		element.textContent = value;
	}
}

/**
 * Sets an attribute when it differs.
 */
function setAttribute(element: Element, name: string, value: string): void {
	if (element.getAttribute(name) !== value) {
		element.setAttribute(name, value);
	}
}
