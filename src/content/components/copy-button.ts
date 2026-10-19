import { ConfigModel, LinkTargetModel } from '@shared/models';
import { copyLink, renderTemplate } from '@shared/services';

import {
	CHECK_ICON,
	COPY_ICON,
	createOcticon,
	Octicon,
	X_ICON,
} from '../icons/octicons';

/** Selector of injected copy buttons */
export const COPY_BUTTON_SELECTOR = '[data-hyperfriend="copy-button"]';

/** How long the copied / failed state is shown */
const FEEDBACK_DURATION_MS = 1500;

/** Keys that activate a button; stopped so list rows do not handle them as "open item" */
const ACTIVATION_KEYS = new Set(['Enter', ' ']);

/**
 * Resolves the Pull Request / Issue to copy; called on every click, so the title is always current.
 */
export type TargetResolver = () => LinkTargetModel | null;

/**
 * Where the button is placed; only affects spacing.
 */
export enum CopyButtonPlacement {
	/** Next to a title link in a list row */
	Row = 'row',

	/** Next to the title of a detail page */
	Title = 'title',
}

enum CopyButtonState {
	Idle = 'idle',
	Copied = 'copied',
	Failed = 'failed',
}

const STATE_ICONS: Record<CopyButtonState, Octicon> = {
	[CopyButtonState.Idle]: COPY_ICON,
	[CopyButtonState.Copied]: CHECK_ICON,
	[CopyButtonState.Failed]: X_ICON,
};

const STATE_LABELS: Record<
	Exclude<CopyButtonState, CopyButtonState.Idle>,
	string
> = {
	[CopyButtonState.Copied]: 'Copied!',
	[CopyButtonState.Failed]: 'Copy failed',
};

/**
 * Icon button that copies a rich link to a Pull Request or Issue.
 */
export class CopyButton {
	private static readonly instances = new WeakMap<Element, CopyButton>();

	/** The button element to insert into the page */
	public readonly element: HTMLButtonElement;

	private state = CopyButtonState.Idle;
	private resetTimer: number | undefined;

	/**
	 * @param resolveTarget - Resolves the item to copy.
	 * @param getConfig - Returns the current config synchronously.
	 * @param placement - Where the button is placed.
	 */
	constructor(
		private resolveTarget: TargetResolver,
		private readonly getConfig: () => ConfigModel,
		placement: CopyButtonPlacement
	) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = `hyperfriend-copy-button hyperfriend-copy-button--${placement}`;
		button.dataset.hyperfriend = 'copy-button';

		button.addEventListener('click', this.handleClick);
		button.addEventListener('auxclick', this.stopEvent);
		button.addEventListener('keydown', this.handleKey);
		button.addEventListener('keyup', this.handleKey);

		this.element = button;
		CopyButton.instances.set(button, this);
		this.render();
	}

	/**
	 * Returns the CopyButton instance of an injected button element.
	 *
	 * @param element - Element to look up.
	 * @returns The instance, or `null` if the element is not a copy button of this content script.
	 */
	public static from(element: Element | null | undefined): CopyButton | null {
		if (!element) {
			return null;
		}

		return CopyButton.instances.get(element) ?? null;
	}

	/**
	 * Replaces the target resolver and refreshes the label (e.g. after a re-render or a config change).
	 *
	 * @param resolveTarget - New resolver.
	 */
	public update(resolveTarget: TargetResolver): void {
		this.resolveTarget = resolveTarget;
		this.render();
	}

	private readonly handleClick = (event: MouseEvent): void => {
		// Rows are links / clickable containers: the button must never navigate
		event.preventDefault();
		event.stopPropagation();

		const target = this.resolveTarget();
		if (!target) {
			this.showFeedback(CopyButtonState.Failed);
			return;
		}

		// Called synchronously to keep the user activation required by the Clipboard API
		copyLink(target, this.getConfig()).then(
			() => this.showFeedback(CopyButtonState.Copied),
			(error: unknown) => {
				console.warn('[Hyperfriend] Failed to copy the link.', error);
				this.showFeedback(CopyButtonState.Failed);
			}
		);
	};

	private readonly handleKey = (event: KeyboardEvent): void => {
		if (!ACTIVATION_KEYS.has(event.key)) {
			return;
		}

		// Let the browser activate the button, but keep row keyboard handlers from opening the item
		event.stopPropagation();
	};

	private readonly stopEvent = (event: Event): void => {
		event.preventDefault();
		event.stopPropagation();
	};

	private showFeedback(state: CopyButtonState): void {
		window.clearTimeout(this.resetTimer);
		this.state = state;
		this.render();

		this.resetTimer = window.setTimeout(() => {
			this.state = CopyButtonState.Idle;
			this.render();
		}, FEEDBACK_DURATION_MS);
	}

	private getIdleLabel(): string {
		const target = this.resolveTarget();
		if (!target) {
			return 'Copy link';
		}

		const text = renderTemplate(
			this.getConfig().templates[target.type],
			target
		);

		return `Copy link: ${text}`;
	}

	private render(): void {
		const button = this.element;
		const label =
			this.state === CopyButtonState.Idle
				? this.getIdleLabel()
				: STATE_LABELS[this.state];

		if (button.dataset.state !== this.state) {
			button.dataset.state = this.state;
			button.replaceChildren(createOcticon(STATE_ICONS[this.state]));
		}

		if (button.getAttribute('aria-label') !== label) {
			button.setAttribute('aria-label', label);
			button.title = label;
		}
	}
}
