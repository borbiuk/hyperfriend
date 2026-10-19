import {
	COPY_BUTTON_SELECTOR,
	CopyButton,
	CopyButtonPlacement,
	TargetResolver,
} from '../components/copy-button';

import { ConfigStore } from './config-store';
import {
	normalizeText,
	parseDetailPage,
	parseListLink,
} from './link-target-parser';
import { detectPageKind, PageKind } from './page-detector';

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

/** Text of a `#123` number element next to a title */
const NUMBER_TEXT_REGEX = /^#\d+$/;

/**
 * Finds Pull Request / Issue titles on the page and injects copy buttons next to them.
 * Idempotent: safe to call on every DOM change.
 */
export class ButtonInjector {
	/**
	 * @param configStore - Source of the current config.
	 */
	constructor(private readonly configStore: ConfigStore) {}

	/** Title link each row button belongs to */
	private readonly rowAnchors = new WeakMap<Element, HTMLAnchorElement>();

	/**
	 * Scans the page and injects missing buttons; refreshes labels of existing ones.
	 */
	public scan(): void {
		this.removeStaleRowButtons();

		switch (detectPageKind()) {
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

		// The React PR header keeps `#123` next to the h1: the button goes after it, outside the heading.
		// The Issue page and the classic header keep `#123` inside the h1, which wraps long titles
		// and is followed by page actions: a sibling would sit at the far right edge and read as a
		// page action, so the button is appended inside the h1, right after the number. Trade-off:
		// there, the heading's accessible name includes the button label.
		const numberSibling = header.nextElementSibling;
		const button =
			numberSibling &&
			NUMBER_TEXT_REGEX.test(normalizeText(numberSibling.textContent))
				? this.ensureButtonAfter(
						numberSibling,
						resolver,
						CopyButtonPlacement.Title
					)
				: this.ensureButtonInside(header, resolver);

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
	 * Makes sure the header contains a copy button as its last child.
	 */
	private ensureButtonInside(
		header: Element,
		resolver: TargetResolver
	): HTMLButtonElement {
		const current = header.querySelector(
			`:scope > ${COPY_BUTTON_SELECTOR}`
		);
		const existing = CopyButton.from(current);
		if (existing) {
			existing.update(resolver);
			return existing.element;
		}

		current?.remove();
		const button = this.createButton(resolver, CopyButtonPlacement.Title);
		header.append(button);

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
