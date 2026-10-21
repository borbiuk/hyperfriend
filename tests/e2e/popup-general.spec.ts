import { readFile, writeFile } from 'node:fs/promises';

import { Locator, Page } from '@playwright/test';
import { ConfigModel, LinkType, ShortcutType } from '@shared/models';

import { DEFAULT_STORED_CONFIG } from './fixtures/defaults';
import { expect, test } from './fixtures/extension';
import { PAGES, snapshotItems, snapshotUrl } from './fixtures/github';

// General tab of the settings popup: the avatars switch, Export, Import and "Reset all settings".

/** Settings that differ from the defaults in every section */
const CUSTOM_SETTINGS: ConfigModel = {
	templates: {
		[LinkType.PullRequest]: '{{repo}}#[{{pr_number}}] {{pr_name}}',
		[LinkType.Issue]: '{{repo}}#[{{issue_number}}] {{issue_name}}',
	},
	shortcuts: {
		[ShortcutType.CopyLink]: { keys: ['Shift', 'KeyJ'], enabled: false },
	},
	display: { authorAvatars: false },
};

/**
 * The stored config for these settings (whole config plus the template format marker).
 *
 * @param config - Expected config.
 */
function stored(config: ConfigModel): unknown {
	return { ...config, templateFormat: 2 };
}

/**
 * The Settings section (Export, Import, Reset all settings and their messages).
 *
 * @param options - Settings page.
 */
function settingsSection(options: Page): Locator {
	return options.locator('section').filter({
		has: options.getByRole('heading', { name: 'Settings', exact: true }),
	});
}

/**
 * The "Show author avatars" switch.
 *
 * @param options - Settings page.
 */
function avatarsSwitch(options: Page): Locator {
	return options.getByRole('button', {
		name: 'Show author avatars',
		exact: true,
	});
}

/**
 * Opens the General tab and waits until the avatars switch shows the stored value.
 *
 * @param openOptions - The openOptions fixture.
 * @param authorAvatars - Stored value of the avatars setting.
 */
async function openGeneral(
	openOptions: (hash?: string) => Promise<Page>,
	authorAvatars: boolean
): Promise<Page> {
	const options = await openOptions('#general');
	await expect(avatarsSwitch(options)).toHaveAttribute(
		'aria-pressed',
		String(authorAvatars)
	);
	return options;
}

/**
 * Imports a file through the Import button and the file chooser.
 *
 * @param options - Settings page on the General tab.
 * @param file - Path of the file.
 */
async function importFile(options: Page, file: string): Promise<void> {
	const chooser = options.waitForEvent('filechooser');
	await settingsSection(options)
		.getByRole('button', { name: 'Import', exact: true })
		.click();
	await (await chooser).setFiles(file);
}

test.describe('Display', () => {
	test('should turn author avatars off and keep them off after a reload', async ({
		openOptions,
		storage,
	}) => {
		const options = await openGeneral(openOptions, true);

		await avatarsSwitch(options).click();

		await expect
			.poll(() => storage.getConfig())
			.toEqual({
				...DEFAULT_STORED_CONFIG,
				display: { authorAvatars: false },
			});

		await test.step('after a reload the switch is off', async () => {
			await options.reload();
			await expect(avatarsSwitch(options)).toHaveAttribute(
				'aria-pressed',
				'false'
			);
		});
	});

	test('should remove the avatars from an open pull request list when turned off', async ({
		page,
		openOptions,
	}) => {
		const rowCount = snapshotItems(PAGES.pullList).length;
		await page.goto(snapshotUrl(PAGES.pullList));
		// Positive control: the avatars are there before the switch changes
		await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(
			rowCount
		);
		const options = await openGeneral(openOptions, true);

		await avatarsSwitch(options).click();

		await expect(page.locator('[data-hyperfriend="avatar"]')).toHaveCount(
			0
		);
		await expect(
			page.locator('[data-hyperfriend="copy-button"]')
		).toHaveCount(rowCount);
	});
});

test.describe('Export', () => {
	test('should download the stored settings as hyperfriend-settings.json', async ({
		openOptions,
		storage,
	}, testInfo) => {
		await storage.seedConfig(CUSTOM_SETTINGS);
		const options = await openGeneral(openOptions, false);
		const download = options.waitForEvent('download');

		await settingsSection(options)
			.getByRole('button', { name: 'Export', exact: true })
			.click();

		const file = await download;
		expect(file.suggestedFilename()).toBe('hyperfriend-settings.json');
		const savedPath = testInfo.outputPath('hyperfriend-settings.json');
		await file.saveAs(savedPath);
		const content = JSON.parse(await readFile(savedPath, 'utf8'));
		expect(content).toEqual({
			app: 'hyperfriend',
			schemaVersion: 3,
			exportedAt: expect.any(String),
			...CUSTOM_SETTINGS,
		});
		expect(
			new Date(content.exportedAt).toISOString(),
			'exportedAt is an ISO timestamp'
		).toBe(content.exportedAt);
	});
});

test.describe('Import', () => {
	test('should import a version 3 file and show its settings on every tab', async ({
		openOptions,
		storage,
	}, testInfo) => {
		const file = testInfo.outputPath('settings-v3.json');
		await writeFile(
			file,
			JSON.stringify({
				app: 'hyperfriend',
				schemaVersion: 3,
				exportedAt: '2026-01-02T03:04:05.000Z',
				...CUSTOM_SETTINGS,
			})
		);
		const options = await openGeneral(openOptions, true);

		await importFile(options, file);

		await test.step('the import is confirmed and stored', async () => {
			await expect(
				settingsSection(options).getByRole('status')
			).toHaveText('Settings imported.');
			await expect
				.poll(() => storage.getConfig())
				.toEqual(stored(CUSTOM_SETTINGS));
		});

		await test.step('every tab shows the imported settings', async () => {
			await expect(avatarsSwitch(options)).toHaveAttribute(
				'aria-pressed',
				'false'
			);
			await options.getByRole('tab', { name: 'Shortcuts' }).click();
			await expect(
				options.getByRole('button', {
					name: 'Change Copy link shortcut, currently Shift J',
					exact: true,
				})
			).toBeVisible();
			await expect(
				options.getByRole('button', {
					name: 'Copy link shortcut',
					exact: true,
				})
			).toHaveAttribute('aria-pressed', 'false');
			await options.getByRole('tab', { name: 'Templates' }).click();
			await expect(
				options.getByRole('textbox', {
					name: 'Pull Request link template',
				})
			).toHaveValue(CUSTOM_SETTINGS.templates[LinkType.PullRequest]);
			await expect(
				options.getByRole('textbox', { name: 'Issue link template' })
			).toHaveValue(CUSTOM_SETTINGS.templates[LinkType.Issue]);
		});
	});

	test('should convert the templates of a version 1 file', async ({
		openOptions,
		storage,
	}, testInfo) => {
		const file = testInfo.outputPath('settings-v1.json');
		await writeFile(
			file,
			JSON.stringify({
				app: 'hyperfriend',
				schemaVersion: 1,
				templates: {
					// Before 2.1.0 brackets were plain text: they get escaped
					[LinkType.PullRequest]: '[WIP] PR {{pr_number}}',
					// The old default: it becomes the new default
					[LinkType.Issue]: 'Issue {{issue_number}}: {{issue_name}}',
				},
			})
		);
		const options = await openGeneral(openOptions, true);

		await importFile(options, file);

		await expect(settingsSection(options).getByRole('status')).toHaveText(
			'Settings imported.'
		);
		await expect
			.poll(() => storage.getConfig())
			.toEqual({
				...DEFAULT_STORED_CONFIG,
				templates: {
					[LinkType.PullRequest]: '\\[WIP\\] PR {{pr_number}}',
					[LinkType.Issue]:
						'[Issue {{issue_number}}]: {{issue_name}}',
				},
			});
	});

	for (const { title, content, error } of [
		{
			// Checked by the popup through file.size, before the file is read
			title: 'a file over 64 KB',
			content: JSON.stringify({
				app: 'hyperfriend',
				schemaVersion: 3,
				display: { authorAvatars: true },
				padding: 'x'.repeat(64 * 1024),
			}),
			error: 'The file is too large (max 64 KB).',
		},
		{
			// A parseSettings message reaching the popup; the other messages are unit-tested
			title: 'a file with a browser shortcut',
			content: JSON.stringify({
				app: 'hyperfriend',
				schemaVersion: 3,
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Control', 'KeyC'],
						enabled: true,
					},
				},
			}),
			error: `Shortcut "${ShortcutType.CopyLink}" is not valid.`,
		},
	]) {
		test(`should reject ${title} and keep the settings`, async ({
			openOptions,
			storage,
		}, testInfo) => {
			await storage.seedConfig(CUSTOM_SETTINGS);
			const file = testInfo.outputPath('settings.json');
			await writeFile(file, content);
			const options = await openGeneral(openOptions, false);

			await importFile(options, file);

			await expect(
				settingsSection(options).getByRole('alert')
			).toHaveText(error);
			await expect(
				settingsSection(options).getByRole('status')
			).toHaveText('');
			// The error path returns before any write: the message above shows the file was handled
			expect(await storage.getConfig()).toEqual(stored(CUSTOM_SETTINGS));
		});
	}
});

test.describe('Reset all settings', () => {
	test('should ask for confirmation with the focus on Cancel', async ({
		openOptions,
	}) => {
		const options = await openGeneral(openOptions, true);

		await settingsSection(options)
			.getByRole('button', { name: 'Reset all settings' })
			.click();

		const dialog = options.getByRole('alertdialog', {
			name: 'Reset all settings?',
		});
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByRole('button', { name: 'Cancel', exact: true })
		).toBeFocused();
		await expect(
			dialog.getByRole('button', { name: 'Reset', exact: true })
		).toBeVisible();
	});

	test('should keep the settings when the reset is cancelled', async ({
		openOptions,
		storage,
	}) => {
		await storage.seedConfig(CUSTOM_SETTINGS);
		const options = await openGeneral(openOptions, false);
		await settingsSection(options)
			.getByRole('button', { name: 'Reset all settings' })
			.click();
		const dialog = options.getByRole('alertdialog', {
			name: 'Reset all settings?',
		});

		await dialog
			.getByRole('button', { name: 'Cancel', exact: true })
			.click();

		await expect(dialog).toBeHidden();
		// Storage writes run in order through one queue: had Cancel started a reset, this later
		// switch write would merge into the defaults and lose the custom templates and shortcut
		await avatarsSwitch(options).click();
		await expect
			.poll(() => storage.getConfig())
			.toEqual(
				stored({ ...CUSTOM_SETTINGS, display: { authorAvatars: true } })
			);
	});

	test('should clear the stored settings when the reset is confirmed', async ({
		openOptions,
		storage,
	}) => {
		await storage.seedConfig(CUSTOM_SETTINGS);
		const options = await openGeneral(openOptions, false);
		await settingsSection(options)
			.getByRole('button', { name: 'Reset all settings' })
			.click();
		const dialog = options.getByRole('alertdialog', {
			name: 'Reset all settings?',
		});

		await dialog
			.getByRole('button', { name: 'Reset', exact: true })
			.click();

		await expect(dialog).toBeHidden();
		await expect(settingsSection(options).getByRole('status')).toHaveText(
			'All settings were reset.'
		);
		await expect.poll(() => storage.getConfig()).toBeUndefined();
		await expect(avatarsSwitch(options)).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});
});
