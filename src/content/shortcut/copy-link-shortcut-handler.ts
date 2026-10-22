import { ShortcutType } from '@shared/models';
import { copyLink } from '@shared/services';

import { toast, ToastVariant } from '../components/toast';
import { ButtonInjector } from '../services/button-injector';
import { ConfigStore } from '../services/config-store';
import {
	isPullRequestConversation,
	isWorkflowRunSummary,
	PageKind,
} from '../services/page-detector';

import { ShortcutHandler } from './shortcut-handler';

/** Toast messages when the title button is not visible */
const TOAST_MESSAGES = {
	copied: 'Link copied',
	failed: 'Copy failed',
};

/**
 * Copies the link of the open Pull Request (Conversation tab only), Issue, Discussion or
 * workflow run (summary page only), exactly like the title copy button.
 */
export class CopyLinkShortcutHandler implements ShortcutHandler {
	/** @inheritdoc */
	public readonly type = ShortcutType.CopyLink;

	/**
	 * @param configStore - Source of the current config (templates).
	 * @param buttonInjector - Finds the title button and the detail page target.
	 */
	constructor(
		private readonly configStore: ConfigStore,
		private readonly buttonInjector: ButtonInjector
	) {}

	/** @inheritdoc */
	public isAvailable(kind: PageKind, location: Location | URL): boolean {
		if (kind === PageKind.Issue || kind === PageKind.Discussion) {
			return true;
		}

		if (kind === PageKind.WorkflowRun) {
			return isWorkflowRunSummary(location);
		}

		return (
			kind === PageKind.PullRequest && isPullRequestConversation(location)
		);
	}

	/** @inheritdoc */
	public handle(): void {
		// Every branch starts the clipboard write synchronously (no await before it)
		const button = this.buttonInjector.getTitleButton();
		if (button && isVisibleInViewport(button.element)) {
			// Same path as a click: "Copied!" / "Copy failed" in the button's tooltip
			void button.copy();
			return;
		}

		if (button) {
			void button.copy(false).then(showToast);
			return;
		}

		// The button is not injected yet (e.g. right after navigation)
		const target = this.buttonInjector.resolveDetailTarget();
		if (!target) {
			showToast(false);
			return;
		}

		copyLink(target, this.configStore.get()).then(
			() => showToast(true),
			(error: unknown) => {
				console.warn('[Hyperfriend] Failed to copy the link.', error);
				showToast(false);
			}
		);
	}
}

function showToast(copied: boolean): void {
	if (copied) {
		toast.show(TOAST_MESSAGES.copied, ToastVariant.Success);
		return;
	}

	toast.show(TOAST_MESSAGES.failed, ToastVariant.Danger);
}

/**
 * Returns whether the element is fully inside the viewport and not covered
 * (e.g. by a sticky header) at its center.
 */
function isVisibleInViewport(element: HTMLElement): boolean {
	const rect = element.getBoundingClientRect();
	if (rect.width === 0 || rect.height === 0) {
		return false;
	}

	const { clientWidth, clientHeight } = document.documentElement;
	if (
		rect.top < 0 ||
		rect.left < 0 ||
		rect.bottom > clientHeight ||
		rect.right > clientWidth
	) {
		return false;
	}

	const hit = document.elementFromPoint(
		rect.left + rect.width / 2,
		rect.top + rect.height / 2
	);

	return hit !== null && element.contains(hit);
}
