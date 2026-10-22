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
import {
	LinkTypeName,
	selectLinkType,
	templateEditor,
	templateField,
} from './fixtures/templates-tab';

// Templates tab of the settings popup: the link type switch, the editor with placeholder chips,
// autosave, persistence, the live preview, the length limit and the saved template reaching a
// GitHub page.

const PULL_REQUEST_LABEL = 'Pull Request link template';
const DEFAULT_PULL_REQUEST_TEMPLATE = '[PR {{pr_number}}]: {{pr_name}}';
/** Differs from the default `[PR {{pr_number}}]: {{pr_name}}`; only the number is the link */
const CUSTOM_TEMPLATE = '{{repo}}: {{pr_name}} (#[{{pr_number}}])';

/** The two less common link types: switch name, field name, default template and a custom one */
const OTHER_TYPES = [
	{
		name: 'Issue',
		label: 'Issue link template',
		key: LinkType.Issue,
		defaultTemplate: '[Issue {{issue_number}}]: {{issue_name}}',
		custom: '[#{{issue_number}}] {{state}} by {{author}}',
		// The popup's sample issue is #7, open, by borbiuk
		preview: '#7 (link) open by borbiuk',
		previewPattern: /^Preview: .* open by borbiuk$/,
	},
	{
		name: 'Discussion',
		label: 'Discussion link template',
		key: LinkType.Discussion,
		defaultTemplate:
			'[Discussion {{discussion_number}}]: {{discussion_name}}',
		custom: '[#{{discussion_number}}] {{category}} by {{author}}',
		// The popup's sample discussion is #3 in the category Ideas, by borbiuk
		preview: '#3 (link) Ideas by borbiuk',
		previewPattern: /^Preview: .*Ideas by borbiuk$/,
	},
	{
		name: 'Run',
		label: 'Workflow run link template',
		key: LinkType.WorkflowRun,
		defaultTemplate: '[{{workflow}} #{{run_number}}]: {{run_name}}',
		custom: '{{workflow}} [{{run_number}}] on {{branch}}',
		// The popup's sample run is #42 of the workflow build, on the branch copy-button
		preview: 'build 42 (link) on copy-button',
		previewPattern: /^Preview: build .* on copy-button$/,
	},
] as const satisfies readonly {
	name: LinkTypeName;
	label: string;
	key: LinkType;
	defaultTemplate: string;
	custom: string;
	preview: string;
	previewPattern: RegExp;
}[];

test('should save a typed template and show it again after a reload', async ({
	openOptions,
	storage,
}) => {
	const options = await openOptions();
	const editor = templateEditor(options, PULL_REQUEST_LABEL);
	// Loaded state: the editor shows the stored (default) template
	await expect(editor).toHaveAttribute(
		'data-value',
		DEFAULT_PULL_REQUEST_TEMPLATE
	);

	await editor.fill(CUSTOM_TEMPLATE);

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

	await test.step('the editor shows the template, with chips, after a reload', async () => {
		await options.reload();
		const reloaded = templateEditor(options, PULL_REQUEST_LABEL);
		await expect(reloaded).toHaveAttribute('data-value', CUSTOM_TEMPLATE);
		await expect(reloaded.locator('[data-token]')).toHaveText([
			'{{repo}}',
			'{{pr_name}}',
			'{{pr_number}}',
		]);
	});
});

test('should keep a template typed right before the popup closes', async ({
	context,
	openOptions,
	storage,
}) => {
	await context.clock.install();
	const options = await openOptions();
	const editor = templateEditor(options, PULL_REQUEST_LABEL);
	// Loaded state: the editor shows the stored (default) template
	await expect(editor).toHaveAttribute(
		'data-value',
		DEFAULT_PULL_REQUEST_TEMPLATE
	);

	// Timers stop, so the 300 ms autosave never fires: only the save on close can store it
	await options.clock.pauseAt(new Date(Date.now() + 60_000));
	await editor.fill(CUSTOM_TEMPLATE);
	await options.close();

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

test('should preview only the bracketed part as the link', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const field = templateField(options, PULL_REQUEST_LABEL);

	await templateEditor(options, PULL_REQUEST_LABEL).fill(CUSTOM_TEMPLATE);

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

test('should highlight the bracketed link part in the editor', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const editor = templateEditor(options, PULL_REQUEST_LABEL);
	const highlighted = (): Promise<string[]> =>
		options.evaluate(() =>
			[
				...(CSS.highlights.get('hyperfriend-link-pull-request') ?? []),
			].map((range) => range.toString())
		);

	// The default template marks "PR {{pr_number}}" as the link
	await expect.poll(highlighted).toEqual(['[PR {{pr_number}}]']);

	await test.step('a template without brackets has no highlight', async () => {
		await editor.fill('{{pr_name}} without a link part');
		await expect.poll(highlighted).toEqual([]);
	});

	await test.step('typing the brackets highlights them again', async () => {
		await editor.fill('a [{{pr_number}}] b');
		await expect.poll(highlighted).toEqual(['[{{pr_number}}]']);
	});
});

test('should turn a typed placeholder into a chip and remove a chip with one Backspace', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const editor = templateEditor(options, PULL_REQUEST_LABEL);

	await editor.fill('by {{author}}');

	await test.step('the placeholder is shown as one chip', async () => {
		await expect(editor.locator('[data-token]')).toHaveText(['{{author}}']);
		await expect(editor).toHaveAttribute('data-value', 'by {{author}}');
	});

	await test.step('one Backspace removes the whole chip', async () => {
		await editor.press('End');
		await editor.press('Backspace');
		await expect(editor.locator('[data-token]')).toHaveCount(0);
		await expect(editor).toHaveAttribute('data-value', 'by ');
	});
});

test('should insert a placeholder at the caret with a quick button', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const editor = templateEditor(options, PULL_REQUEST_LABEL);
	const field = templateField(options, PULL_REQUEST_LABEL);

	await editor.fill('by ');
	await field
		.getByRole('button', { name: '{{author}}', exact: true })
		.click();

	await expect(editor).toHaveAttribute('data-value', 'by {{author}}');
	await expect(editor.locator('[data-token]')).toHaveText(['{{author}}']);
	// The preview uses the popup's sample pull request, opened by borbiuk
	await expect(
		field.getByText(/^Preview: by borbiuk \(link\)$/)
	).toBeVisible();
});

test('should insert a placeholder chosen in the all placeholders menu', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const editor = templateEditor(options, PULL_REQUEST_LABEL);
	const field = templateField(options, PULL_REQUEST_LABEL);

	await editor.fill('branch ');
	await field.getByRole('button', { name: 'All placeholders' }).click();
	await options
		.getByRole('menuitem', { name: '{{head_branch}}', exact: true })
		.click();

	await expect(editor).toHaveAttribute(
		'data-value',
		'branch {{head_branch}}'
	);
	await expect(editor).toBeFocused();
	// The popup's sample pull request comes from the branch copy-button
	await expect(
		field.getByText(/^Preview: branch copy-button \(link\)$/)
	).toBeVisible();
});

test('should list every placeholder of the Pull Request template in groups in the menu', async ({
	openOptions,
}) => {
	const options = await openOptions();
	await templateField(options, PULL_REQUEST_LABEL)
		.getByRole('button', { name: 'All placeholders' })
		.click();

	const menu = options.getByRole('menu');
	await expect(menu.getByRole('group')).toHaveCount(4);
	for (const title of ['Item', 'Repository', 'Branches', 'Details']) {
		await expect(
			menu.getByRole('group', { name: title, exact: true })
		).toBeVisible();
	}
	await expect(menu.getByRole('menuitem')).toHaveText([
		'{{pr_number}}',
		'{{pr_name}}',
		'{{ref}}',
		'{{owner}}',
		'{{repo}}',
		'{{url}}',
		'{{head_branch}}',
		'{{base_branch}}',
		'{{author}}',
		'{{state}}',
		'{{labels}}',
		'{{assignees}}',
		'{{milestone}}',
	]);
});

test('should preview the metadata placeholders with the sample item', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const field = templateField(options, PULL_REQUEST_LABEL);

	await templateEditor(options, PULL_REQUEST_LABEL).fill(
		'{{ref}} {{state}} {{author}} {{labels}} {{head_branch}}'
	);

	// The popup's sample pull request is open, by borbiuk, labelled enhancement and ui
	await expect(field.getByText(/^Preview: .*\(link\)$/)).toHaveText(
		'Preview: borbiuk/hyperfriend#12 open borbiuk enhancement, ui copy-button (link)'
	);
});

test('should keep the Issue menu free of branch placeholders', async ({
	openOptions,
}) => {
	const options = await openOptions();
	await selectLinkType(options, 'Issue');
	await templateField(options, 'Issue link template')
		.getByRole('button', { name: 'All placeholders' })
		.click();

	const menu = options.getByRole('menu');
	await expect(
		menu.getByRole('menuitem', { name: '{{milestone}}' })
	).toBeVisible();
	await expect(
		menu.getByRole('menuitem', { name: '{{head_branch}}' })
	).toHaveCount(0);
	await expect(
		menu.getByRole('menuitem', { name: '{{base_branch}}' })
	).toHaveCount(0);
});

test('should show only the editor of the selected link type', async ({
	openOptions,
}) => {
	const options = await openOptions();
	const labels = [
		PULL_REQUEST_LABEL,
		...OTHER_TYPES.map((item) => item.label),
	];

	await test.step('the Pull Request editor is selected at first', async () => {
		await expect(templateEditor(options, PULL_REQUEST_LABEL)).toBeVisible();
		for (const label of labels.slice(1)) {
			await expect(templateEditor(options, label)).toBeHidden();
		}
	});

	await test.step('selecting a type hides the previous editor', async () => {
		await selectLinkType(options, 'Run');
		await expect(
			templateEditor(options, 'Workflow run link template')
		).toBeVisible();
		await expect(templateEditor(options, PULL_REQUEST_LABEL)).toBeHidden();
	});
});

for (const item of OTHER_TYPES) {
	test(`should show the default ${item.name} template after selecting it`, async ({
		openOptions,
	}) => {
		const options = await openOptions();

		await selectLinkType(options, item.name);

		await expect(templateEditor(options, item.label)).toHaveAttribute(
			'data-value',
			item.defaultTemplate
		);
	});

	test(`should preview the ${item.name} template with its sample`, async ({
		openOptions,
	}) => {
		const options = await openOptions();
		await selectLinkType(options, item.name);

		await templateEditor(options, item.label).fill(item.custom);

		// Only the bracketed part is the link; the screen reader note "(link)" follows it
		await expect(
			templateField(options, item.label).getByText(item.previewPattern)
		).toHaveText(`Preview: ${item.preview}`);
	});

	test(`should save the ${item.name} template and show it again after a reload`, async ({
		openOptions,
		storage,
	}) => {
		const options = await openOptions();
		await selectLinkType(options, item.name);

		await templateEditor(options, item.label).fill(item.custom);

		await expect
			.poll(() => storage.getConfig())
			.toEqual({
				...DEFAULT_STORED_CONFIG,
				templates: {
					...DEFAULT_STORED_CONFIG.templates,
					[item.key]: item.custom,
				},
			});

		await options.reload();
		await selectLinkType(options, item.name);
		await expect(templateEditor(options, item.label)).toHaveAttribute(
			'data-value',
			item.custom
		);
	});
}

test('should mark a customized template on the link type switch', async ({
	openOptions,
	storage,
}) => {
	await storage.seedConfig({
		templates: { 'workflow-run': '{{workflow}} [{{run_number}}]' },
	});

	const options = await openOptions();

	const switchGroup = options.getByRole('group', { name: 'Link type' });
	await expect(
		switchGroup.getByRole('button', { name: 'Run (customized)' })
	).toBeVisible();
	await expect(switchGroup.getByRole('button')).toHaveText([
		'PR',
		'Issue',
		'Discussion',
		'Run (customized)',
	]);
});

test('should reset a customized template to its default', async ({
	openOptions,
	storage,
}) => {
	await storage.seedConfig({
		templates: { 'pull-request': CUSTOM_TEMPLATE },
	});
	const options = await openOptions();
	const field = templateField(options, PULL_REQUEST_LABEL);
	await expect(templateEditor(options, PULL_REQUEST_LABEL)).toHaveAttribute(
		'data-value',
		CUSTOM_TEMPLATE
	);

	await field.getByRole('button', { name: 'Reset to default' }).click();

	await expect(templateEditor(options, PULL_REQUEST_LABEL)).toHaveAttribute(
		'data-value',
		DEFAULT_PULL_REQUEST_TEMPLATE
	);
	await expect(
		field.getByRole('button', { name: 'Reset to default' })
	).toHaveCount(0);
	await expect.poll(() => storage.getConfig()).toEqual(DEFAULT_STORED_CONFIG);
});

test('should limit a template to 500 characters', async ({ openOptions }) => {
	const options = await openOptions();
	const field = templateField(options, PULL_REQUEST_LABEL);
	const editor = templateEditor(options, PULL_REQUEST_LABEL);
	const longest = `[PR {{pr_number}}]: ${'x'.repeat(480)}`;
	expect(longest, 'precondition: exactly at the limit').toHaveLength(500);
	await editor.fill(longest);
	await expect(field.getByText('Saved', { exact: true })).toBeVisible();

	await editor.press('End');
	await editor.press('y');

	await expect(editor).toHaveAttribute('data-value', longest);
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
		await templateEditor(options, PULL_REQUEST_LABEL).fill(CUSTOM_TEMPLATE);
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
