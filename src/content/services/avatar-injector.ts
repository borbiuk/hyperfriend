import { LinkType } from '@shared/models';

import { normalizeText, parseListLink } from './link-target-parser';

/** Author login link of a list row (React list views; search results have no such link) */
const AUTHOR_LINK_SELECTOR = 'a[data-testid="author-filter-link"]';

/** Title link of a list row */
const ROW_TITLE_LINK_SELECTOR = 'a[data-testid="listitem-title-link"]';

/** Injected avatars */
const AVATAR_SELECTOR = 'img[data-hyperfriend="avatar"]';

/** `author:login` in the filter query of the author link */
const AUTHOR_QUERY_REGEX = /(?:^|\s)author:(\S+)/;

/** A GitHub login, including app bots such as `dependabot[bot]` */
const LOGIN_REGEX = /^[\w-]+(?:\[bot\])?$/;

/** Avatars GitHub renders itself (Primer Avatar, classic `.avatar`) */
const GITHUB_AVATAR_SELECTOR = '[data-component="Avatar"], img.avatar';

/**
 * Shows the author's avatar before the author login in Pull Request list rows.
 * Idempotent: safe to call on every DOM change.
 */
export class AvatarInjector {
	/** Logins whose avatar failed to load; not retried, to avoid a request loop */
	private readonly failed = new Set<string>();

	/**
	 * Removes stale avatars and adds missing ones. Call on list pages only.
	 */
	public scan(): void {
		// Stale: the author link after it was replaced or now shows another login,
		// or GitHub rendered its own avatar there later (e.g. after hydration)
		document
			.querySelectorAll<HTMLImageElement>(AVATAR_SELECTOR)
			.forEach((img) => {
				const next = img.nextElementSibling;
				if (
					!next?.matches(AUTHOR_LINK_SELECTOR) ||
					this.getLogin(next) !== img.dataset.login ||
					img.parentElement?.querySelector(GITHUB_AVATAR_SELECTOR)
				) {
					img.remove();
				}
			});

		for (const link of document.querySelectorAll(AUTHOR_LINK_SELECTOR)) {
			const login = this.getLogin(link);
			const row = link.closest('li, [role="listitem"]');
			const title = row?.querySelector<HTMLAnchorElement>(
				ROW_TITLE_LINK_SELECTOR
			);
			if (
				!login ||
				this.failed.has(login) ||
				!title ||
				parseListLink(title)?.type !== LinkType.PullRequest ||
				link.previousElementSibling?.matches(AVATAR_SELECTOR) ||
				link.parentElement?.querySelector(GITHUB_AVATAR_SELECTOR)
			) {
				continue;
			}

			link.before(this.createAvatar(login));
		}
	}

	/**
	 * Removes all injected avatars (when avatars are turned off). GitHub's own elements are
	 * never changed, so there is nothing else to restore.
	 */
	public removeAll(): void {
		document
			.querySelectorAll(AVATAR_SELECTOR)
			.forEach((img) => img.remove());
	}

	/**
	 * Returns the author login: from the link's `author:` filter (the text may be a display
	 * name such as "Jane Doe (jdoe)"), otherwise from its text.
	 */
	private getLogin(link: Element): string | null {
		let query: string | null = null;
		try {
			query = new URL(
				link.getAttribute('href') ?? '',
				window.location.href
			).searchParams.get('q');
		} catch {
			// Malformed href: fall back to the link text
		}

		const login =
			AUTHOR_QUERY_REGEX.exec(query ?? '')?.[1] ??
			normalizeText(link.textContent);

		return LOGIN_REGEX.test(login) ? login : null;
	}

	private createAvatar(login: string): HTMLImageElement {
		const img = document.createElement('img');
		img.className = 'hyperfriend-avatar';
		img.src = `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?size=32`;
		img.width = 16;
		img.height = 16;
		img.alt = '';
		img.loading = 'lazy';
		img.decoding = 'async';
		img.draggable = false;
		img.setAttribute('aria-hidden', 'true');
		img.dataset.hyperfriend = 'avatar';
		img.dataset.login = login;
		// No broken-image icon when the avatar can not be loaded
		img.addEventListener(
			'error',
			() => {
				this.failed.add(login);
				img.remove();
			},
			{ once: true }
		);

		return img;
	}
}
