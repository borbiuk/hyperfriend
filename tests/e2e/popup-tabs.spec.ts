import { Page } from '@playwright/test';

import { expect, test } from './fixtures/extension';

// Settings popup (options.html in a tab): the three tabs, the URL hash that picks the first one,
// keyboard navigation between them and a popup height that does not jump.

const TABS = ['Templates', 'Shortcuts', 'General'] as const;

/** URL hash token and a control only that tab shows, per tab */
const TAB_CASES = [
	{
		hash: '#templates',
		tab: 'Templates',
		control: 'Pull Request link template',
		role: 'textbox',
	},
	{
		hash: '#shortcuts',
		tab: 'Shortcuts',
		control: 'Copy link shortcut',
		role: 'button',
	},
	{
		hash: '#general',
		tab: 'General',
		control: 'Show author avatars',
		role: 'button',
	},
] as const;

/**
 * Height of the popup's main element.
 *
 * @param options - Settings page.
 */
async function mainHeight(options: Page): Promise<number | undefined> {
	return (await options.getByRole('main').boundingBox())?.height;
}

test('should show the Templates, Shortcuts and General tabs with Templates selected', async ({
	openOptions,
}) => {
	const options = await openOptions();

	const tablist = options.getByRole('tablist', { name: 'Settings' });
	await expect(tablist.getByRole('tab')).toHaveText([...TABS]);
	await expect(
		tablist.getByRole('tab', { name: 'Templates' })
	).toHaveAttribute('aria-selected', 'true');
	await expect(options.getByRole('tabpanel')).toHaveAccessibleName(
		'Templates'
	);
});

for (const { hash, tab, control, role } of TAB_CASES) {
	test(`should open the ${tab} tab for the ${hash} hash`, async ({
		openOptions,
	}) => {
		const options = await openOptions(hash);

		for (const name of TABS) {
			await expect(
				options.getByRole('tab', { name, exact: true })
			).toHaveAttribute('aria-selected', String(name === tab));
		}
		const panel = options.getByRole('tabpanel');
		await expect(panel).toHaveAccessibleName(tab);
		await expect(
			panel.getByRole(role, { name: control, exact: true })
		).toBeVisible();
	});
}

test('should move between tabs with the arrow keys', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const templates = options.getByRole('tab', { name: 'Templates' });
	const shortcuts = options.getByRole('tab', { name: 'Shortcuts' });
	await templates.focus();

	await options.keyboard.press('ArrowRight');

	await test.step('ArrowRight focuses and selects the next tab', async () => {
		await expect(shortcuts).toBeFocused();
		await expect(shortcuts).toHaveAttribute('aria-selected', 'true');
		await expect(options.getByRole('tabpanel')).toHaveAccessibleName(
			'Shortcuts'
		);
	});

	await options.keyboard.press('ArrowLeft');

	await test.step('ArrowLeft goes back to the previous tab', async () => {
		await expect(templates).toBeFocused();
		await expect(templates).toHaveAttribute('aria-selected', 'true');
		await expect(options.getByRole('tabpanel')).toHaveAccessibleName(
			'Templates'
		);
	});
});

test('should keep the popup height when switching tabs', async ({
	openOptions,
}) => {
	const options = await openOptions();
	await expect(options.getByRole('tabpanel')).toHaveAccessibleName(
		'Templates'
	);
	const height = await mainHeight(options);
	expect(height).toBeGreaterThan(0);

	for (const name of TABS) {
		await test.step(`the ${name} tab has the same height`, async () => {
			await options.getByRole('tab', { name, exact: true }).click();
			await expect(options.getByRole('tabpanel')).toHaveAccessibleName(
				name
			);
			await expect.poll(() => mainHeight(options)).toBe(height);
		});
	}
});

test('should log no warnings while loading and switching tabs', async ({
	context,
	extensionId,
	openOptions,
}) => {
	// Attached before the page opens, so warnings logged during load are caught too
	const warnings: string[] = [];
	context.on('console', (message) => {
		if (
			message.type() === 'warning' &&
			message
				.page()
				?.url()
				.startsWith(`chrome-extension://${extensionId}/`)
		) {
			warnings.push(message.text());
		}
	});
	const options = await openOptions();

	for (const name of TABS) {
		await options.getByRole('tab', { name, exact: true }).click();
		await expect(options.getByRole('tabpanel')).toHaveAccessibleName(name);
	}

	expect(warnings).toEqual([]);
});
