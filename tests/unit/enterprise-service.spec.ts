import { expect, test } from '@playwright/test';
import {
	listEnterpriseHosts,
	parseEnterpriseHost,
	ParseHostResult,
	removeEnterpriseHost,
	requestEnterpriseHost,
	syncEnterpriseScripts,
	toOriginPattern,
} from '@shared/services';

// The domain a user types, the permission calls and the reconciliation of the registered content
// scripts with the granted origins, against a fake of the chrome.* APIs it uses.

interface ScriptRecord {
	id: string;
	matches: string[];
	js: string[];
	runAt: string;
	persistAcrossSessions: boolean;
}

interface Fake {
	/** Origins the browser reports as granted */
	origins: string[];
	/** Scripts that are registered */
	scripts: ScriptRecord[];
	/** Open tabs per URL pattern */
	tabs: Record<string, number[]>;
	/** Tab ids whose injection fails */
	failing: number[];
	/** Script ids whose registration is rejected */
	rejecting: string[];
	/** Everything that was called, in order */
	calls: string[];
	/** First arguments of the console warnings the code logged */
	warnings: string[];
	/** Result of permissions.request / remove */
	granted: boolean;
}

const originalChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
const originalWarn = console.warn;
let fake: Fake;

test.beforeEach(() => {
	console.warn = (message: unknown) => {
		fake.warnings.push(String(message));
	};
	fake = {
		origins: [],
		scripts: [],
		tabs: {},
		failing: [],
		rejecting: [],
		calls: [],
		warnings: [],
		granted: true,
	};
	const chromeFake = {
		permissions: {
			getAll: async () => ({ origins: fake.origins, permissions: [] }),
			request: async (request: { origins: string[] }) => {
				fake.calls.push(`request ${request.origins.join(',')}`);
				return fake.granted;
			},
			remove: async (request: { origins: string[] }) => {
				fake.calls.push(`remove ${request.origins.join(',')}`);
				return fake.granted;
			},
		},
		scripting: {
			getRegisteredContentScripts: async () => fake.scripts,
			registerContentScripts: async (scripts: ScriptRecord[]) => {
				fake.calls.push(
					`register ${scripts.map((script) => script.id).join(',')}`
				);
				if (
					scripts.some((script) => fake.rejecting.includes(script.id))
				) {
					throw new Error('Duplicate script ID');
				}

				fake.scripts.push(...scripts);
			},
			unregisterContentScripts: async (filter: { ids: string[] }) => {
				fake.calls.push(`unregister ${filter.ids.join(',')}`);
				fake.scripts = fake.scripts.filter(
					(script) => !filter.ids.includes(script.id)
				);
			},
			executeScript: async (injection: {
				target: { tabId: number };
				files: string[];
			}) => {
				if (fake.failing.includes(injection.target.tabId)) {
					throw new Error('No tab with id');
				}

				fake.calls.push(
					`inject ${injection.target.tabId} ${injection.files.join(',')}`
				);
			},
		},
		tabs: {
			query: async (query: { url: string }) =>
				(fake.tabs[query.url] ?? []).map((id) => ({ id })),
		},
	};
	Object.defineProperty(globalThis, 'chrome', {
		configurable: true,
		writable: true,
		value: chromeFake,
	});
});

test.afterEach(() => {
	console.warn = originalWarn;
	if (originalChrome) {
		Object.defineProperty(globalThis, 'chrome', originalChrome);
	} else {
		Reflect.deleteProperty(globalThis, 'chrome');
	}
});

interface HostCase {
	input: string;
	expected: ParseHostResult;
}

const HOST_CASES: HostCase[] = [
	{
		input: 'github.example.com',
		expected: { ok: true, host: 'github.example.com' },
	},
	{
		input: '  GitHub.Example.COM  ',
		expected: { ok: true, host: 'github.example.com' },
	},
	{
		input: 'https://github.example.com',
		expected: { ok: true, host: 'github.example.com' },
	},
	{
		input: 'https://github.example.com/org/repo/pull/1?x=1#top',
		expected: { ok: true, host: 'github.example.com' },
	},
	{
		input: 'legendari.ghe.com',
		expected: { ok: true, host: 'legendari.ghe.com' },
	},
	{ input: 'ghe', expected: { ok: true, host: 'ghe' } },
	{
		input: 'münchen.example.com',
		expected: { ok: true, host: 'xn--mnchen-3ya.example.com' },
	},
	{ input: '10.0.0.5', expected: { ok: true, host: '10.0.0.5' } },
	{
		input: `${'a'.repeat(63)}.example.com`,
		expected: { ok: true, host: `${'a'.repeat(63)}.example.com` },
	},
	{
		input: `${'a'.repeat(64)}.example.com`,
		expected: { ok: false, error: 'This is not a valid domain.' },
	},
	{
		input: `${'a'.repeat(61)}.${'b'.repeat(61)}.${'c'.repeat(61)}.${'d'.repeat(61)}.eeeee`,
		expected: {
			ok: true,
			host: `${'a'.repeat(61)}.${'b'.repeat(61)}.${'c'.repeat(61)}.${'d'.repeat(61)}.eeeee`,
		},
	},
	{
		input: `${'a'.repeat(61)}.${'b'.repeat(61)}.${'c'.repeat(61)}.${'d'.repeat(61)}.eeeeee`,
		expected: { ok: false, error: 'This is not a valid domain.' },
	},
	{
		input: '',
		expected: {
			ok: false,
			error: 'Enter the domain of your GitHub Enterprise site.',
		},
	},
	{
		input: '   ',
		expected: {
			ok: false,
			error: 'Enter the domain of your GitHub Enterprise site.',
		},
	},
	{
		input: 'http://github.example.com',
		expected: { ok: false, error: 'Only https sites are supported.' },
	},
	{
		input: 'github.example.com:8443',
		expected: {
			ok: false,
			error: 'Enter the domain only, without a user name or a port.',
		},
	},
	{
		input: 'user@github.example.com',
		expected: {
			ok: false,
			error: 'Enter the domain only, without a user name or a port.',
		},
	},
	{
		input: '*.example.com',
		expected: {
			ok: false,
			error: 'Wildcards are not supported: enter the exact domain.',
		},
	},
	{
		input: 'not a domain',
		expected: { ok: false, error: 'This is not a valid domain.' },
	},
	{
		input: '-bad.example.com',
		expected: { ok: false, error: 'This is not a valid domain.' },
	},
	{
		input: 'bad..example.com',
		expected: { ok: false, error: 'This is not a valid domain.' },
	},
	{
		input: 'ftp://github.example.com',
		expected: { ok: false, error: 'Only https sites are supported.' },
	},
	{
		input: 'gist.github.com',
		expected: {
			ok: false,
			error: 'github.com is supported without any setup.',
		},
	},
	{
		input: 'www.GitHub.com',
		expected: {
			ok: false,
			error: 'github.com is supported without any setup.',
		},
	},
	{
		input: 'github.com',
		expected: {
			ok: false,
			error: 'github.com is supported without any setup.',
		},
	},
	{
		input: 'https://GitHub.com/react/react',
		expected: {
			ok: false,
			error: 'github.com is supported without any setup.',
		},
	},
];

for (const { input, expected } of HOST_CASES) {
	test(`should read the domain "${input}"`, () => {
		expect(parseEnterpriseHost(input)).toEqual(expected);
	});
}

test('should build the origin pattern of a domain', () => {
	expect(toOriginPattern('github.example.com')).toBe(
		'https://github.example.com/*'
	);
});

test('should list the granted Enterprise domains, sorted, without github.com and other patterns', async () => {
	fake.origins = [
		'https://github.com/*',
		'https://z.example.com/*',
		'https://a.example.com/*',
		'https://*.example.org/*',
		'http://insecure.example.com/*',
		'https://example.net:8443/*',
		'https://a.example.com/*',
		'<all_urls>',
	];

	expect(await listEnterpriseHosts()).toEqual([
		'a.example.com',
		'z.example.com',
	]);
});

test('should ask the browser for the origin of the domain and report that it was granted', async () => {
	expect(await requestEnterpriseHost('github.example.com')).toBe(true);

	expect(fake.calls).toEqual(['request https://github.example.com/*']);
});

test('should report that the browser did not grant the origin of the domain', async () => {
	fake.granted = false;

	expect(await requestEnterpriseHost('other.example.com')).toBe(false);
	expect(fake.calls).toEqual(['request https://other.example.com/*']);
});

test('should take the access to the origin of the domain back', async () => {
	expect(await removeEnterpriseHost('github.example.com')).toBe(true);

	expect(fake.calls).toEqual(['remove https://github.example.com/*']);
});

test('should register the content script of every granted domain and start it in the open tabs', async () => {
	fake.origins = [
		'https://github.com/*',
		'https://github.example.com/*',
		'https://legendari.ghe.com/*',
	];
	fake.tabs = {
		'https://github.example.com/*': [7, 8],
		'https://legendari.ghe.com/*': [],
	};

	await syncEnterpriseScripts({ injectIntoTabs: true });

	expect(fake.scripts).toEqual([
		{
			id: 'hyperfriend-enterprise:github.example.com',
			matches: ['https://github.example.com/*'],
			js: ['content.js'],
			runAt: 'document_idle',
			persistAcrossSessions: true,
		},
		{
			id: 'hyperfriend-enterprise:legendari.ghe.com',
			matches: ['https://legendari.ghe.com/*'],
			js: ['content.js'],
			runAt: 'document_idle',
			persistAcrossSessions: true,
		},
	]);
	expect(fake.calls).toEqual([
		'register hyperfriend-enterprise:github.example.com',
		'inject 7 content.js',
		'inject 8 content.js',
		'register hyperfriend-enterprise:legendari.ghe.com',
	]);
});

test('should do nothing when the registered scripts already match the granted domains', async () => {
	fake.origins = ['https://github.example.com/*'];
	await syncEnterpriseScripts();
	fake.calls = [];

	await syncEnterpriseScripts();

	expect(fake.calls).toEqual([]);
});

test('should unregister the script of a domain whose access was taken back and keep the others', async () => {
	fake.origins = [
		'https://github.example.com/*',
		'https://legendari.ghe.com/*',
	];
	await syncEnterpriseScripts();
	fake.calls = [];
	fake.origins = ['https://legendari.ghe.com/*'];

	await syncEnterpriseScripts();

	expect(fake.calls).toEqual([
		'unregister hyperfriend-enterprise:github.example.com',
	]);
	expect(fake.scripts.map((script) => script.id)).toEqual([
		'hyperfriend-enterprise:legendari.ghe.com',
	]);
});

test('should register only the missing script and start only that one in its tabs', async () => {
	fake.origins = ['https://github.example.com/*'];
	await syncEnterpriseScripts();
	fake.calls = [];
	fake.origins = [
		'https://github.example.com/*',
		'https://legendari.ghe.com/*',
	];
	fake.tabs = {
		'https://github.example.com/*': [1],
		'https://legendari.ghe.com/*': [2],
	};

	await syncEnterpriseScripts({ injectIntoTabs: true });

	expect(fake.calls).toEqual([
		'register hyperfriend-enterprise:legendari.ghe.com',
		'inject 2 content.js',
	]);
});

test('should leave scripts that are not its own alone', async () => {
	fake.origins = [];
	fake.scripts = [
		{
			id: 'other-script',
			matches: ['https://other.example.com/*'],
			js: ['other.js'],
			runAt: 'document_idle',
			persistAcrossSessions: true,
		},
	];

	await syncEnterpriseScripts();

	expect(fake.calls).toEqual([]);
	expect(fake.scripts).toHaveLength(1);
});

test('should keep registering when a tab can not be scripted', async () => {
	fake.origins = ['https://github.example.com/*'];
	fake.tabs = { 'https://github.example.com/*': [1, 2] };
	fake.failing = [1];

	await syncEnterpriseScripts({ injectIntoTabs: true });

	expect(fake.scripts).toHaveLength(1);
	expect(fake.calls).toEqual([
		'register hyperfriend-enterprise:github.example.com',
		'inject 2 content.js',
	]);
	expect(fake.warnings).toEqual([
		'[Hyperfriend] Could not start on a tab of github.example.com.',
	]);
});

test('should not start the content script in the open tabs unless asked to', async () => {
	fake.origins = ['https://github.example.com/*'];
	fake.tabs = { 'https://github.example.com/*': [1, 2] };

	await syncEnterpriseScripts();

	expect(fake.calls).toEqual([
		'register hyperfriend-enterprise:github.example.com',
	]);
});

test('should register every script anew when asked to refresh, also the ones that exist', async () => {
	fake.origins = [
		'https://github.example.com/*',
		'https://legendari.ghe.com/*',
	];
	await syncEnterpriseScripts();
	fake.calls = [];

	await syncEnterpriseScripts({ refresh: true });

	expect(fake.calls).toEqual([
		'unregister hyperfriend-enterprise:github.example.com,hyperfriend-enterprise:legendari.ghe.com',
		'register hyperfriend-enterprise:github.example.com',
		'register hyperfriend-enterprise:legendari.ghe.com',
	]);
	expect(fake.scripts).toHaveLength(2);
});

test('should keep registering the other domains when one registration fails', async () => {
	fake.origins = [
		'https://github.example.com/*',
		'https://legendari.ghe.com/*',
	];
	fake.rejecting = ['hyperfriend-enterprise:github.example.com'];
	fake.tabs = {
		'https://github.example.com/*': [1],
		'https://legendari.ghe.com/*': [2],
	};

	await syncEnterpriseScripts({ injectIntoTabs: true });

	expect(fake.scripts.map((script) => script.id)).toEqual([
		'hyperfriend-enterprise:legendari.ghe.com',
	]);
	expect(fake.warnings).toEqual([
		'[Hyperfriend] Could not register github.example.com.',
	]);
	// No tab of the domain that failed was started
	expect(fake.calls).toEqual([
		'register hyperfriend-enterprise:github.example.com',
		'register hyperfriend-enterprise:legendari.ghe.com',
		'inject 2 content.js',
	]);
});
