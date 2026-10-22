import { expect, test } from '@playwright/test';
import {
	ConfigModel,
	LinkFormat,
	LinkType,
	ShortcutType,
} from '@shared/models';
import {
	cloneDefaultConfig,
	configService,
	toStoredConfig,
} from '@shared/services';

// configService keeps module state: the write queue and the "storage unavailable" warning flag.
// Every test awaits all of its writes, so the queue is idle between tests; no test asserts on the
// warning, which is logged once per module instance.

const KEY = 'hyperfriend-config';

/** Listener of chrome.storage.onChanged */
type ChangeListener = (
	changes: Record<string, chrome.storage.StorageChange>,
	areaName: string
) => void;

/**
 * In-memory stand-in for `chrome.storage.sync` and `chrome.storage.onChanged`: promise API,
 * values cloned on write and read, change events with `oldValue` / `newValue` in area `sync`.
 */
class FakeSyncStorage {
	/** Number of `set` and `remove` calls */
	writes = 0;

	private readonly items = new Map<string, unknown>();
	private readonly listeners = new Set<ChangeListener>();
	private readonly setFailures: Error[] = [];
	private readonly getFailures: Error[] = [];

	/** Makes the next `set` reject with the given error */
	failNextSet(error: Error): void {
		this.setFailures.push(error);
	}

	/** Makes the next `get` reject with the given error */
	failNextGet(error: Error): void {
		this.getFailures.push(error);
	}

	/**
	 * Stores a value without a change event, as data written by an earlier version.
	 * `undefined` stores nothing, as chrome.storage can't hold it: the key stays missing.
	 */
	seed(key: string, value: unknown): void {
		if (value === undefined) {
			return;
		}

		this.items.set(key, structuredClone(value));
	}

	/** Copy of everything stored */
	dump(): Record<string, unknown> {
		return structuredClone(Object.fromEntries(this.items));
	}

	/** Fires a change event as if another context had changed storage */
	emit(
		changes: Record<string, chrome.storage.StorageChange>,
		areaName: string
	): void {
		for (const listener of this.listeners) {
			listener(structuredClone(changes), areaName);
		}
	}

	/** The fake `chrome` global */
	toChrome(): typeof chrome {
		const sync = {
			get: async (
				keys?: string | string[] | null
			): Promise<Record<string, unknown>> => {
				await Promise.resolve();
				const failure = this.getFailures.shift();
				if (failure) {
					throw failure;
				}

				const names =
					keys === null || keys === undefined
						? [...this.items.keys()]
						: [keys].flat();
				const result: Record<string, unknown> = {};
				for (const name of names) {
					if (this.items.has(name)) {
						result[name] = structuredClone(this.items.get(name));
					}
				}

				return result;
			},
			set: async (values: Record<string, unknown>): Promise<void> => {
				await Promise.resolve();
				const failure = this.setFailures.shift();
				if (failure) {
					throw failure;
				}

				this.writes++;
				const changes: Record<string, chrome.storage.StorageChange> =
					{};
				for (const [name, value] of Object.entries(values)) {
					const change: chrome.storage.StorageChange = {
						newValue: structuredClone(value),
					};
					if (this.items.has(name)) {
						change.oldValue = structuredClone(this.items.get(name));
					}

					this.items.set(name, structuredClone(value));
					changes[name] = change;
				}

				this.emit(changes, 'sync');
			},
			remove: async (keys: string | string[]): Promise<void> => {
				await Promise.resolve();
				this.writes++;
				const changes: Record<string, chrome.storage.StorageChange> =
					{};
				for (const name of [keys].flat()) {
					if (this.items.has(name)) {
						changes[name] = {
							oldValue: structuredClone(this.items.get(name)),
						};
						this.items.delete(name);
					}
				}

				if (Object.keys(changes).length > 0) {
					this.emit(changes, 'sync');
				}
			},
			clear: async (): Promise<void> => {
				await sync.remove([...this.items.keys()]);
			},
		};
		const onChanged = {
			addListener: (listener: ChangeListener): void => {
				this.listeners.add(listener);
			},
			removeListener: (listener: ChangeListener): void => {
				this.listeners.delete(listener);
			},
			hasListener: (listener: ChangeListener): boolean =>
				this.listeners.has(listener),
		};

		return { storage: { sync, onChanged } } as unknown as typeof chrome;
	}
}

let storage: FakeSyncStorage;
let originalChrome: PropertyDescriptor | undefined;

/**
 * Replaces the `chrome` global for one test.
 *
 * @param value - The fake global, or undefined for an environment without it.
 */
function setChrome(value: typeof chrome | undefined): void {
	Object.defineProperty(globalThis, 'chrome', {
		configurable: true,
		writable: true,
		value,
	});
}

test.beforeEach(() => {
	originalChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
	storage = new FakeSyncStorage();
	setChrome(storage.toChrome());
});

test.afterEach(() => {
	if (originalChrome) {
		Object.defineProperty(globalThis, 'chrome', originalChrome);
	} else {
		Reflect.deleteProperty(globalThis, 'chrome');
	}
});

/** The defaults, written out as the oracle */
const DEFAULTS: ConfigModel = {
	format: LinkFormat.Rich,
	templates: {
		[LinkType.PullRequest]: '[PR {{pr_number}}]: {{pr_name}}',
		[LinkType.Issue]: '[Issue {{issue_number}}]: {{issue_name}}',
	},
	shortcuts: {
		[ShortcutType.CopyLink]: { keys: ['Shift', 'KeyC'], enabled: true },
	},
	display: { authorAvatars: true },
};

/** A stored value in the current format that differs from the defaults in every setting */
const CUSTOM_STORED = {
	templates: {
		'pull-request': '#{{pr_number}} [{{pr_name}}]',
		issue: '[#{{issue_number}}] {{issue_name}}',
	},
	format: 'markdown',
	shortcuts: {
		'copy-link': { keys: ['Alt', 'Shift', 'KeyL'], enabled: false },
	},
	display: { authorAvatars: false },
	templateFormat: 2,
};

test.describe('get', () => {
	const CASES: { title: string; stored: unknown; expected: ConfigModel }[] = [
		{
			title: 'should return the stored config in the current format as is',
			stored: CUSTOM_STORED,
			expected: {
				format: LinkFormat.Markdown,
				templates: {
					[LinkType.PullRequest]: '#{{pr_number}} [{{pr_name}}]',
					[LinkType.Issue]: '[#{{issue_number}}] {{issue_name}}',
				},
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Alt', 'Shift', 'KeyL'],
						enabled: false,
					},
				},
				display: { authorAvatars: false },
			},
		},
		{
			title: 'should read the stored copy format "markdown"',
			stored: { format: 'markdown', templateFormat: 2 },
			expected: { ...DEFAULTS, format: LinkFormat.Markdown },
		},
		{
			title: 'should use the default format for an unknown stored format',
			stored: { format: 'html', templateFormat: 2 },
			expected: DEFAULTS,
		},
		{
			title: 'should use the default format when none is stored (data of 2.2.x and older)',
			stored: { display: { authorAvatars: true }, templateFormat: 2 },
			expected: DEFAULTS,
		},
		{
			title: 'should load 1.0.0 data (templates only) with converted templates and default shortcuts and display',
			stored: {
				templates: {
					'pull-request': 'PR {{pr_number}}: {{pr_name}}',
					issue: '#{{issue_number}} [{{issue_name}}]',
				},
			},
			expected: {
				format: LinkFormat.Rich,
				templates: {
					[LinkType.PullRequest]: '[PR {{pr_number}}]: {{pr_name}}',
					[LinkType.Issue]: '#{{issue_number}} \\[{{issue_name}}\\]',
				},
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Shift', 'KeyC'],
						enabled: true,
					},
				},
				display: { authorAvatars: true },
			},
		},
		{
			title: 'should convert the templates of 2.0.0 data without the format marker',
			stored: {
				templates: { issue: 'Issue {{issue_number}}: {{issue_name}}' },
				shortcuts: {
					'copy-link': { keys: ['Alt', 'KeyL'], enabled: true },
				},
				display: { authorAvatars: false },
			},
			expected: {
				format: LinkFormat.Rich,
				templates: {
					[LinkType.PullRequest]: '[PR {{pr_number}}]: {{pr_name}}',
					[LinkType.Issue]:
						'[Issue {{issue_number}}]: {{issue_name}}',
				},
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Alt', 'KeyL'],
						enabled: true,
					},
				},
				display: { authorAvatars: false },
			},
		},
		{
			title: 'should convert the templates when the format marker is the string "2"',
			stored: { ...CUSTOM_STORED, templateFormat: '2' },
			expected: {
				format: LinkFormat.Markdown,
				templates: {
					[LinkType.PullRequest]: '#{{pr_number}} \\[{{pr_name}}\\]',
					[LinkType.Issue]: '\\[#{{issue_number}}\\] {{issue_name}}',
				},
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Alt', 'Shift', 'KeyL'],
						enabled: false,
					},
				},
				display: { authorAvatars: false },
			},
		},
		{
			title: 'should convert the templates when the format marker is the older 1',
			stored: { templates: { issue: '[x]' }, templateFormat: 1 },
			expected: {
				...DEFAULTS,
				templates: {
					...DEFAULTS.templates,
					[LinkType.Issue]: '\\[x\\]',
				},
			},
		},
		{
			title: 'should return the defaults when nothing is stored under the key',
			stored: undefined,
			expected: DEFAULTS,
		},
		{
			title: 'should return the defaults for a stored string',
			stored: 'config',
			expected: DEFAULTS,
		},
		{
			title: 'should return the defaults for a stored array',
			stored: [CUSTOM_STORED],
			expected: DEFAULTS,
		},
		{
			title: 'should ignore templates that are not strings and unknown link types',
			stored: {
				templates: {
					'pull-request': 42,
					issue: null,
					'merge-request': '[MR]',
				},
				templateFormat: 2,
			},
			expected: DEFAULTS,
		},
		{
			title: 'should ignore sections of the wrong type',
			stored: {
				templates: ['[PR]'],
				shortcuts: 'Shift+KeyC',
				display: true,
				templateFormat: 2,
			},
			expected: DEFAULTS,
		},
		{
			title: 'should keep the default shortcut for keys given as a string and a non-boolean "enabled"',
			stored: {
				shortcuts: { 'copy-link': { keys: 'Alt+KeyL', enabled: 'no' } },
				templateFormat: 2,
			},
			expected: DEFAULTS,
		},
		{
			title: 'should keep the default keys for stored keys without a modifier and use the stored "enabled"',
			stored: {
				shortcuts: { 'copy-link': { keys: ['KeyL'], enabled: false } },
				templateFormat: 2,
			},
			expected: {
				...DEFAULTS,
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Shift', 'KeyC'],
						enabled: false,
					},
				},
			},
		},
		{
			title: 'should keep the default keys for browser-reserved stored keys',
			stored: {
				shortcuts: {
					'copy-link': { keys: ['Meta', 'KeyC'], enabled: true },
				},
				templateFormat: 2,
			},
			expected: DEFAULTS,
		},
		{
			title: 'should put stored shortcut keys in canonical order',
			stored: {
				shortcuts: {
					'copy-link': { keys: ['KeyL', 'Alt'], enabled: true },
				},
				templateFormat: 2,
			},
			expected: {
				...DEFAULTS,
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Alt', 'KeyL'],
						enabled: true,
					},
				},
			},
		},
		{
			title: 'should keep the default display for a non-boolean authorAvatars',
			stored: { display: { authorAvatars: 'false' }, templateFormat: 2 },
			expected: DEFAULTS,
		},
		{
			title: 'should ignore unknown keys, shortcuts and display settings',
			stored: {
				theme: 'dark',
				shortcuts: { paste: { keys: ['Alt', 'KeyP'], enabled: true } },
				display: { compact: true },
				templateFormat: 2,
			},
			expected: DEFAULTS,
		},
	];

	for (const c of CASES) {
		test(c.title, async () => {
			storage.seed(KEY, c.stored);

			expect(await configService.get()).toEqual(c.expected);
		});
	}

	test('should return the defaults when reading storage fails', async () => {
		storage.seed(KEY, CUSTOM_STORED);
		storage.failNextGet(new Error('quota'));
		const originalWarn = console.warn;
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]): void => {
			warnings.push(args);
		};

		try {
			expect(await configService.get()).toEqual(DEFAULTS);
			expect(warnings).toEqual([
				['[Hyperfriend] Failed to read config.', new Error('quota')],
			]);
		} finally {
			console.warn = originalWarn;
		}
	});

	test('should return a copy that callers can change without touching storage or later reads', async () => {
		const config = await configService.get();
		config.templates[LinkType.PullRequest] = 'changed';
		config.shortcuts[ShortcutType.CopyLink].keys.push('KeyX');

		expect(await configService.get()).toEqual(DEFAULTS);
	});
});

test.describe('template format marker', () => {
	const LEGACY_STORED = {
		templates: {
			'pull-request': 'PR {{pr_number}}: {{pr_name}}',
			issue: '[{{issue_number}}] {{issue_name}}',
		},
	};

	test('should not write when reading data without the marker', async () => {
		storage.seed(KEY, LEGACY_STORED);

		await configService.get();

		expect(storage.writes).toBe(0);
		expect(storage.dump()).toEqual({ [KEY]: LEGACY_STORED });
	});

	test('should store the converted templates with the marker on the next write', async () => {
		storage.seed(KEY, LEGACY_STORED);

		await configService.setDisplay({ authorAvatars: false });

		expect(storage.dump()).toEqual({
			[KEY]: {
				templates: {
					'pull-request': '[PR {{pr_number}}]: {{pr_name}}',
					issue: '\\[{{issue_number}}\\] {{issue_name}}',
				},
				shortcuts: {
					'copy-link': { keys: ['Shift', 'KeyC'], enabled: true },
				},
				display: { authorAvatars: false },
				format: 'rich',
				templateFormat: 2,
			},
		});
	});

	test('should not convert stored templates again once the marker is written', async () => {
		storage.seed(KEY, LEGACY_STORED);
		await configService.setDisplay({ authorAvatars: false });

		expect((await configService.get()).templates).toEqual({
			[LinkType.PullRequest]: '[PR {{pr_number}}]: {{pr_name}}',
			[LinkType.Issue]: '\\[{{issue_number}}\\] {{issue_name}}',
		});
	});
});

test.describe('writers', () => {
	test('should store one template as given, with the rest of the config and the marker', async () => {
		await configService.setTemplate(
			LinkType.Issue,
			'#{{issue_number}} [{{issue_name}}]'
		);

		expect(storage.dump()).toEqual({
			[KEY]: {
				templates: {
					'pull-request': '[PR {{pr_number}}]: {{pr_name}}',
					issue: '#{{issue_number}} [{{issue_name}}]',
				},
				shortcuts: {
					'copy-link': { keys: ['Shift', 'KeyC'], enabled: true },
				},
				display: { authorAvatars: true },
				format: 'rich',
				templateFormat: 2,
			},
		});
	});

	test('should keep the other stored settings when one template changes', async () => {
		storage.seed(KEY, CUSTOM_STORED);

		await configService.setTemplate(LinkType.PullRequest, '[{{title}}]');

		expect(storage.dump()).toEqual({
			[KEY]: {
				...CUSTOM_STORED,
				templates: {
					...CUSTOM_STORED.templates,
					'pull-request': '[{{title}}]',
				},
			},
		});
	});

	test('should store the copy format and keep the rest of the config', async () => {
		storage.seed(KEY, CUSTOM_STORED);

		await configService.setFormat(LinkFormat.Rich);

		expect(storage.dump()).toEqual({
			[KEY]: { ...CUSTOM_STORED, format: 'rich' },
		});
	});

	test('should ignore an unknown copy format', async () => {
		storage.seed(KEY, CUSTOM_STORED);

		await configService.setFormat('html' as LinkFormat);

		expect(storage.dump()).toEqual({ [KEY]: CUSTOM_STORED });
	});

	test('should store several templates with a single write', async () => {
		await configService.setTemplates({
			[LinkType.PullRequest]: '[#{{pr_number}}]',
			[LinkType.Issue]: '[#{{issue_number}}]',
		});

		expect(storage.writes).toBe(1);
		expect(storage.dump()).toEqual({
			[KEY]: {
				templates: {
					'pull-request': '[#{{pr_number}}]',
					issue: '[#{{issue_number}}]',
				},
				shortcuts: {
					'copy-link': { keys: ['Shift', 'KeyC'], enabled: true },
				},
				display: { authorAvatars: true },
				format: 'rich',
				templateFormat: 2,
			},
		});
	});

	test('should store new shortcut keys in canonical order', async () => {
		await configService.setShortcut(ShortcutType.CopyLink, {
			keys: ['KeyL', 'Shift', 'Alt'],
		});

		expect(storage.dump()).toEqual({
			[KEY]: {
				templates: {
					'pull-request': '[PR {{pr_number}}]: {{pr_name}}',
					issue: '[Issue {{issue_number}}]: {{issue_name}}',
				},
				shortcuts: {
					'copy-link': {
						keys: ['Alt', 'Shift', 'KeyL'],
						enabled: true,
					},
				},
				display: { authorAvatars: true },
				format: 'rich',
				templateFormat: 2,
			},
		});
	});

	test('should keep the shortcut keys when only "enabled" changes', async () => {
		storage.seed(KEY, {
			...CUSTOM_STORED,
			shortcuts: {
				'copy-link': { keys: ['Alt', 'KeyL'], enabled: true },
			},
		});

		await configService.setShortcut(ShortcutType.CopyLink, {
			enabled: false,
		});

		expect(storage.dump()).toEqual({
			[KEY]: {
				...CUSTOM_STORED,
				shortcuts: {
					'copy-link': { keys: ['Alt', 'KeyL'], enabled: false },
				},
			},
		});
	});

	test('should ignore browser-reserved shortcut keys and still apply "enabled"', async () => {
		storage.seed(KEY, CUSTOM_STORED);

		await configService.setShortcut(ShortcutType.CopyLink, {
			keys: ['Control', 'KeyC'],
			enabled: true,
		});

		expect(storage.dump()).toEqual({
			[KEY]: {
				...CUSTOM_STORED,
				shortcuts: {
					'copy-link': {
						keys: ['Alt', 'Shift', 'KeyL'],
						enabled: true,
					},
				},
			},
		});
	});

	test('should store the display preference', async () => {
		storage.seed(KEY, CUSTOM_STORED);

		await configService.setDisplay({ authorAvatars: true });

		expect(storage.dump()).toEqual({
			[KEY]: { ...CUSTOM_STORED, display: { authorAvatars: true } },
		});
	});

	test('should import every section with a single write and store templates as given', async () => {
		await configService.importSettings({
			templates: { [LinkType.PullRequest]: '[{{repo}}#{{pr_number}}]' },
			shortcuts: {
				[ShortcutType.CopyLink]: {
					keys: ['Alt', 'KeyL'],
					enabled: false,
				},
			},
			format: LinkFormat.Markdown,
			display: { authorAvatars: false },
		});

		expect(storage.writes).toBe(1);
		expect(storage.dump()).toEqual({
			[KEY]: {
				templates: {
					'pull-request': '[{{repo}}#{{pr_number}}]',
					issue: '[Issue {{issue_number}}]: {{issue_name}}',
				},
				shortcuts: {
					'copy-link': { keys: ['Alt', 'KeyL'], enabled: false },
				},
				display: { authorAvatars: false },
				format: 'markdown',
				templateFormat: 2,
			},
		});
	});

	test('should keep the stored settings that an import does not contain', async () => {
		storage.seed(KEY, CUSTOM_STORED);

		await configService.importSettings({
			display: { authorAvatars: true },
		});

		expect(storage.dump()).toEqual({
			[KEY]: { ...CUSTOM_STORED, display: { authorAvatars: true } },
		});
	});

	test('should remove the whole stored config on reset', async () => {
		storage.seed(KEY, CUSTOM_STORED);
		storage.seed('other-extension-key', 'kept');

		await configService.reset();

		expect(storage.dump()).toEqual({ 'other-extension-key': 'kept' });
		expect(await configService.get()).toEqual(DEFAULTS);
	});

	test('should reject a write that storage refuses', async () => {
		storage.failNextSet(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

		await expect(
			configService.setDisplay({ authorAvatars: false })
		).rejects.toThrow('QUOTA_BYTES_PER_ITEM quota exceeded');
		expect(storage.dump()).toEqual({});
	});
});

test.describe('write queue', () => {
	test('should keep every update of overlapping writes', async () => {
		await Promise.all([
			configService.setTemplate(LinkType.PullRequest, '[#{{pr_number}}]'),
			configService.setShortcut(ShortcutType.CopyLink, {
				keys: ['Alt', 'KeyL'],
			}),
			configService.setDisplay({ authorAvatars: false }),
		]);

		expect(storage.dump()).toEqual({
			[KEY]: {
				templates: {
					'pull-request': '[#{{pr_number}}]',
					issue: '[Issue {{issue_number}}]: {{issue_name}}',
				},
				shortcuts: {
					'copy-link': { keys: ['Alt', 'KeyL'], enabled: true },
				},
				display: { authorAvatars: false },
				format: 'rich',
				templateFormat: 2,
			},
		});
	});

	test('should not let a write queued before reset bring the config back', async () => {
		storage.seed(KEY, CUSTOM_STORED);

		await Promise.all([
			configService.setDisplay({ authorAvatars: true }),
			configService.reset(),
		]);

		expect(storage.dump()).toEqual({});
	});

	test('should store a write queued after reset over the defaults', async () => {
		storage.seed(KEY, CUSTOM_STORED);

		await Promise.all([
			configService.reset(),
			configService.setDisplay({ authorAvatars: false }),
		]);

		expect(storage.dump()).toEqual({
			[KEY]: {
				templates: {
					'pull-request': '[PR {{pr_number}}]: {{pr_name}}',
					issue: '[Issue {{issue_number}}]: {{issue_name}}',
				},
				shortcuts: {
					'copy-link': { keys: ['Shift', 'KeyC'], enabled: true },
				},
				display: { authorAvatars: false },
				format: 'rich',
				templateFormat: 2,
			},
		});
	});

	test('should run the next write after a failed one', async () => {
		storage.failNextSet(new Error('quota'));

		const results = await Promise.allSettled([
			configService.setTemplate(LinkType.Issue, '[#{{issue_number}}]'),
			configService.setDisplay({ authorAvatars: false }),
		]);

		expect(results.map((result) => result.status)).toEqual([
			'rejected',
			'fulfilled',
		]);
		expect(storage.dump()).toEqual({
			[KEY]: {
				templates: {
					'pull-request': '[PR {{pr_number}}]: {{pr_name}}',
					issue: '[Issue {{issue_number}}]: {{issue_name}}',
				},
				shortcuts: {
					'copy-link': { keys: ['Shift', 'KeyC'], enabled: true },
				},
				display: { authorAvatars: false },
				format: 'rich',
				templateFormat: 2,
			},
		});
	});
});

test.describe('subscribe', () => {
	test('should pass the merged config of a stored change to the listener', async () => {
		const received: ConfigModel[] = [];
		const unsubscribe = configService.subscribe((config) => {
			received.push(config);
		});

		await configService.setDisplay({ authorAvatars: false });
		unsubscribe();

		expect(received).toEqual([
			{ ...DEFAULTS, display: { authorAvatars: false } },
		]);
	});

	test('should pass the defaults to the listener after reset', async () => {
		storage.seed(KEY, CUSTOM_STORED);
		const received: ConfigModel[] = [];
		const unsubscribe = configService.subscribe((config) => {
			received.push(config);
		});

		await configService.reset();
		unsubscribe();

		expect(received).toEqual([DEFAULTS]);
	});

	test('should convert the templates of a changed value without the marker', () => {
		const received: ConfigModel[] = [];
		const unsubscribe = configService.subscribe((config) => {
			received.push(config);
		});

		storage.emit(
			{
				[KEY]: {
					newValue: { templates: { issue: '[{{issue_number}}]' } },
				},
			},
			'sync'
		);
		unsubscribe();

		expect(received).toEqual([
			{
				...DEFAULTS,
				templates: {
					...DEFAULTS.templates,
					[LinkType.Issue]: '\\[{{issue_number}}\\]',
				},
			},
		]);
	});

	test('should ignore changes of another storage area and of other keys', () => {
		const received: ConfigModel[] = [];
		const unsubscribe = configService.subscribe((config) => {
			received.push(config);
		});

		storage.emit({ [KEY]: { newValue: CUSTOM_STORED } }, 'local');
		storage.emit({ 'other-key': { newValue: CUSTOM_STORED } }, 'sync');
		storage.emit({ [KEY]: { newValue: CUSTOM_STORED } }, 'sync');
		unsubscribe();

		expect(received).toEqual([
			{
				templates: {
					[LinkType.PullRequest]: '#{{pr_number}} [{{pr_name}}]',
					[LinkType.Issue]: '[#{{issue_number}}] {{issue_name}}',
				},
				format: LinkFormat.Markdown,
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Alt', 'Shift', 'KeyL'],
						enabled: false,
					},
				},
				display: { authorAvatars: false },
			},
		]);
	});

	test('should stop calling the listener after unsubscribe', async () => {
		const received: ConfigModel[] = [];
		const unsubscribe = configService.subscribe((config) => {
			received.push(config);
		});
		await configService.setDisplay({ authorAvatars: false });

		unsubscribe();
		await configService.setDisplay({ authorAvatars: true });

		expect(received).toEqual([
			{ ...DEFAULTS, display: { authorAvatars: false } },
		]);
	});
});

test('should build the stored value from the config plus the format marker', () => {
	expect(
		toStoredConfig({
			format: LinkFormat.Rich,
			templates: {
				[LinkType.PullRequest]: '[#{{pr_number}}]',
				[LinkType.Issue]: '[#{{issue_number}}]',
			},
			shortcuts: {
				[ShortcutType.CopyLink]: {
					keys: ['Alt', 'KeyL'],
					enabled: false,
				},
			},
			display: { authorAvatars: false },
		})
	).toEqual({
		templates: {
			'pull-request': '[#{{pr_number}}]',
			issue: '[#{{issue_number}}]',
		},
		shortcuts: { 'copy-link': { keys: ['Alt', 'KeyL'], enabled: false } },
		display: { authorAvatars: false },
		format: 'rich',
		templateFormat: 2,
	});
});

test('should return an independent copy of the defaults from cloneDefaultConfig', () => {
	const first = cloneDefaultConfig();
	first.templates[LinkType.Issue] = 'changed';
	first.shortcuts[ShortcutType.CopyLink].keys.push('KeyX');
	first.display.authorAvatars = false;

	expect(cloneDefaultConfig()).toEqual(DEFAULTS);
});

test.describe('without chrome.storage', () => {
	let originalWarn: typeof console.warn;

	// The "storage unavailable" warning is logged once per module instance; silenced, not asserted.
	test.beforeEach(() => {
		originalWarn = console.warn;
		console.warn = (): void => {};
	});

	test.afterEach(() => {
		console.warn = originalWarn;
	});

	test('should return the defaults when there is no chrome global', async () => {
		setChrome(undefined);

		expect(await configService.get()).toEqual(DEFAULTS);
	});

	test('should return the defaults when chrome has no storage', async () => {
		setChrome({} as typeof chrome);

		expect(await configService.get()).toEqual(DEFAULTS);
	});

	test('should resolve every writer without storing anything', async () => {
		setChrome(undefined);

		await expect(
			Promise.all([
				configService.setTemplate(
					LinkType.Issue,
					'[#{{issue_number}}]'
				),
				configService.setTemplates({ [LinkType.PullRequest]: '[#]' }),
				configService.setShortcut(ShortcutType.CopyLink, {
					enabled: false,
				}),
				configService.setDisplay({ authorAvatars: false }),
				configService.importSettings({
					display: { authorAvatars: false },
				}),
				configService.reset(),
			])
		).resolves.toEqual([
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
		]);
	});

	test('should return an unsubscribe function that does nothing', () => {
		setChrome(undefined);

		const unsubscribe = configService.subscribe(() => {});

		expect(unsubscribe()).toBeUndefined();
	});
});
