import { LinkTargetModel } from '@shared/models';

import {
	COPY_BUTTON_SELECTOR,
	CopyButton,
	CopyButtonPlacement,
	TargetResolver,
} from '../components/copy-button';
import { tooltip } from '../components/tooltip';

import { ConfigStore } from './config-store';
import {
	findNumberElement,
	normalizeText,
	parseDetailPage,
	parseListLink,
} from './link-target-parser';
import { detectPageKind, PageKind } from './page-detector';

/** Keyboard shortcut of the title button for assistive technologies */
const KEY_SHORTCUTS_ATTRIBUTE = 'aria-keyshortcuts';

/** Marker set on hosts (title links / headers) that got a copy button */
const PROCESSED_ATTRIBUTE = 'data-hyperfriend-processed';

/** Title links of list rows: React list views, classic lists, search results */
const LIST_TITLE_LINK_SELECTOR = [
	'a[data-testid="listitem-title-link"]',
	'a[data-testid="issue-pr-title-link"]',
	'a[data-testid="issue-listitem-title-link"]',
	'a[id^="issue_"][id$="_link"]',
	'[data-testid="results-list"] .search-title a[href]',
].join(', ');

/** Fallback when none of the known title links are found: PR / Issue links in the main content */
const FALLBACK_LIST_LINK_SELECTOR = ['main', '[role="main"]']
	.flatMap((scope) => [
		`${scope} a[href*="/pull/"]`,
		`${scope} a[href*="/issues/"]`,
	])
	.join(', ');

/** Containers whose links are never list rows (hovercards, popovers, menus, our own UI) */
const EXCLUDED_CONTAINER_SELECTOR = [
	'[role="dialog"]',
	'[role="tooltip"]',
	'[role="menu"]',
	'.Popover',
	'.js-hovercard-content',
	'[data-hyperfriend]',
].join(', ');

/** Detail page title headers, most specific first */
const DETAIL_HEADER_SELECTORS = [
	'h1[data-component="PH_Title"]',
	// New pull request layout (Conversation and Commits tabs): the title text inside a Primer heading
	// (resolved to its h1 by findDetailHeader; no :has(), which older Chrome versions reject)
	'h1[data-component="Heading"] > .markdown-title',
	'[data-testid="issue-title"]',
	'.gh-header-title',
	'bdi.js-issue-title',
];

/** Sticky (scroll) headers repeat the title; the button goes into the main header only */
const STICKY_HEADER_SELECTOR =
	'.gh-header-sticky, .sticky-content, [data-hidden="true"]';

/** Row buttons, as injected for list rows */
const ROW_BUTTON_SELECTOR = `${COPY_BUTTON_SELECTOR}.hyperfriend-copy-button--${CopyButtonPlacement.Row}`;

/** Title buttons, as injected for detail pages */
const TITLE_BUTTON_SELECTOR = `${COPY_BUTTON_SELECTOR}.hyperfriend-copy-button--${CopyButtonPlacement.Title}`;

/** Title button inside a flex container that already has a gap: no own margin */
const FLUSH_CLASS = 'hyperfriend-copy-button--flush';

/** Title button in inline text (classic header): aligned to the line top plus an offset */
const INLINE_CLASS = 'hyperfriend-copy-button--inline';

/** Custom property holding that offset, so the button is centered on the line */
const INLINE_OFFSET_PROPERTY = '--hyperfriend-inline-offset';

/**
 * Finds Pull Request / Issue titles on the page and injects copy buttons next to them.
 * Idempotent: safe to call on every DOM change.
 */
export class ButtonInjector {
	/**
	 * @param configStore - Source of the current config.
	 * @param getKeyShortcuts - Returns the `aria-keyshortcuts` value of the title button
	 * (the copy link shortcut on this page), or `null` when no shortcut applies.
	 */
	constructor(
		private readonly configStore: ConfigStore,
		private readonly getKeyShortcuts: () => string | null = () => null
	) {}

	/** Title link each row button belongs to */
	private readonly rowAnchors = new WeakMap<Element, HTMLAnchorElement>();

	/**
	 * Returns the title copy button of the current detail page.
	 *
	 * @returns The button, or `null` when it is not injected (yet).
	 */
	public getTitleButton(): CopyButton | null {
		for (const element of document.querySelectorAll(
			TITLE_BUTTON_SELECTOR
		)) {
			const button = CopyButton.from(element);
			if (button) {
				return button;
			}
		}

		return null;
	}

	/**
	 * Resolves the Pull Request / Issue of the current detail page without a title button,
	 * from the title header or, failing that, the document title.
	 *
	 * @returns The target, or `null` if it can not be resolved.
	 */
	public resolveDetailTarget(): LinkTargetModel | null {
		return parseDetailPage(this.findDetailHeader());
	}

	/**
	 * Scans the page and injects missing buttons; refreshes labels of existing ones.
	 */
	public scan(): void {
		this.removeStaleRowButtons();
		tooltip.hideIfDetached();

		const kind = detectPageKind();
		if (kind === PageKind.Unsupported) {
			return;
		}

		// Before any button can be clicked, so the first "Copied!" is announced
		tooltip.attach();

		switch (kind) {
			case PageKind.List:
				this.scanList();
				return;
			case PageKind.PullRequest:
			case PageKind.Issue:
				this.scanDetail();
				return;
			default:
				return;
		}
	}

	private scanList(): void {
		let anchors = this.findListLinks(LIST_TITLE_LINK_SELECTOR);
		if (anchors.length === 0) {
			// Comment links (`#issuecomment-1`) and filtered links (`?q=`) are never row titles
			anchors = this.findListLinks(FALLBACK_LIST_LINK_SELECTOR).filter(
				(anchor) => !anchor.hash && !anchor.search
			);
		}

		for (const anchor of anchors) {
			const reference = this.getListReference(anchor);
			const resolver: TargetResolver = () => parseListLink(anchor);

			const button = this.ensureButtonAfter(
				reference,
				resolver,
				CopyButtonPlacement.Row
			);
			this.rowAnchors.set(button, anchor);
			anchor.setAttribute(PROCESSED_ATTRIBUTE, '');
		}
	}

	private scanDetail(): void {
		const header = this.findDetailHeader();
		if (!header) {
			return;
		}

		const resolver: TargetResolver = () => parseDetailPage(header);
		if (!resolver()) {
			return;
		}

		// The button follows the `#123` number, centered on its line:
		// - React PR header: the number is in an inline-flex wrapper next to the h1 (outside the heading);
		// - new PR layout: the number is in a suffix span right after the h1 (outside the heading);
		// - Issue page: the number is in an inline-flex wrapper inside the h1, together with GitHub's
		//   "Edit issue title" button (signed in); ours goes last, after it, using the wrapper's gap;
		// - classic header: the number is a plain span inside the h1; ours goes right after it.
		// On the Issue page and the classic header the button is inside the h1 on purpose: the h1
		// wraps long titles and is followed by page actions, so a sibling would sit at the far right
		// edge and read as a page action. Trade-off: there, the heading's accessible name includes
		// the button label.
		const number = findNumberElement(header);
		const container = number?.parentElement;
		let button: HTMLButtonElement;
		if (!number) {
			button = this.ensureButtonLast(header, resolver);
		} else if (
			container &&
			container !== header &&
			this.isFlex(container)
		) {
			button = this.ensureButtonLast(container, resolver);
		} else {
			button = this.ensureButtonAfter(
				number,
				resolver,
				CopyButtonPlacement.Title
			);
		}

		this.alignTitleButton(button);
		this.updateKeyShortcuts(button);

		header.setAttribute(PROCESSED_ATTRIBUTE, '');
		this.removeOtherTitleButtons(button);
	}

	/**
	 * Returns title links of list rows that point to a Pull Request or Issue.
	 */
	private findListLinks(selector: string): HTMLAnchorElement[] {
		return Array.from(
			document.querySelectorAll<HTMLAnchorElement>(selector)
		).filter(
			(anchor) =>
				!anchor.closest(EXCLUDED_CONTAINER_SELECTOR) &&
				parseListLink(anchor) !== null
		);
	}

	/**
	 * Returns the element the button is inserted after: the heading wrapping the link
	 * (so the button is not part of the heading name), otherwise the link itself.
	 */
	private getListReference(anchor: HTMLAnchorElement): Element {
		const parent = anchor.parentElement;
		if (
			parent &&
			/^H[1-6]$/.test(parent.tagName) &&
			normalizeText(parent.textContent) ===
				normalizeText(anchor.textContent)
		) {
			return parent;
		}

		return anchor;
	}

	/**
	 * Flex wrappers center the button themselves (and may space it with their gap);
	 * in inline text (classic header) it is centered on the line box with a top offset.
	 */
	private alignTitleButton(button: HTMLButtonElement): void {
		const parent = button.parentElement;
		if (!parent) {
			return;
		}

		const inFlex = this.isFlex(parent);
		button.classList.toggle(FLUSH_CLASS, inFlex && this.hasGap(parent));
		button.classList.toggle(INLINE_CLASS, !inFlex);
		if (inFlex) {
			button.style.removeProperty(INLINE_OFFSET_PROPERTY);
			return;
		}

		const lineHeight = parseFloat(getComputedStyle(parent).lineHeight);
		const offset = Number.isFinite(lineHeight)
			? Math.max(0, (lineHeight - button.offsetHeight) / 2)
			: 0;
		const value = `${offset}px`;
		if (button.style.getPropertyValue(INLINE_OFFSET_PROPERTY) !== value) {
			button.style.setProperty(INLINE_OFFSET_PROPERTY, value);
		}
	}

	/**
	 * Announces the copy link shortcut on the title button while it is enabled (no visible hint).
	 */
	private updateKeyShortcuts(button: HTMLButtonElement): void {
		const value = this.getKeyShortcuts();
		if (value === null) {
			button.removeAttribute(KEY_SHORTCUTS_ATTRIBUTE);
			return;
		}

		if (button.getAttribute(KEY_SHORTCUTS_ATTRIBUTE) !== value) {
			button.setAttribute(KEY_SHORTCUTS_ATTRIBUTE, value);
		}
	}

	private isFlex(element: Element): boolean {
		return getComputedStyle(element).display.includes('flex');
	}

	private hasGap(element: Element): boolean {
		const style = getComputedStyle(element);
		return (
			style.display.includes('flex') && parseFloat(style.columnGap) > 0
		);
	}

	/**
	 * Returns the main title header of a detail page.
	 */
	private findDetailHeader(): Element | null {
		for (const selector of DETAIL_HEADER_SELECTORS) {
			for (const element of document.querySelectorAll(selector)) {
				if (element.closest(STICKY_HEADER_SELECTOR)) {
					continue;
				}

				return element.closest('h1') ?? element;
			}
		}

		return null;
	}

	/**
	 * Makes sure a copy button directly follows the reference element.
	 * Checks the actual sibling (not only a marker), because React may recreate nodes.
	 */
	private ensureButtonAfter(
		reference: Element,
		resolver: TargetResolver,
		placement: CopyButtonPlacement
	): HTMLButtonElement {
		const sibling = reference.nextElementSibling;
		const existing = CopyButton.from(sibling);
		if (existing) {
			existing.update(resolver);
			return existing.element;
		}

		const button = this.createButton(resolver, placement);
		if (sibling?.matches(COPY_BUTTON_SELECTOR)) {
			// Left by a previous instance of the content script (e.g. after an extension update)
			sibling.replaceWith(button);
		} else {
			reference.after(button);
		}

		return button;
	}

	/**
	 * Makes sure the container has a title copy button as its last child
	 * (moved back to the end if GitHub appends its own controls later).
	 */
	private ensureButtonLast(
		container: Element,
		resolver: TargetResolver
	): HTMLButtonElement {
		const current = container.querySelector(
			`:scope > ${COPY_BUTTON_SELECTOR}`
		);
		const existing = CopyButton.from(current);
		if (existing) {
			existing.update(resolver);
			// Moving a focused / hovered button would drop focus and leave the tooltip behind;
			// it is moved on a later scan instead
			const button = existing.element;
			const busy =
				button.contains(document.activeElement) ||
				tooltip.isShownFor(button);
			if (container.lastElementChild !== button && !busy) {
				container.append(button);
			}

			return button;
		}

		current?.remove();
		const button = this.createButton(resolver, CopyButtonPlacement.Title);
		container.append(button);

		return button;
	}

	private createButton(
		resolver: TargetResolver,
		placement: CopyButtonPlacement
	): HTMLButtonElement {
		return new CopyButton(resolver, () => this.configStore.get(), placement)
			.element;
	}

	/**
	 * Removes row buttons whose title link was replaced or moved (React may recreate only the link)
	 * and buttons left by a previous instance of the content script.
	 */
	private removeStaleRowButtons(): void {
		document.querySelectorAll(ROW_BUTTON_SELECTOR).forEach((button) => {
			const anchor = this.rowAnchors.get(button);
			if (
				anchor?.isConnected &&
				button.previousElementSibling === this.getListReference(anchor)
			) {
				return;
			}

			button.remove();
		});
	}

	/**
	 * Removes title buttons left in another place (e.g. when the header layout changed).
	 */
	private removeOtherTitleButtons(keep: HTMLButtonElement): void {
		document.querySelectorAll(TITLE_BUTTON_SELECTOR).forEach((button) => {
			if (button !== keep) {
				button.remove();
			}
		});
	}
}
