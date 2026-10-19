import { ConfigModel, LinkTargetModel } from '@shared/models';
import { escapeHtml } from '@shared/utils';

import { renderTemplate } from './template-service';

/**
 * Clipboard contents for a link in every supported format.
 */
export interface LinkPayload {
	/** Rendered link text (plain, not escaped) */
	text: string;

	/** `<a href="URL">TEXT</a>` with escaped URL and text */
	html: string;

	/** `TEXT — URL` */
	plain: string;
}

/**
 * Builds the clipboard payload for a link. Pure; used by copyLink, the popup preview and tests.
 *
 * @param target - The Pull Request or Issue to link.
 * @param config - Config holding the templates.
 * @returns Text, HTML and plain-text representations.
 */
export function buildLinkPayload(
	target: LinkTargetModel,
	config: ConfigModel
): LinkPayload {
	const text = renderTemplate(config.templates[target.type], target);

	return {
		text,
		html: `<a href="${escapeHtml(target.url)}">${escapeHtml(text)}</a>`,
		plain: `${text} — ${target.url}`,
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
 * Writes both formats with the async Clipboard API.
 */
async function writeWithClipboardApi(payload: LinkPayload): Promise<void> {
	await navigator.clipboard.write([
		new ClipboardItem({
			'text/html': new Blob([payload.html], { type: 'text/html' }),
			'text/plain': new Blob([payload.plain], { type: 'text/plain' }),
		}),
	]);
}

/**
 * Writes both formats via a one-shot `copy` event and `document.execCommand('copy')`.
 * The listener is registered on `window` in the capture phase and stops propagation,
 * so page-level copy handlers cannot override the payload.
 */
function writeWithExecCommand(payload: LinkPayload): void {
	const onCopy = (event: ClipboardEvent): void => {
		event.stopImmediatePropagation();
		if (!event.clipboardData) {
			return;
		}

		event.preventDefault();
		event.clipboardData.setData('text/html', payload.html);
		event.clipboardData.setData('text/plain', payload.plain);
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
 * Copies the link to the clipboard as rich HTML plus plain text.
 * Uses the async Clipboard API, falling back to `execCommand('copy')`.
 *
 * Must be called directly from a user gesture (click handler). When the Clipboard API
 * is missing, the fallback runs synchronously, still inside the gesture. When the API
 * exists but `write` rejects, the fallback runs after an await; Firefox may then refuse
 * `execCommand('copy')` because the gesture has ended. The primary path covers
 * Firefox 127+ (ClipboardItem support), so this only affects edge cases.
 *
 * @param target - The Pull Request or Issue to link.
 * @param config - Config holding the templates.
 * @returns Resolves when copied; rejects if both methods fail.
 */
export async function copyLink(
	target: LinkTargetModel,
	config: ConfigModel
): Promise<void> {
	const payload = buildLinkPayload(target, config);

	if (!isClipboardApiAvailable()) {
		writeWithExecCommand(payload);
		return;
	}

	try {
		await writeWithClipboardApi(payload);
		return;
	} catch {
		// Fall through to the execCommand fallback.
	}

	writeWithExecCommand(payload);
}
