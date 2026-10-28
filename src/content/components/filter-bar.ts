import { createOcticon, FILTER_ICONS } from '../icons/octicons';

/** Marker value of the bar element (also used to remove copies, e.g. from Turbo snapshots) */
const BAR_MARKER = 'filter-bar';

/** Class of the text element of a chip */
const LABEL_CLASS = 'hyperfriend-filter-bar__label';

/**
 * What the bar shows for one chip.
 */
export interface FilterBarChip {
	/** Identifier passed back to the click callback */
	id: string;

	/** Text of the chip */
	label: string;

	/** Tooltip text */
	title: string;

	/** Octicon name of the icon before the text (see FILTER_ICONS) */
	icon: string;

	/** Colour name of the chip (`data-colour`; the default colour sets nothing) */
	colour: string;

	/** The chip filters the list now */
	active: boolean;

	/** An on/off button (`aria-pressed`); a chip with more states tells its state in its text */
	toggle: boolean;
}

/**
 * A row of toggle buttons ("chips") placed after the search box of a Pull Request list. Each chip is
 * a real button with `aria-pressed`; the caller decides what a click does.
 *
 * Text and attributes are written only when they change: a write is a DOM mutation, and the
 * page observer rescans the page on every mutation.
 */
export class FilterBar {
	private element: HTMLDivElement | null = null;

	/**
	 * @param onToggle - Called with the chip id when a chip is clicked.
	 */
	constructor(private readonly onToggle: (id: string) => void) {}

	/**
	 * Shows the bar right after the anchor with the given chips, creating or updating it.
	 *
	 * @param anchor - Element the bar is placed after.
	 * @param chips - Chips to show, in order.
	 */
	public sync(anchor: Element, chips: readonly FilterBarChip[]): void {
		const element = this.getElement();
		const signature = chips
			.map((chip) => `${chip.id}:${chip.icon}:${chip.colour}`)
			.join(' ');
		if (element.dataset.chips !== signature) {
			element.replaceChildren(
				...chips.map((chip) => this.createButton(chip))
			);
			element.dataset.chips = signature;
		}

		for (const chip of chips) {
			const button = element.querySelector<HTMLButtonElement>(
				`[data-chip="${chip.id}"]`
			);
			if (!button) {
				continue;
			}

			setText(
				button.querySelector<HTMLElement>(`.${LABEL_CLASS}`),
				chip.label
			);
			setAttribute(button, 'title', chip.title);
			if (chip.toggle) {
				setAttribute(button, 'aria-pressed', String(chip.active));
			}
			setFlag(button, 'data-active', chip.active);
		}

		if (anchor.nextElementSibling !== element) {
			anchor.after(element);
		}
	}

	/**
	 * Removes the bar from the page (when the page is not a Pull Request list, or the chips are off,
	 * or Turbo is about to keep the page in its snapshot).
	 */
	public remove(): void {
		this.element?.remove();
	}

	private getElement(): HTMLDivElement {
		const element = this.element ?? this.create();
		// Another copy (from a page snapshot) would show the chips twice
		document
			.querySelectorAll(`[data-hyperfriend="${BAR_MARKER}"]`)
			.forEach((copy) => {
				if (copy !== element) {
					copy.remove();
				}
			});
		this.element = element;

		return element;
	}

	private create(): HTMLDivElement {
		const element = document.createElement('div');
		element.className = 'hyperfriend-filter-bar';
		element.dataset.hyperfriend = BAR_MARKER;
		element.setAttribute('role', 'group');
		element.setAttribute('aria-label', 'Quick filters');

		return element;
	}

	private createButton(chip: FilterBarChip): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'hyperfriend-filter-bar__chip';
		button.dataset.chip = chip.id;
		button.addEventListener('click', () => this.onToggle(chip.id));

		if (chip.colour !== 'default') {
			button.dataset.colour = chip.colour;
		}

		const icon = FILTER_ICONS[chip.icon];
		if (icon) {
			button.append(createOcticon(icon));
		}

		const label = document.createElement('span');
		label.className = LABEL_CLASS;
		button.append(label);

		return button;
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
 * Adds or removes an attribute without a value, when it differs.
 */
function setFlag(element: Element, name: string, on: boolean): void {
	if (element.hasAttribute(name) !== on) {
		element.toggleAttribute(name, on);
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
