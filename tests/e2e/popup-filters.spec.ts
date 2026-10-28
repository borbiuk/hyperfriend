import { Locator, Page } from '@playwright/test';
import { FilterChipId } from '@shared/models';

import { expect, test } from './fixtures/extension';

// Filters tab of the settings popup: the chips of the bar (reorder by dragging or with the arrow
// buttons, hide, show), the editor of custom chips (name, icon, colour, filter) and the switch that
// makes the drafts chip remember its state. Every change is saved at once and stored in the
// `filters` part of the config.

/** The chips shown by default, in the order of the bar */
const DEFAULT_SHOWN = [
	'Needs your review',
	'Needs review from your GitHub team',
	'Created by you',
	'Ready to merge',
	'Drafts',
	'CI passing',
	'CI failing',
	'CI running',
	'Mine, waiting for review',
	'Mine, changes requested',
];

/** The chips that are off by default, in catalog order */
const DEFAULT_HIDDEN = [
	'Approved',
	'No reviewer',
	'Involves me',
	'Mentions me',
	'Reviewed by me',
	'Not reviewed by me',
];

/** The stored ids of DEFAULT_SHOWN */
const DEFAULT_IDS = [
	'needs-your-review',
	'needs-team-review',
	'created-by-you',
	'ready-to-merge',
	'drafts',
	'ci-passing',
	'ci-failing',
	'ci-running',
	'my-waiting',
	'my-changes',
];

/** A custom chip the tests start from */
const BUGS = {
	id: 'custom-abcd1234',
	label: 'Bugs',
	icon: 'bug',
	colour: 'red',
	query: 'label:bug -label:wip',
} as const;

/**
 * The list of the chips shown in the bar.
 *
 * @param options - Settings page.
 */
function shownList(options: Page): Locator {
	return options.getByRole('list', { name: 'Chips shown in the bar' });
}

/**
 * The names of the rows of a list, in order.
 *
 * @param list - A chip list.
 */
function names(list: Locator): Locator {
	return list.locator('.hyperfriend-chip-row__label');
}

/**
 * One row of the list of shown chips.
 *
 * @param options - Settings page.
 * @param label - Name of the chip.
 */
function shownRow(options: Page, label: string): Locator {
	return shownList(options)
		.getByRole('listitem')
		.filter({
			has: options.getByText(label, { exact: true }),
		});
}

/**
 * The "Remember the drafts filter" switch.
 *
 * @param options - Settings page.
 */
function stickySwitch(options: Page): Locator {
	return options.getByRole('button', {
		name: 'Remember the drafts filter',
		exact: true,
	});
}

/**
 * Opens the editor of a new chip.
 *
 * @param options - Settings page.
 */
async function openNewChip(options: Page): Promise<void> {
	await options.getByRole('button', { name: 'Add a custom chip' }).click();
	await expect(
		options.getByRole('heading', { name: 'New chip' })
	).toBeVisible();
}

test('should list the shown chips in order and the other chips apart', async ({
	openOptions,
}) => {
	const options = await openOptions('#filters');

	await expect(names(shownList(options))).toHaveText(DEFAULT_SHOWN);
	await expect(
		names(options.getByRole('list', { name: 'Chips not shown in the bar' }))
	).toHaveText(DEFAULT_HIDDEN);
	await expect(stickySwitch(options)).toHaveAttribute(
		'aria-pressed',
		'false'
	);
});

test('should show an icon before every chip', async ({ openOptions }) => {
	const options = await openOptions('#filters');

	await expect(
		options.locator('.hyperfriend-chip-row .hyperfriend-chip-icon svg')
	).toHaveCount(DEFAULT_SHOWN.length + DEFAULT_HIDDEN.length);
});

test('should disable Move up on the first row and Move down on the last', async ({
	openOptions,
}) => {
	const options = await openOptions('#filters');

	await expect(
		options.getByRole('button', {
			name: 'Move Needs your review up',
			exact: true,
		})
	).toBeDisabled();
	await expect(
		options.getByRole('button', {
			name: 'Move Mine, changes requested down',
			exact: true,
		})
	).toBeDisabled();
});

test('should move a chip with the arrow buttons, announce it and keep the order after a reload', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions('#filters');

	await options
		.getByRole('button', { name: 'Move Created by you up', exact: true })
		.click();

	await expect(names(shownList(options))).toHaveText([
		'Needs your review',
		'Created by you',
		'Needs review from your GitHub team',
		...DEFAULT_SHOWN.slice(3),
	]);
	await expect(
		options.getByRole('tabpanel', { name: 'Filters' }).getByRole('status')
	).toHaveText('Created by you moved to position 2 of 10');
	await expect
		.poll(async () => (await storage.getConfig()) as never)
		.toMatchObject({
			filters: {
				chips: [
					'needs-your-review',
					'created-by-you',
					'needs-team-review',
					...DEFAULT_IDS.slice(3),
				],
			},
		});

	await options.reload();
	await expect(names(shownList(options))).toHaveText([
		'Needs your review',
		'Created by you',
		'Needs review from your GitHub team',
		...DEFAULT_SHOWN.slice(3),
	]);
});

test('should move a chip with the keyboard and keep the focus on a button of the same row', async ({
	openOptions,
}) => {
	const options = await openOptions('#filters');
	const up = options.getByRole('button', {
		name: 'Move Needs review from your GitHub team up',
		exact: true,
	});

	await up.focus();
	await options.keyboard.press('Enter');

	await expect(names(shownList(options))).toHaveText([
		'Needs review from your GitHub team',
		'Needs your review',
		...DEFAULT_SHOWN.slice(2),
	]);
	// The button is disabled now that the chip is first: the focus goes to the next one of the row
	await expect(
		options.getByRole('button', {
			name: 'Move Needs review from your GitHub team down',
			exact: true,
		})
	).toBeFocused();
});

test('should move a chip by dragging its row onto another row', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions('#filters');

	await shownRow(options, 'Ready to merge').dragTo(
		shownRow(options, 'Needs your review')
	);

	await expect(names(shownList(options))).toHaveText([
		'Ready to merge',
		'Needs your review',
		'Needs review from your GitHub team',
		'Created by you',
		...DEFAULT_SHOWN.slice(4),
	]);
	await expect(
		options.getByRole('tabpanel', { name: 'Filters' }).getByRole('status')
	).toHaveText('Ready to merge moved to position 1 of 10');
	await expect
		.poll(async () => (await storage.getConfig()) as never)
		.toMatchObject({
			filters: {
				chips: [
					'ready-to-merge',
					'needs-your-review',
					'needs-team-review',
					'created-by-you',
					...DEFAULT_IDS.slice(4),
				],
			},
		});
});

test('should move a chip down by dragging it onto a row below, after that row', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions('#filters');

	await shownRow(options, 'Needs your review').dragTo(
		shownRow(options, 'Created by you')
	);

	await expect(names(shownList(options))).toHaveText([
		'Needs review from your GitHub team',
		'Created by you',
		'Needs your review',
		...DEFAULT_SHOWN.slice(3),
	]);
	await expect
		.poll(async () => (await storage.getConfig()) as never)
		.toMatchObject({
			filters: {
				chips: [
					'needs-team-review',
					'created-by-you',
					'needs-your-review',
					...DEFAULT_IDS.slice(3),
				],
			},
		});
});

test('should hide a chip from the bar and show it again at the end', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions('#filters');

	await options
		.getByRole('button', {
			name: 'Hide Created by you from the bar',
			exact: true,
		})
		.click();

	await expect(names(shownList(options))).toHaveText(
		DEFAULT_SHOWN.filter((name) => name !== 'Created by you')
	);
	await expect(
		names(options.getByRole('list', { name: 'Chips not shown in the bar' }))
	).toHaveText(['Created by you', ...DEFAULT_HIDDEN]);

	await options
		.getByRole('button', { name: 'Show Approved in the bar', exact: true })
		.click();

	await expect
		.poll(async () => (await storage.getConfig()) as never)
		.toMatchObject({
			filters: {
				chips: [
					...DEFAULT_IDS.filter((id) => id !== 'created-by-you'),
					'approved',
				],
			},
		});
});

test('should store the sticky drafts setting and disable the switch while Drafts is hidden', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions('#filters');

	await stickySwitch(options).click();

	await expect(stickySwitch(options)).toHaveAttribute('aria-pressed', 'true');
	await expect
		.poll(async () => (await storage.getConfig()) as never)
		.toMatchObject({ filters: { sticky: { drafts: true } } });

	await options
		.getByRole('button', { name: 'Hide Drafts from the bar', exact: true })
		.click();

	await expect(stickySwitch(options)).toBeDisabled();
});

test('should show a change of the settings made elsewhere', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions('#filters');
	await expect(names(shownList(options))).toHaveCount(DEFAULT_SHOWN.length);

	await storage.seedConfig({
		filters: {
			chips: [FilterChipId.Drafts, FilterChipId.CiPassing],
			sticky: { drafts: true },
		},
	});

	await expect(names(shownList(options))).toHaveText([
		'Drafts',
		'CI passing',
	]);
	await expect(stickySwitch(options)).toHaveAttribute('aria-pressed', 'true');
});

test.describe('custom chips', () => {
	test('should make a chip with a name, icon, colour and filter, and show it at the end of the bar', async ({
		openOptions,
		storage,
	}) => {
		const options = await openOptions('#filters');
		await openNewChip(options);

		await options.getByRole('textbox', { name: 'Name' }).fill('Bugs');
		await options.getByRole('radio', { name: 'bug', exact: true }).check();
		await options.getByRole('radio', { name: 'red', exact: true }).check();
		await options
			.getByRole('textbox', { name: 'Filter' })
			.fill('  label:bug   -label:wip ');
		await options
			.getByRole('button', { name: 'Save', exact: true })
			.click();

		await expect(names(shownList(options))).toHaveText([
			...DEFAULT_SHOWN,
			'Bugs',
		]);
		await expect
			.poll(async () => (await storage.getConfig()) as never)
			.toMatchObject({
				filters: {
					custom: [
						{
							id: expect.stringMatching(/^custom-[a-z0-9]{8}$/),
							label: 'Bugs',
							icon: 'bug',
							colour: 'red',
							query: 'label:bug -label:wip',
						},
					],
				},
			});
		// The id that joined the bar is the one of the new chip
		const stored = (await storage.getConfig()) as {
			filters: { chips: string[]; custom: { id: string }[] };
		};
		expect(stored.filters.chips).toEqual([
			...DEFAULT_IDS,
			stored.filters.custom[0].id,
		]);
	});

	test('should show the chip as it will look while the fields change', async ({
		openOptions,
	}) => {
		const options = await openOptions('#filters');
		await openNewChip(options);

		await options.getByRole('textbox', { name: 'Name' }).fill('Release');
		await options
			.getByRole('radio', { name: 'rocket', exact: true })
			.check();
		await options
			.getByRole('radio', { name: 'purple', exact: true })
			.check();

		const preview = options.locator('.hyperfriend-chip-preview');
		await expect(preview).toHaveText('Release');
		await expect(preview).toHaveAttribute('data-colour', 'purple');
		// The rocket is drawn: its path starts like the Octicon `rocket`
		await expect(preview.locator('svg')).toHaveCount(1);
		await expect(
			options.getByRole('radio', { name: 'rocket', exact: true })
		).toBeChecked();
	});

	test('should edit a chip, keep its place and store the new values', async ({
		openOptions,
		storage,
	}) => {
		await storage.seedConfig({
			filters: {
				custom: [BUGS],
				chips: [BUGS.id, FilterChipId.Drafts],
			},
		});
		const options = await openOptions('#filters');

		await options
			.getByRole('button', { name: 'Edit Bugs', exact: true })
			.click();
		await expect(
			options.getByRole('heading', { name: 'Edit chip' })
		).toBeVisible();
		await options.getByRole('textbox', { name: 'Name' }).fill('Open bugs');
		await options
			.getByRole('textbox', { name: 'Filter' })
			.fill('label:bug is:open');
		await options
			.getByRole('button', { name: 'Save', exact: true })
			.click();

		await expect(names(shownList(options))).toHaveText([
			'Open bugs',
			'Drafts',
		]);
		await expect
			.poll(async () => (await storage.getConfig()) as never)
			.toMatchObject({
				filters: {
					chips: [BUGS.id, 'drafts'],
					custom: [
						{
							...BUGS,
							label: 'Open bugs',
							query: 'label:bug is:open',
						},
					],
				},
			});
	});

	test('should delete a chip from the settings and from the bar', async ({
		openOptions,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { custom: [BUGS], chips: [BUGS.id, FilterChipId.Drafts] },
		});
		const options = await openOptions('#filters');

		await options
			.getByRole('button', { name: 'Edit Bugs', exact: true })
			.click();
		await options
			.getByRole('button', { name: 'Delete', exact: true })
			.click();
		// One click only asks: nothing is deleted before the answer
		await expect(options.getByText('Delete this chip?')).toBeVisible();
		await options
			.getByRole('button', { name: 'Yes, delete', exact: true })
			.click();

		await expect(names(shownList(options))).toHaveText(['Drafts']);
		await expect
			.poll(async () => (await storage.getConfig()) as never)
			.toMatchObject({ filters: { chips: ['drafts'], custom: [] } });
	});

	test('should keep the chip when the answer to the delete question is Keep', async ({
		openOptions,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { custom: [BUGS], chips: [BUGS.id] },
		});
		const options = await openOptions('#filters');

		await options
			.getByRole('button', { name: 'Edit Bugs', exact: true })
			.click();
		await options
			.getByRole('button', { name: 'Delete', exact: true })
			.click();
		await options
			.getByRole('button', { name: 'Keep', exact: true })
			.click();

		await expect(options.getByText('Delete this chip?')).toHaveCount(0);
		await expect(
			options.getByRole('button', { name: 'Save', exact: true })
		).toBeVisible();
		await expect
			.poll(async () => (await storage.getConfig()) as never)
			.toMatchObject({ filters: { custom: [BUGS] } });
	});

	test('should save a new chip with Enter in the filter field', async ({
		openOptions,
		storage,
	}) => {
		const options = await openOptions('#filters');
		await openNewChip(options);

		await options.getByRole('textbox', { name: 'Name' }).fill('Main');
		await options
			.getByRole('textbox', { name: 'Filter' })
			.fill('base:main');
		await options.getByRole('textbox', { name: 'Filter' }).press('Enter');

		await expect(names(shownList(options))).toHaveText([
			...DEFAULT_SHOWN,
			'Main',
		]);
		await expect
			.poll(async () => (await storage.getConfig()) as never)
			.toMatchObject({ filters: { custom: [{ query: 'base:main' }] } });
	});

	test('should drop the changes of an edit that was left with the back button', async ({
		openOptions,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { custom: [BUGS], chips: [BUGS.id] },
		});
		const options = await openOptions('#filters');
		await options
			.getByRole('button', { name: 'Edit Bugs', exact: true })
			.click();
		await options.getByRole('textbox', { name: 'Name' }).fill('Changed');
		await options
			.getByRole('textbox', { name: 'Filter' })
			.fill('label:other');

		await options
			.getByRole('button', { name: 'Filters', exact: true })
			.click();

		await expect(
			options.getByRole('button', { name: 'Edit Bugs', exact: true })
		).toBeFocused();
		expect(await storage.getConfig()).toMatchObject({
			filters: { custom: [BUGS] },
		});

		await options
			.getByRole('button', { name: 'Edit Bugs', exact: true })
			.click();

		await expect(
			options.getByRole('textbox', { name: 'Name' })
		).toHaveValue('Bugs');
		await expect(
			options.getByRole('textbox', { name: 'Filter' })
		).toHaveValue('label:bug -label:wip');
	});

	test('should open the editor of a new chip empty after another chip was saved', async ({
		openOptions,
	}) => {
		const options = await openOptions('#filters');
		await openNewChip(options);
		await options.getByRole('textbox', { name: 'Name' }).fill('First');
		await options
			.getByRole('textbox', { name: 'Filter' })
			.fill('label:first');
		await options
			.getByRole('button', { name: 'Save', exact: true })
			.click();
		await expect(names(shownList(options))).toContainText(['First']);

		await openNewChip(options);

		await expect(
			options.getByRole('textbox', { name: 'Name' })
		).toHaveValue('');
		await expect(
			options.getByRole('textbox', { name: 'Filter' })
		).toHaveValue('');
	});

	test('should leave a chip alone that was deleted elsewhere while it was being edited', async ({
		openOptions,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { custom: [BUGS], chips: [BUGS.id] },
		});
		const options = await openOptions('#filters');
		await options
			.getByRole('button', { name: 'Edit Bugs', exact: true })
			.click();

		await storage.seedConfig({ filters: { custom: [], chips: [] } });

		await expect(
			options.getByRole('button', { name: 'Add a custom chip' })
		).toBeFocused();
	});

	test('should keep a chip that is not shown and let the user show it again', async ({
		openOptions,
		storage,
	}) => {
		await storage.seedConfig({
			filters: { custom: [BUGS], chips: [FilterChipId.Drafts] },
		});
		const options = await openOptions('#filters');

		await expect(
			names(
				options.getByRole('list', {
					name: 'Chips not shown in the bar',
				})
			)
		).toContainText(['Bugs']);
		await options
			.getByRole('button', { name: 'Show Bugs in the bar', exact: true })
			.click();

		await expect(names(shownList(options))).toHaveText(['Drafts', 'Bugs']);
		await expect
			.poll(async () => (await storage.getConfig()) as never)
			.toMatchObject({
				filters: { chips: ['drafts', BUGS.id], custom: [BUGS] },
			});
	});

	test('should reject an empty name and an empty filter and store nothing', async ({
		openOptions,
		storage,
	}) => {
		const options = await openOptions('#filters');
		await openNewChip(options);

		await options
			.getByRole('button', { name: 'Save', exact: true })
			.click();

		await expect(
			options.getByText(
				'Enter a name of up to 30 characters (non-English letters count more).'
			)
		).toBeVisible();
		await expect(
			options.getByRole('textbox', { name: 'Name' })
		).toHaveAttribute('aria-invalid', 'true');
		await expect(
			options.getByText('Enter at least one search word.')
		).toBeVisible();
		expect(await storage.getConfig()).toBeUndefined();
	});

	test('should reject a filter with an open quotation mark', async ({
		openOptions,
		storage,
	}) => {
		const options = await openOptions('#filters');
		await openNewChip(options);

		await options.getByRole('textbox', { name: 'Name' }).fill('Labels');
		await options
			.getByRole('textbox', { name: 'Filter' })
			.fill('label:"good first');
		await options
			.getByRole('button', { name: 'Save', exact: true })
			.click();

		await expect(
			options.getByText('Close the quotation mark.')
		).toBeVisible();
		await expect(
			options.getByRole('textbox', { name: 'Filter' })
		).toHaveAttribute('aria-invalid', 'true');
		expect(await storage.getConfig()).toBeUndefined();
	});

	test('should still offer a tenth custom chip when there are nine', async ({
		openOptions,
		storage,
	}) => {
		const custom = Array.from({ length: 9 }, (_, index) => ({
			...BUGS,
			id: `custom-abcd${String(1000 + index)}`,
			label: `Chip ${index}`,
		}));
		await storage.seedConfig({ filters: { custom } });
		const options = await openOptions('#filters');

		await expect(
			options.getByRole('button', { name: 'Add a custom chip' })
		).toBeEnabled();
	});

	test('should reject a filter with OR and tell why', async ({
		openOptions,
		storage,
	}) => {
		const options = await openOptions('#filters');
		await openNewChip(options);

		await options.getByRole('textbox', { name: 'Name' }).fill('Either');
		await options
			.getByRole('textbox', { name: 'Filter' })
			.fill('label:a OR label:b');
		await options
			.getByRole('button', { name: 'Save', exact: true })
			.click();

		await expect(
			options.getByText(
				'Groups (parentheses, OR, AND, NOT) are not supported.'
			)
		).toBeVisible();
		expect(await storage.getConfig()).toBeUndefined();
	});

	test('should stop at 10 custom chips', async ({ openOptions, storage }) => {
		const custom = Array.from({ length: 10 }, (_, index) => ({
			...BUGS,
			id: `custom-abcd${String(1000 + index)}`,
			label: `Chip ${index}`,
		}));
		await storage.seedConfig({ filters: { custom } });
		const options = await openOptions('#filters');

		await expect(
			options.getByRole('button', { name: 'Up to 10 custom chips' })
		).toBeDisabled();
	});

	test('should go back to the list without saving', async ({
		openOptions,
		storage,
	}) => {
		const options = await openOptions('#filters');
		await openNewChip(options);
		await options.getByRole('textbox', { name: 'Name' }).fill('Draft chip');

		await options
			.getByRole('button', { name: 'Filters', exact: true })
			.click();

		await expect(
			options.getByRole('button', { name: 'Add a custom chip' })
		).toBeFocused();
		expect(await storage.getConfig()).toBeUndefined();
	});
});
