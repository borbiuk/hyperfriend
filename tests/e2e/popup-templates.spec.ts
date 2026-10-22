import { Locator, Page } from '@playwright/test';
import { LinkType } from '@shared/models';

import { DEFAULT_STORED_CONFIG } from './fixtures/defaults';
import { expect, test } from './fixtures/extension';
import {
	firstPlainItem,
	PAGES,
	REPOSITORY,
	rowOf,
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

test('should list the metadata placeholders and preview them with the sample item', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const field = templateField(options, PULL_REQUEST_LABEL);

	for (const name of [
		'ref',
		'author',
		'state',
		'labels',
		'assignees',
		'milestone',
		'head_branch',
		'base_branch',
	]) {
		await expect(
			field.getByText(`{{${name}}}`, { exact: true })
		).toBeVisible();
	}

	await test.step('the Issue field lists the shared placeholders but no branch placeholders', async () => {
		const issueField = templateField(options, 'Issue link template');
		await expect(
			issueField.getByText('{{milestone}}', { exact: true })
		).toBeVisible();
		await expect(
			issueField.getByText('{{head_branch}}', { exact: true })
		).toHaveCount(0);
		await expect(
			issueField.getByText('{{base_branch}}', { exact: true })
		).toHaveCount(0);
	});

	await field
		.getByRole('textbox')
		.fill('{{ref}} {{state}} {{author}} {{labels}} {{head_branch}}');

	// The popup's sample pull request is open, by borbiuk, labelled enhancement and ui
	await expect(field.getByText(/^Preview: .*\(link\)$/)).toHaveText(
		'Preview: borbiuk/hyperfriend#12 open borbiuk enhancement, ui copy-button (link)'
	);
});

/**
 * Opens the closed disclosure that holds the Discussion and Workflow run fields.
 *
 * @param options - Settings page.
 */
async function openDisclosure(options: Page): Promise<void> {
	await options
		.getByText('Discussions and workflow runs', { exact: true })
		.click();
}

test('should keep the discussion and workflow run fields in a disclosure that is closed at first', async ({
	openOptions,
}) => {
	const options = await openOptions();
	await expect(
		options.getByRole('textbox', { name: 'Discussion link template' })
	).toBeHidden();
	await expect(
		options.getByRole('textbox', { name: 'Workflow run link template' })
	).toBeHidden();

	await openDisclosure(options);

	const discussion = templateField(options, 'Discussion link template');
	const run = templateField(options, 'Workflow run link template');
	await expect(discussion.getByRole('textbox')).toHaveValue(
		'[Discussion {{discussion_number}}]: {{discussion_name}}'
	);
	await expect(run.getByRole('textbox')).toHaveValue(
		'[{{workflow}} #{{run_number}}]: {{run_name}}'
	);
	for (const name of ['category', 'author', 'ref']) {
		await expect(
			discussion.getByText(`{{${name}}}`, { exact: true })
		).toBeVisible();
	}
	for (const name of ['workflow', 'branch', 'status']) {
		await expect(
			run.getByText(`{{${name}}}`, { exact: true })
		).toBeVisible();
	}
	// A workflow run is no numbered item of the repository
	await expect(run.getByText('{{ref}}', { exact: true })).toHaveCount(0);
});

test('should open the disclosure at first when a discussion or workflow run template is customized', async ({
	openOptions,
	storage,
}) => {
	await storage.seedConfig({
		templates: { 'workflow-run': '{{workflow}} [{{run_number}}]' },
	});

	const options = await openOptions();

	await expect(
		options.getByRole('textbox', { name: 'Workflow run link template' })
	).toHaveValue('{{workflow}} [{{run_number}}]');
});

test('should preview the discussion and workflow run templates with their samples', async ({
	openOptions,
}) => {
	const options = await openOptions();
	await openDisclosure(options);
	const discussion = templateField(options, 'Discussion link template');
	const run = templateField(options, 'Workflow run link template');

	await discussion
		.getByRole('textbox')
		.fill('[#{{discussion_number}}] {{category}} by {{author}}');
	await run
		.getByRole('textbox')
		.fill('{{workflow}} [{{run_number}}] on {{branch}}');

	// Only the bracketed part is the link; the screen reader note "(link)" follows it
	await expect(
		discussion.getByText(/^Preview: .*Ideas by borbiuk$/)
	).toHaveText('Preview: #3 (link) Ideas by borbiuk');
	await expect(
		run.getByText(/^Preview: build .* on copy-button$/)
	).toHaveText('Preview: build 42 (link) on copy-button');
});

test('should save the discussion and workflow run templates and show them again after a reload', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions();
	await openDisclosure(options);
	const discussion = templateField(options, 'Discussion link template');
	const run = templateField(options, 'Workflow run link template');

	await discussion
		.getByRole('textbox')
		.fill('[#{{discussion_number}}] {{category}} by {{author}}');
	await run
		.getByRole('textbox')
		.fill('{{workflow}} [{{run_number}}] on {{branch}}');

	await expect
		.poll(() => storage.getConfig())
		.toEqual({
			...DEFAULT_STORED_CONFIG,
			templates: {
				...DEFAULT_STORED_CONFIG.templates,
				discussion:
					'[#{{discussion_number}}] {{category}} by {{author}}',
				'workflow-run': '{{workflow}} [{{run_number}}] on {{branch}}',
			},
		});

	await test.step('after a reload both fields show their templates', async () => {
		await options.reload();
		// A customized template opens the disclosure by itself
		await expect(
			options.getByRole('textbox', { name: 'Discussion link template' })
		).toHaveValue('[#{{discussion_number}}] {{category}} by {{author}}');
		await expect(
			options.getByRole('textbox', { name: 'Workflow run link template' })
		).toHaveValue('{{workflow}} [{{run_number}}] on {{branch}}');
	});
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
	const first = firstPlainItem(PAGES.pullList);
	const url = `https://github.com${REPOSITORY}/pull/${first.number}`;

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
