import { expect, test } from '@playwright/test';
import { DEFAULT_CONFIG } from '@shared/constants';
import { ConfigModel, LinkTargetModel, LinkType } from '@shared/models';
import {
	buildLinkPayload,
	cloneDefaultConfig,
	copyLink,
} from '@shared/services';

// Byte-exact payload: the e2e tests compare clipboard HTML after Chromium re-serializes it, which
// drops the escaping of quotes in text, so the escaping itself is proven here.

/**
 * Pull request 9713 of react/react with the given title.
 *
 * @param title - Title of the pull request.
 */
function pullRequest(title: string): LinkTargetModel {
	return {
		type: LinkType.PullRequest,
		owner: 'react',
		repo: 'react',
		number: 9713,
		title,
		url: 'https://github.com/react/react/pull/9713',
	};
}

/**
 * Default config with the given pull request template.
 *
 * @param template - Pull request template.
 */
function withPullRequestTemplate(template: string): ConfigModel {
	const config = cloneDefaultConfig();
	config.templates[LinkType.PullRequest] = template;
	return config;
}

test('should escape tags and quotes of the title in the default pull request payload', () => {
	const title =
		"[#9712] fix <input type=\"number\" /> value '.98' should not be equal to '0.98'.";

	expect(buildLinkPayload(pullRequest(title), DEFAULT_CONFIG)).toEqual({
		text: `PR 9713: ${title}`,
		parts: { before: '', link: 'PR 9713', after: `: ${title}` },
		html: '<a href="https://github.com/react/react/pull/9713">PR 9713</a>: [#9712] fix &lt;input type=&quot;number&quot; /&gt; value &#39;.98&#39; should not be equal to &#39;0.98&#39;.',
		plain: `PR 9713: ${title} — https://github.com/react/react/pull/9713`,
	});
});

test('should escape an ampersand of the title once in the default pull request payload', () => {
	const title = 'Docs: R&D notes &amp; links';

	expect(buildLinkPayload(pullRequest(title), DEFAULT_CONFIG)).toEqual({
		text: `PR 9713: ${title}`,
		parts: { before: '', link: 'PR 9713', after: `: ${title}` },
		html: '<a href="https://github.com/react/react/pull/9713">PR 9713</a>: Docs: R&amp;D notes &amp;amp; links',
		plain: `PR 9713: ${title} — https://github.com/react/react/pull/9713`,
	});
});

test('should build the default issue payload from the issue template', () => {
	const issue: LinkTargetModel = {
		type: LinkType.Issue,
		owner: 'react',
		repo: 'react',
		number: 10,
		title: 'Crash on <select>',
		url: 'https://github.com/react/react/issues/10',
	};

	expect(buildLinkPayload(issue, DEFAULT_CONFIG)).toEqual({
		text: 'Issue 10: Crash on <select>',
		parts: { before: '', link: 'Issue 10', after: ': Crash on <select>' },
		html: '<a href="https://github.com/react/react/issues/10">Issue 10</a>: Crash on &lt;select&gt;',
		plain: 'Issue 10: Crash on <select> — https://github.com/react/react/issues/10',
	});
});

test('should build the payload from a custom template with text on both sides of the link', () => {
	const config = withPullRequestTemplate(
		'{{owner}}/{{repo}}#[{{pr_number}}] {{pr_name}}'
	);

	expect(buildLinkPayload(pullRequest('Fix input'), config)).toEqual({
		text: 'react/react#9713 Fix input',
		parts: { before: 'react/react#', link: '9713', after: ' Fix input' },
		html: 'react/react#<a href="https://github.com/react/react/pull/9713">9713</a> Fix input',
		plain: 'react/react#9713 Fix input — https://github.com/react/react/pull/9713',
	});
});

test('should link the whole text when the custom template has no link segment', () => {
	const config = withPullRequestTemplate('{{pr_name}} (#{{pr_number}})');

	expect(buildLinkPayload(pullRequest('Fix input'), config)).toEqual({
		text: 'Fix input (#9713)',
		parts: { before: '', link: 'Fix input (#9713)', after: '' },
		html: '<a href="https://github.com/react/react/pull/9713">Fix input (#9713)</a>',
		plain: 'Fix input (#9713) — https://github.com/react/react/pull/9713',
	});
});

test('should put the URL as the link text when the template is "[{{url}}] {{pr_name}}"', () => {
	const config = withPullRequestTemplate('[{{url}}] {{pr_name}}');

	expect(buildLinkPayload(pullRequest('Fix input'), config)).toEqual({
		text: 'https://github.com/react/react/pull/9713 Fix input',
		parts: {
			before: '',
			link: 'https://github.com/react/react/pull/9713',
			after: ' Fix input',
		},
		html: '<a href="https://github.com/react/react/pull/9713">https://github.com/react/react/pull/9713</a> Fix input',
		plain: 'https://github.com/react/react/pull/9713 Fix input — https://github.com/react/react/pull/9713',
	});
});

test('should fall back to the default pull request template when the stored one is empty', () => {
	const config = withPullRequestTemplate('');

	expect(buildLinkPayload(pullRequest('Fix input'), config)).toEqual({
		text: 'PR 9713: Fix input',
		parts: { before: '', link: 'PR 9713', after: ': Fix input' },
		html: '<a href="https://github.com/react/react/pull/9713">PR 9713</a>: Fix input',
		plain: 'PR 9713: Fix input — https://github.com/react/react/pull/9713',
	});
});

test('should escape the text before, inside and after the link', () => {
	const config = withPullRequestTemplate(
		"<b>\"[{{pr_number}} & 'x']</b> {{pr_name}}"
	);

	expect(buildLinkPayload(pullRequest("It's <ok>"), config)).toEqual({
		text: "<b>\"9713 & 'x'</b> It's <ok>",
		parts: {
			before: '<b>"',
			link: "9713 & 'x'",
			after: "</b> It's <ok>",
		},
		html: '&lt;b&gt;&quot;<a href="https://github.com/react/react/pull/9713">9713 &amp; &#39;x&#39;</a>&lt;/b&gt; It&#39;s &lt;ok&gt;',
		plain: "<b>\"9713 & 'x'</b> It's <ok> — https://github.com/react/react/pull/9713",
	});
});

test('should escape the URL in the href and keep it raw in the plain text', () => {
	const target: LinkTargetModel = {
		...pullRequest('Fix input'),
		url: 'https://github.com/react/react/pull/9713?a=1&b="2"',
	};

	expect(buildLinkPayload(target, DEFAULT_CONFIG)).toEqual({
		text: 'PR 9713: Fix input',
		parts: { before: '', link: 'PR 9713', after: ': Fix input' },
		html: '<a href="https://github.com/react/react/pull/9713?a=1&amp;b=&quot;2&quot;">PR 9713</a>: Fix input',
		plain: 'PR 9713: Fix input — https://github.com/react/react/pull/9713?a=1&b="2"',
	});
});

test.describe('copyLink', () => {
	/** Payload of pullRequest('Fix <input>') with the default template */
	const EXPECTED_DATA = {
		'text/html':
			'<a href="https://github.com/react/react/pull/9713">PR 9713</a>: Fix &lt;input&gt;',
		'text/plain':
			'PR 9713: Fix <input> — https://github.com/react/react/pull/9713',
	};

	/** What the fake browser saw of one copy */
	interface ClipboardLog {
		/** Data per type written with navigator.clipboard.write */
		apiWrites: Record<string, string>[];
		/** Data per type set in the `copy` event of execCommand('copy') */
		copyEvents: {
			data: Record<string, string>;
			defaultPrevented: boolean;
			propagationStopped: boolean;
		}[];
		/** `copy` listeners left on window */
		copyListeners: number;
	}

	interface FakeBrowserOptions {
		/** The async Clipboard API with ClipboardItem exists */
		clipboardApi: boolean;
		/** navigator.clipboard.write rejects */
		apiRejects?: boolean;
		/** document.execCommand('copy') returns this */
		execCommandResult?: boolean;
	}

	const GLOBALS = ['navigator', 'ClipboardItem', 'window', 'document'];
	let originals: Map<string, PropertyDescriptor | undefined>;

	test.beforeEach(() => {
		originals = new Map(
			GLOBALS.map((name) => [
				name,
				Object.getOwnPropertyDescriptor(globalThis, name),
			])
		);
	});

	test.afterEach(() => {
		for (const [name, descriptor] of originals) {
			if (descriptor) {
				Object.defineProperty(globalThis, name, descriptor);
			} else {
				Reflect.deleteProperty(globalThis, name);
			}
		}
	});

	/**
	 * Installs a minimal clipboard environment on globalThis for one test.
	 *
	 * @returns The log the fake fills while copying.
	 */
	function installFakeBrowser(options: FakeBrowserOptions): ClipboardLog {
		const log: ClipboardLog = {
			apiWrites: [],
			copyEvents: [],
			copyListeners: 0,
		};
		const listeners = new Set<EventListener>();

		class FakeClipboardItem {
			constructor(readonly items: Record<string, Blob>) {}
		}

		const define = (name: string, value: unknown): void => {
			Object.defineProperty(globalThis, name, {
				configurable: true,
				writable: true,
				value,
			});
		};

		define('navigator', {
			clipboard: options.clipboardApi
				? {
						write: async (
							items: FakeClipboardItem[]
						): Promise<void> => {
							if (options.apiRejects) {
								throw new DOMException(
									'Document is not focused.'
								);
							}

							for (const item of items) {
								const data: Record<string, string> = {};
								for (const [type, blob] of Object.entries(
									item.items
								)) {
									data[type] = await blob.text();
								}

								log.apiWrites.push(data);
							}
						},
					}
				: undefined,
		});
		define(
			'ClipboardItem',
			options.clipboardApi ? FakeClipboardItem : undefined
		);
		define('window', {
			addEventListener: (
				type: string,
				listener: EventListener,
				listenerOptions: AddEventListenerOptions
			): void => {
				if (type === 'copy' && listenerOptions?.capture === true) {
					listeners.add(listener);
					log.copyListeners = listeners.size;
				}
			},
			removeEventListener: (
				type: string,
				listener: EventListener,
				listenerOptions: AddEventListenerOptions
			): void => {
				if (type === 'copy' && listenerOptions?.capture === true) {
					listeners.delete(listener);
					log.copyListeners = listeners.size;
				}
			},
		});
		define('document', {
			execCommand: (command: string): boolean => {
				if (command !== 'copy') {
					return false;
				}

				const entry = {
					data: {} as Record<string, string>,
					defaultPrevented: false,
					propagationStopped: false,
				};
				const event = {
					clipboardData: {
						setData: (type: string, value: string): void => {
							entry.data[type] = value;
						},
					},
					preventDefault: (): void => {
						entry.defaultPrevented = true;
					},
					stopImmediatePropagation: (): void => {
						entry.propagationStopped = true;
					},
				} as unknown as Event;
				for (const listener of listeners) {
					listener(event);
				}

				log.copyEvents.push(entry);
				return options.execCommandResult ?? true;
			},
		});

		return log;
	}

	test('should write both formats with the Clipboard API when it is available', async () => {
		const log = installFakeBrowser({ clipboardApi: true });

		await copyLink(pullRequest('Fix <input>'), DEFAULT_CONFIG);

		expect(log).toEqual({
			apiWrites: [EXPECTED_DATA],
			copyEvents: [],
			copyListeners: 0,
		});
	});

	test('should copy through execCommand and a capturing copy listener when the Clipboard API is missing', async () => {
		const log = installFakeBrowser({ clipboardApi: false });

		await copyLink(pullRequest('Fix <input>'), DEFAULT_CONFIG);

		expect(log).toEqual({
			apiWrites: [],
			copyEvents: [
				{
					data: EXPECTED_DATA,
					defaultPrevented: true,
					propagationStopped: true,
				},
			],
			copyListeners: 0,
		});
	});

	test('should fall back to execCommand when the Clipboard API rejects', async () => {
		const log = installFakeBrowser({
			clipboardApi: true,
			apiRejects: true,
		});

		await copyLink(pullRequest('Fix <input>'), DEFAULT_CONFIG);

		expect(log).toEqual({
			apiWrites: [],
			copyEvents: [
				{
					data: EXPECTED_DATA,
					defaultPrevented: true,
					propagationStopped: true,
				},
			],
			copyListeners: 0,
		});
	});

	test('should reject and remove the copy listener when execCommand fails too', async () => {
		const log = installFakeBrowser({
			clipboardApi: true,
			apiRejects: true,
			execCommandResult: false,
		});

		await expect(
			copyLink(pullRequest('Fix <input>'), DEFAULT_CONFIG)
		).rejects.toThrow('document.execCommand("copy") failed');
		expect(log.copyListeners).toBe(0);
	});
});
