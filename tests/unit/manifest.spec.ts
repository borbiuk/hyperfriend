import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const ROOT = path.join(__dirname, '..', '..');

/** The parts of a manifest this suite reads; everything else is compared as a whole */
type Manifest = Record<string, unknown> & {
	version: string;
	permissions: string[];
	background: Record<string, unknown>;
	icons: Record<string, string>;
	action: { default_icon: Record<string, string> };
	content_scripts: { matches: string[] }[];
	browser_specific_settings?: unknown;
};

function readJson<T>(relativePath: string): T {
	return JSON.parse(readFileSync(path.join(ROOT, relativePath), 'utf8')) as T;
}

function withoutKeys(
	manifest: Manifest,
	keys: string[]
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(manifest).filter(([key]) => !keys.includes(key))
	);
}

const chrome = readJson<Manifest>('public/manifest.json');
const firefox = readJson<Manifest>('public/manifest.firefox.json');
const packageJson = readJson<{ version: string }>('package.json');

// The pre-commit hook copies the version, so these checks only catch commits made without it
// (`--no-verify`, `HUSKY=0`, a bot commit)
test('should keep the same version in both manifests and package.json', () => {
	expect(firefox.version).toBe(chrome.version);
	expect(packageJson.version).toBe(chrome.version);
});

test('should differ between Chrome and Firefox only by background and browser_specific_settings', () => {
	const chromeRest = withoutKeys(chrome, ['background']);
	const firefoxRest = withoutKeys(firefox, [
		'background',
		'browser_specific_settings',
	]);

	expect(firefoxRest).toEqual(chromeRest);
	expect(chrome.browser_specific_settings).toBeUndefined();
});

test('should run the background as a service worker in Chrome and as a script in Firefox', () => {
	expect(chrome.background).toEqual({ service_worker: 'background.js' });
	expect(firefox.background).toEqual({ scripts: ['background.js'] });
});

test('should keep the Firefox add-on settings', () => {
	expect(firefox.browser_specific_settings).toEqual({
		gecko: {
			id: 'hyperfriend@borbiuk',
			strict_min_version: '140.0',
			data_collection_permissions: { required: ['none'] },
		},
		gecko_android: { strict_min_version: '142.0' },
	});
});

test('should request only the storage and scripting permissions', () => {
	expect(chrome.permissions).toEqual(['storage', 'scripting']);
});

test('should have no required host permissions and one optional wildcard', () => {
	expect(chrome.host_permissions).toBeUndefined();
	expect(chrome.optional_host_permissions).toEqual(['https://*/*']);
});

test('should inject the content script only on github.com and *.ghe.com', () => {
	expect(chrome.content_scripts.map((script) => script.matches)).toEqual([
		['https://github.com/*', 'https://*.ghe.com/*'],
	]);
});

test('should use the same existing logo files for every icon size', () => {
	const logos = {
		16: 'assets/logo-16.png',
		32: 'assets/logo-32.png',
		48: 'assets/logo-48.png',
		128: 'assets/logo-128.png',
	};

	expect(chrome.icons).toEqual(logos);
	expect(chrome.action.default_icon).toEqual(logos);
	expect(
		Object.values(logos).filter(
			(logo) => !existsSync(path.join(ROOT, 'public', logo))
		)
	).toEqual([]);
});
