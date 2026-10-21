import { Locator, Page } from '@playwright/test';
import { LinkType } from '@shared/models';

import { DEFAULT_STORED_CONFIG } from './fixtures/defaults';
import { expect, test } from './fixtures/extension';
import {
	PAGES,
	REPOSITORY,
	rowOf,
	snapshotItems,
	snapshotUrl,
} from './fixtures/github';

// Templates tab of the settings popup: autosave, persistence, the live preview, the length limit
// and the saved template reaching a GitHub page.

const PULL_REQUEST_LABEL = 'Pull Request link template';
/** Differs from the default `[PR {{pr_number}}]: {{pr_name}}`; only the number is the link */
const CUSTOM_TEMPLATE = '{{repo}}: {{pr_name}} (#[{{pr_number}}])';

/**
 * The form control (label, input, preview, "Saved") of one template.
 *
 * @param options - Settings page.
 * @param label - Label of the template input.
 */
function templateField(options: Page, label: string): Locator {
	return options.locator('[data-component="FormControl"]').filter({
		has: options.getByRole('textbox', { name: label, exact: true }),
	});
}

test('should save a typed template and show it again after a reload', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions();
	const input = options.getByRole('textbox', {
		name: PULL_REQUEST_LABEL,
		exact: true,
	});
	// Loaded state: the field shows the stored (default) template
	await expect(input).toHaveValue('[PR {{pr_number}}]: {{pr_name}}');

	await input.fill(CUSTOM_TEMPLATE);

	await test.step('the field reports the save', async () => {
		await expect(
			templateField(options, PULL_REQUEST_LABEL).getByText('Saved', {
				exact: true,
			})
		).toBeVisible();
	});

	await test.step('the template is stored in chrome.storage.sync', async () => {
		await expect
			.poll(() => storage.getConfig())
			.toEqual({
				...DEFAULT_STORED_CONFIG,
				templates: {
					...DEFAULT_STORED_CONFIG.templates,
					[LinkType.PullRequest]: CUSTOM_TEMPLATE,
				},
			});
	});

	await test.step('the field shows the template after a reload', async () => {
		await options.reload();
		await expect(
			options.getByRole('textbox', {
				name: PULL_REQUEST_LABEL,
				exact: true,
			})
		).toHaveValue(CUSTOM_TEMPLATE);
	});
});

test('should preview only the bracketed part as the link', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const field = templateField(options, PULL_REQUEST_LABEL);

	await field.getByRole('textbox').fill(CUSTOM_TEMPLATE);

	// The preview uses the popup's sample pull request: hyperfriend #12 "Add copy button to PR list"
	const preview = field.getByText(/^Preview: .*\)$/);
	await expect(preview).toHaveText(
		'Preview: hyperfriend: Add copy button to PR list (#12 (link))'
	);
	await expect(preview.locator('span')).toHaveText([
		'Preview:',
		'12',
		'(link)',
	]);
	await expect(preview.getByText('12', { exact: true })).toHaveCSS(
		'text-decoration-line',
		'underline'
	);
});

test('should limit a template to 500 characters', async ({ openOptions }) => {
	const options = await openOptions();
	const field = templateField(options, PULL_REQUEST_LABEL);
	const input = field.getByRole('textbox');
	const longest = `[PR {{pr_number}}]: ${'x'.repeat(480)}`;
	expect(longest, 'precondition: exactly at the limit').toHaveLength(500);
	await input.fill(longest);
	await expect(field.getByText('Saved', { exact: true })).toBeVisible();

	await input.press('End');
	await input.press('y');

	await expect(input).toHaveAttribute('maxlength', '500');
	await expect(input).toHaveValue(longest);
});

test('should copy with the template saved in the popup on a GitHub page opened afterwards', async ({
	page,
	openOptions,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	const [first] = snapshotItems(PAGES.pullList);
	const url = `https://github.com${REPOSITORY}/pull/${first.number}`;
	expect(first.title, 'precondition: no HTML special characters').not.toMatch(
		/[&<>"']/
	);

	await test.step('setup: save a custom template in the popup', async () => {
		const options = await openOptions();
		const field = templateField(options, PULL_REQUEST_LABEL);
		await field.getByRole('textbox').fill(CUSTOM_TEMPLATE);
		await expect(field.getByText('Saved', { exact: true })).toBeVisible();
	});

	await page.goto(snapshotUrl(PAGES.pullList));
	await writeClipboardSentinel(page, 'sentinel: popup template');

	await rowOf(page, first.title)
		.getByRole('button', {
			name: `Copy link to pull request #${first.number}`,
			exact: true,
		})
		.click();

	const html = await normalizeHtml(
		page,
		`react: ${first.title} (#<a href="${url}">${first.number}</a>)`
	);
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html,
			text: `react: ${first.title} (#${first.number}) — ${url}`,
		});
});
