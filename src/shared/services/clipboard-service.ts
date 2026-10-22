import { ConfigModel, LinkFormat, LinkTargetModel } from '@shared/models';
import { escapeHtml } from '@shared/utils';

import { renderTemplateParts, TemplateParts } from './template-service';

/**
 * Clipboard contents for a link in every supported format.
 */
export interface LinkPayload {
	/** Rendered text, `before + link + after` (plain, not escaped, no template brackets) */
	text: string;

	/** Rendered text split around the hyperlink part */
	parts: TemplateParts;

	/** `BEFORE<a href="URL">LINK</a>AFTER`, all escaped */
	html: string;

	/** `TEXT — URL` */
	plain: string;

	/** `BEFORE[LINK](URL)AFTER`; `\`, `[` and `]` in the link text and a trailing `!` or `\` of BEFORE are escaped */
	markdown: string;
}

/**
 * Escapes the characters that would end or change a Markdown link text.
 */
function escapeMarkdownLinkText(text: string): string {
	return text.replace(/[\\[\]]/g, '\\$&');
}

/**
 * Escapes a trailing `!` or `\` of the text before a Markdown link: `![` would make an image and
 * `\[` would escape the link's own bracket. The rest of the text stays as typed.
 */
function escapeBeforeLink(before: string): string {
	return before.replace(/[!\\]$/, '\\$&');
}

/**
 * Clipboard contents for several links in every supported format.
 */
export interface LinksPayload {
	/** `<ul><li>LINK_HTML</li>...</ul>` */
	html: string;

	/** One `- TEXT — URL` line per link */
	plain: string;

	/** One `- [LINK](URL)` line per link (with the text around it) */
	markdown: string;
}

/**
 * Builds the clipboard payload for a list of links, one list item per link, in the given order.
 *
 * @param targets - The items to link.
 * @param config - Config holding the templates.
 * @returns HTML list, plain-text lines and Markdown lines.
 */
export function buildLinksPayload(
	targets: LinkTargetModel[],
	config: ConfigModel
): LinksPayload {
	const payloads = targets.map((target) => buildLinkPayload(target, config));

	return {
		html: `<ul>${payloads.map((payload) => `<li>${payload.html}</li>`).join('')}</ul>`,
		plain: payloads.map((payload) => `- ${payload.plain}`).join('\n'),
		markdown: payloads.map((payload) => `- ${payload.markdown}`).join('\n'),
	};
}

/**
 * Builds the clipboard payload for a link. Pure; used by copyLink, the popup preview and tests.
 *
 * @param target - The item (Pull Request, Issue, Discussion or workflow run) to link.
 * @param config - Config holding the templates.
 * @returns Text, HTML and plain-text representations.
 */
export function buildLinkPayload(
	target: LinkTargetModel,
	config: ConfigModel
): LinkPayload {
	const parts = renderTemplateParts(config.templates[target.type], target);
	const text = `${parts.before}${parts.link}${parts.after}`;
	const anchor = `<a href="${escapeHtml(target.url)}">${escapeHtml(parts.link)}</a>`;

	return {
		text,
		parts,
		html: `${escapeHtml(parts.before)}${anchor}${escapeHtml(parts.after)}`,
		plain: `${text} — ${target.url}`,
		markdown: `${escapeBeforeLink(parts.before)}[${escapeMarkdownLinkText(parts.link)}](${target.url})${parts.after}`,
	};
}

/**
 * Returns true when the async Clipboard API with ClipboardItem is available.
 */
function isClipboardApiAvailable(): boolean {
	return (
		typeof ClipboardItem !== 'undefined' &&
		typeof navigator !== 'undefined' &&
		typeof navigator.clipboard?.write === 'function'
	);
}

/**
 * Clipboard flavors (MIME type to content) of a link in the given format: rich is HTML plus the
 * plain-text fallback, Markdown is the Markdown source as plain text only (with an HTML flavor,
 * chats and editors would paste the link instead of the Markdown).
 */
function getFlavors(
	payload: Pick<LinkPayload, 'html' | 'plain' | 'markdown'>,
	format: LinkFormat
): Record<string, string> {
	if (format === LinkFormat.Markdown) {
		return { 'text/plain': payload.markdown };
	}

	return { 'text/html': payload.html, 'text/plain': payload.plain };
}

/**
 * Writes the flavors with the async Clipboard API.
 */
async function writeWithClipboardApi(
	flavors: Record<string, string>
): Promise<void> {
	const items: Record<string, Blob> = {};
	for (const [type, content] of Object.entries(flavors)) {
		items[type] = new Blob([content], { type });
	}

	await navigator.clipboard.write([new ClipboardItem(items)]);
}

/**
 * Writes the flavors via a one-shot `copy` event and `document.execCommand('copy')`.
 * The listener is registered on `window` in the capture phase and stops propagation,
 * so page-level copy handlers cannot override the payload.
 */
function writeWithExecCommand(flavors: Record<string, string>): void {
	const onCopy = (event: ClipboardEvent): void => {
		event.stopImmediatePropagation();
		if (!event.clipboardData) {
			return;
		}

		event.preventDefault();
		for (const [type, content] of Object.entries(flavors)) {
			event.clipboardData.setData(type, content);
		}
	};
	const options: AddEventListenerOptions = { capture: true };

	window.addEventListener('copy', onCopy, options);
	try {
		if (!document.execCommand('copy')) {
			throw new Error('document.execCommand("copy") failed');
		}
	} finally {
		window.removeEventListener('copy', onCopy, options);
	}
}

/**
 * Copies the link to the clipboard in the configured format: rich HTML plus plain text, or
 * Markdown as plain text. Uses the async Clipboard API, falling back to `execCommand('copy')`.
 *
 * Must be called directly from a user gesture (click handler). When the Clipboard API
 * is missing, the fallback runs synchronously, still inside the gesture. When the API
 * exists but `write` rejects, the fallback runs after an await; Firefox may then refuse
 * `execCommand('copy')` because the gesture has ended. The primary path covers
 * Firefox 127+ (ClipboardItem support), so this only affects edge cases.
 *
 * @param target - The item (Pull Request, Issue, Discussion or workflow run) to link.
 * @param config - Config holding the templates and the format.
 * @returns Resolves when copied; rejects if both methods fail.
 */
export async function copyLink(
	target: LinkTargetModel,
	config: ConfigModel
): Promise<void> {
	await writeFlavors(
		getFlavors(buildLinkPayload(target, config), config.format)
	);
}

/**
 * Copies several links to the clipboard as a list in the configured format: an HTML list plus
 * plain-text lines, or Markdown lines as plain text. Same gesture rules as copyLink.
 *
 * @param targets - The items to link, in the order of the list.
 * @param config - Config holding the templates and the format.
 * @returns Resolves when copied; rejects if both methods fail.
 */
export async function copyLinks(
	targets: LinkTargetModel[],
	config: ConfigModel
): Promise<void> {
	await writeFlavors(
		getFlavors(buildLinksPayload(targets, config), config.format)
	);
}

/**
 * Writes the flavors: the async Clipboard API, falling back to `execCommand('copy')`.
 * The write starts before the first `await`, so it keeps the user activation.
 */
async function writeFlavors(flavors: Record<string, string>): Promise<void> {
	if (!isClipboardApiAvailable()) {
		writeWithExecCommand(flavors);
		return;
	}

	try {
		await writeWithClipboardApi(flavors);
		return;
	} catch {
		// Fall through to the execCommand fallback.
	}

	writeWithExecCommand(flavors);
}
