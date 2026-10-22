import { expect, test } from '@playwright/test';
import {
	ConfigModel,
	LinkFormat,
	LinkType,
	ShortcutType,
} from '@shared/models';
import {
	parseSettings,
	ParseSettingsResult,
	serializeSettings,
	SETTINGS_FILE_NAME,
} from '@shared/services';

/** Config that differs from the defaults in every setting */
const CUSTOM_CONFIG: ConfigModel = {
	templates: {
		[LinkType.PullRequest]: '{{pr_name}} [#{{pr_number}}] "draft"',
		[LinkType.Issue]: '\\[{{issue_number}}\\] {{issue_name}}',
		[LinkType.Discussion]: '{{category}} [#{{discussion_number}}]',
		[LinkType.WorkflowRun]: '[{{workflow}}] {{run_name}}',
	},
	format: LinkFormat.Markdown,
	shortcuts: {
		[ShortcutType.CopyLink]: {
			keys: ['Alt', 'Shift', 'KeyL'],
			enabled: false,
		},
	},
	display: { authorAvatars: false },
};

const EXPORTED_AT = new Date('2026-10-21T08:30:00.000Z');

/**
 * Text of a settings file with the Hyperfriend marker and the given fields.
 *
 * @param fields - Top-level fields besides `app`.
 */
function settingsFile(fields: Record<string, unknown>): string {
	return JSON.stringify({ app: 'hyperfriend', ...fields });
}

test('should name the exported file hyperfriend-settings.json', () => {
	expect(SETTINGS_FILE_NAME).toBe('hyperfriend-settings.json');
});

test('should serialize the config as pretty schema 4 JSON with the given export time', () => {
	expect(serializeSettings(CUSTOM_CONFIG, EXPORTED_AT)).toBe(
		[
			'{',
			'  "app": "hyperfriend",',
			'  "schemaVersion": 4,',
			'  "exportedAt": "2026-10-21T08:30:00.000Z",',
			'  "templates": {',
			'    "pull-request": "{{pr_name}} [#{{pr_number}}] \\"draft\\"",',
			'    "issue": "\\\\[{{issue_number}}\\\\] {{issue_name}}",',
			'    "discussion": "{{category}} [#{{discussion_number}}]",',
			'    "workflow-run": "[{{workflow}}] {{run_name}}"',
			'  },',
			'  "format": "markdown",',
			'  "shortcuts": {',
			'    "copy-link": {',
			'      "keys": [',
			'        "Alt",',
			'        "Shift",',
			'        "KeyL"',
			'      ],',
			'      "enabled": false',
			'    }',
			'  },',
			'  "display": {',
			'    "authorAvatars": false',
			'  }',
			'}',
			'',
		].join('\n')
	);
});

test('should read back every setting of an exported file', () => {
	expect(
		parseSettings(serializeSettings(CUSTOM_CONFIG, EXPORTED_AT))
	).toEqual({
		ok: true,
		settings: {
			templates: {
				[LinkType.PullRequest]: '{{pr_name}} [#{{pr_number}}] "draft"',
				[LinkType.Issue]: '\\[{{issue_number}}\\] {{issue_name}}',
				[LinkType.Discussion]: '{{category}} [#{{discussion_number}}]',
				[LinkType.WorkflowRun]: '[{{workflow}}] {{run_name}}',
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
	});
});

interface ParseCase {
	title: string;
	text: string;
	expected: ParseSettingsResult;
}

/** 500 bracket characters: at the template limit before conversion, 1000 after it */
const BRACKETS_AT_LIMIT = '['.repeat(250) + ']'.repeat(250);
const BRACKETS_AT_LIMIT_CONVERTED = '\\['.repeat(250) + '\\]'.repeat(250);

const SUCCESS_CASES: ParseCase[] = [
	{
		title: 'should read every section of a schema 3 file, trimming templates and normalizing keys',
		text: settingsFile({
			schemaVersion: 3,
			exportedAt: '2026-10-21T08:30:00.000Z',
			templates: {
				'pull-request': '  [PR {{pr_number}}] {{pr_name}}  ',
				issue: '#{{issue_number}} [{{issue_name}}]',
			},
			shortcuts: {
				'copy-link': { keys: ['KeyL', 'Shift', 'Alt'], enabled: false },
			},
			display: { authorAvatars: false },
		}),
		expected: {
			ok: true,
			settings: {
				templates: {
					[LinkType.PullRequest]: '[PR {{pr_number}}] {{pr_name}}',
					[LinkType.Issue]: '#{{issue_number}} [{{issue_name}}]',
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
	},
	{
		title: 'should ignore unknown link types, shortcuts, display keys and fields of a schema 3 file',
		text: settingsFile({
			schemaVersion: 3,
			extra: true,
			templates: { 'merge-request': '[MR]', issue: '[#{{number}}]' },
			shortcuts: { paste: { keys: ['Alt', 'KeyP'], enabled: true } },
			display: { theme: 'dark' },
		}),
		expected: {
			ok: true,
			settings: { templates: { [LinkType.Issue]: '[#{{number}}]' } },
		},
	},
	{
		title: 'should read a schema 3 file with the display section only',
		text: settingsFile({
			schemaVersion: 3,
			display: { authorAvatars: false },
		}),
		expected: { ok: true, settings: { display: { authorAvatars: false } } },
	},
	{
		title: 'should read the discussion and workflow run templates of a schema 4 file',
		text: settingsFile({
			schemaVersion: 4,
			templates: {
				discussion: '  [#{{discussion_number}}] {{category}}  ',
				'workflow-run': '{{workflow}} [{{run_number}}]',
			},
		}),
		expected: {
			ok: true,
			settings: {
				templates: {
					[LinkType.Discussion]:
						'[#{{discussion_number}}] {{category}}',
					[LinkType.WorkflowRun]: '{{workflow}} [{{run_number}}]',
				},
			},
		},
	},
	{
		title: 'should read a schema 4 file without the discussion and workflow run templates, as 2.3.0 wrote it',
		text: settingsFile({
			schemaVersion: 4,
			templates: { 'pull-request': '[#{{pr_number}}]' },
		}),
		expected: {
			ok: true,
			settings: {
				templates: { [LinkType.PullRequest]: '[#{{pr_number}}]' },
			},
		},
	},
	{
		title: 'should read the format of a schema 4 file together with the other sections',
		text: settingsFile({
			schemaVersion: 4,
			format: 'markdown',
			display: { authorAvatars: false },
		}),
		expected: {
			ok: true,
			settings: {
				format: LinkFormat.Markdown,
				display: { authorAvatars: false },
			},
		},
	},
	{
		title: 'should read a schema 4 file with the format only',
		text: settingsFile({ schemaVersion: 4, format: 'rich' }),
		expected: { ok: true, settings: { format: LinkFormat.Rich } },
	},
	{
		title: 'should ignore the format of a schema 3 file, which has none',
		text: settingsFile({
			schemaVersion: 3,
			format: 'markdown',
			display: { authorAvatars: false },
		}),
		expected: { ok: true, settings: { display: { authorAvatars: false } } },
	},
	{
		title: 'should not validate the format of a schema 3 file, which has none',
		text: settingsFile({
			schemaVersion: 3,
			format: 'html',
			display: { authorAvatars: false },
		}),
		expected: { ok: true, settings: { display: { authorAvatars: false } } },
	},
	{
		title: 'should keep the old default template of a schema 3 file as is',
		text: settingsFile({
			schemaVersion: 3,
			templates: { 'pull-request': 'PR {{pr_number}}: {{pr_name}}' },
		}),
		expected: {
			ok: true,
			settings: {
				templates: {
					[LinkType.PullRequest]: 'PR {{pr_number}}: {{pr_name}}',
				},
			},
		},
	},
	{
		title: 'should convert the templates of a schema 2 file and read its shortcuts and display',
		text: settingsFile({
			schemaVersion: 2,
			templates: {
				'pull-request': 'PR {{pr_number}}: {{pr_name}}',
				issue: '[{{issue_number}}] {{issue_name}}',
			},
			shortcuts: {
				'copy-link': {
					keys: ['Control', 'Alt', 'KeyC'],
					enabled: true,
				},
			},
			display: { authorAvatars: false },
		}),
		expected: {
			ok: true,
			settings: {
				templates: {
					[LinkType.PullRequest]: '[PR {{pr_number}}]: {{pr_name}}',
					[LinkType.Issue]: '\\[{{issue_number}}\\] {{issue_name}}',
				},
				shortcuts: {
					[ShortcutType.CopyLink]: {
						keys: ['Control', 'Alt', 'KeyC'],
						enabled: true,
					},
				},
				display: { authorAvatars: false },
			},
		},
	},
	{
		title: 'should convert the templates of a schema 1 file',
		text: settingsFile({
			schemaVersion: 1,
			templates: {
				'pull-request': '[{{pr_number}}] {{pr_name}}',
				issue: 'Issue {{issue_number}}: {{issue_name}}',
			},
		}),
		expected: {
			ok: true,
			settings: {
				templates: {
					[LinkType.PullRequest]: '\\[{{pr_number}}\\] {{pr_name}}',
					[LinkType.Issue]:
						'[Issue {{issue_number}}]: {{issue_name}}',
				},
			},
		},
	},
	{
		title: 'should read only the templates of a schema 1 file',
		text: settingsFile({
			schemaVersion: 1,
			templates: { issue: '#{{issue_number}}' },
			shortcuts: {
				'copy-link': { keys: ['Alt', 'KeyL'], enabled: true },
			},
			display: { authorAvatars: false },
		}),
		expected: {
			ok: true,
			settings: { templates: { [LinkType.Issue]: '#{{issue_number}}' } },
		},
	},
	{
		title: 'should accept a file that starts with a UTF-8 byte order mark',
		text: `\uFEFF${settingsFile({ schemaVersion: 3, display: { authorAvatars: false } })}`,
		expected: { ok: true, settings: { display: { authorAvatars: false } } },
	},
];

/** Error message of an invalid template of the given type */
function templateError(type: LinkType): ParseSettingsResult {
	return {
		ok: false,
		error: `Template "${type}" must be a single line of text up to 500 characters.`,
	};
}

const SHORTCUT_ERROR: ParseSettingsResult = {
	ok: false,
	error: 'Shortcut "copy-link" is not valid.',
};

const ERROR_CASES: ParseCase[] = [
	{
		title: 'should reject text that is not JSON',
		text: 'app=hyperfriend',
		expected: { ok: false, error: 'This file is not valid JSON.' },
	},
	{
		title: 'should reject an empty file as not JSON',
		text: '',
		expected: { ok: false, error: 'This file is not valid JSON.' },
	},
	{
		title: 'should reject a JSON array',
		text: '[]',
		expected: {
			ok: false,
			error: 'This is not a Hyperfriend settings file.',
		},
	},
	{
		title: 'should reject JSON null',
		text: 'null',
		expected: {
			ok: false,
			error: 'This is not a Hyperfriend settings file.',
		},
	},
	{
		title: 'should reject the JSON string "hyperfriend"',
		text: '"hyperfriend"',
		expected: {
			ok: false,
			error: 'This is not a Hyperfriend settings file.',
		},
	},
	{
		title: 'should reject a file of another app',
		text: JSON.stringify({
			app: 'other',
			schemaVersion: 3,
			display: { authorAvatars: false },
		}),
		expected: {
			ok: false,
			error: 'This is not a Hyperfriend settings file.',
		},
	},
	{
		title: 'should reject a file without the app marker',
		text: JSON.stringify({
			schemaVersion: 3,
			display: { authorAvatars: false },
		}),
		expected: {
			ok: false,
			error: 'This is not a Hyperfriend settings file.',
		},
	},
	{
		title: 'should reject an unknown format in a schema 4 file',
		text: settingsFile({ schemaVersion: 4, format: 'html' }),
		expected: {
			ok: false,
			error: 'Format must be "rich" or "markdown".',
		},
	},
	{
		title: 'should reject a format that is not a string in a schema 4 file',
		text: settingsFile({ schemaVersion: 4, format: true }),
		expected: {
			ok: false,
			error: 'Format must be "rich" or "markdown".',
		},
	},
	{
		title: 'should reject a discussion template with a line break in a schema 4 file',
		text: settingsFile({
			schemaVersion: 4,
			templates: { discussion: '[#{{discussion_number}}]\n{{category}}' },
		}),
		expected: {
			ok: false,
			error: 'Template "discussion" must be a single line of text up to 500 characters.',
		},
	},
	{
		title: 'should reject schema 5 as created by a newer version',
		text: settingsFile({
			schemaVersion: 5,
			display: { authorAvatars: false },
		}),
		expected: {
			ok: false,
			error: 'This file was created by a newer version of Hyperfriend.',
		},
	},
	{
		title: 'should reject schema 99 as created by a newer version',
		text: settingsFile({ schemaVersion: 99 }),
		expected: {
			ok: false,
			error: 'This file was created by a newer version of Hyperfriend.',
		},
	},
	{
		title: 'should reject schema 0 as unsupported',
		text: settingsFile({
			schemaVersion: 0,
			display: { authorAvatars: false },
		}),
		expected: {
			ok: false,
			error: 'This settings file has an unsupported version.',
		},
	},
	{
		title: 'should reject the schema version "3" given as a string',
		text: settingsFile({
			schemaVersion: '3',
			display: { authorAvatars: false },
		}),
		expected: {
			ok: false,
			error: 'This settings file has an unsupported version.',
		},
	},
	{
		title: 'should reject the fractional schema version 3.5',
		text: settingsFile({
			schemaVersion: 3.5,
			display: { authorAvatars: false },
		}),
		expected: {
			ok: false,
			error: 'This settings file has an unsupported version.',
		},
	},
	{
		title: 'should reject a file without a schema version',
		text: settingsFile({ display: { authorAvatars: false } }),
		expected: {
			ok: false,
			error: 'This settings file has an unsupported version.',
		},
	},
	{
		title: 'should reject a schema 1 file without templates',
		text: settingsFile({
			schemaVersion: 1,
			display: { authorAvatars: false },
		}),
		expected: {
			ok: false,
			error: 'The file does not contain any templates.',
		},
	},
	{
		title: 'should reject a schema 1 file with an empty templates object',
		text: settingsFile({ schemaVersion: 1, templates: {} }),
		expected: {
			ok: false,
			error: 'The file does not contain any templates.',
		},
	},
	{
		title: 'should reject a schema 1 file whose templates are an array',
		text: settingsFile({
			schemaVersion: 1,
			templates: ['PR {{pr_number}}'],
		}),
		expected: {
			ok: false,
			error: 'The file does not contain any templates.',
		},
	},
	{
		title: 'should reject a schema 1 file with templates of unknown link types only',
		text: settingsFile({
			schemaVersion: 1,
			templates: { 'merge-request': 'MR {{number}}' },
		}),
		expected: {
			ok: false,
			error: 'The file does not contain any templates.',
		},
	},
	{
		title: 'should reject a schema 3 templates section that is a string',
		text: settingsFile({ schemaVersion: 3, templates: 'PR {{pr_number}}' }),
		expected: {
			ok: false,
			error: 'The "templates" section of the file is not valid.',
		},
	},
	{
		title: 'should reject a schema 3 shortcuts section that is an array',
		text: settingsFile({ schemaVersion: 3, shortcuts: [] }),
		expected: {
			ok: false,
			error: 'The "shortcuts" section of the file is not valid.',
		},
	},
	{
		title: 'should reject a schema 2 display section that is null',
		text: settingsFile({ schemaVersion: 2, display: null }),
		expected: {
			ok: false,
			error: 'The "display" section of the file is not valid.',
		},
	},
	{
		title: 'should reject a schema 3 file without sections',
		text: settingsFile({ schemaVersion: 3 }),
		expected: {
			ok: false,
			error: 'The file does not contain any settings.',
		},
	},
	{
		title: 'should reject a schema 3 file with empty sections',
		text: settingsFile({
			schemaVersion: 3,
			templates: {},
			shortcuts: {},
			display: {},
		}),
		expected: {
			ok: false,
			error: 'The file does not contain any settings.',
		},
	},
	{
		title: 'should reject a schema 2 file without sections',
		text: settingsFile({ schemaVersion: 2 }),
		expected: {
			ok: false,
			error: 'The file does not contain any settings.',
		},
	},
	{
		title: 'should reject a template that is a number',
		text: settingsFile({
			schemaVersion: 3,
			templates: { 'pull-request': 42 },
		}),
		expected: templateError(LinkType.PullRequest),
	},
	{
		title: 'should reject a template with a line break',
		text: settingsFile({
			schemaVersion: 3,
			templates: { issue: 'Issue {{issue_number}}\n{{issue_name}}' },
		}),
		expected: templateError(LinkType.Issue),
	},
	{
		title: 'should reject a template with a tab inside',
		text: settingsFile({
			schemaVersion: 3,
			templates: { issue: 'Issue\t{{issue_number}}' },
		}),
		expected: templateError(LinkType.Issue),
	},
	{
		title: 'should reject a template with a DEL control character',
		text: settingsFile({
			schemaVersion: 3,
			templates: { issue: 'Issue\u007F{{issue_number}}' },
		}),
		expected: templateError(LinkType.Issue),
	},
	{
		title: 'should reject an invalid template of a schema 1 file',
		text: settingsFile({
			schemaVersion: 1,
			templates: { 'pull-request': ['PR'] },
		}),
		expected: templateError(LinkType.PullRequest),
	},
	{
		title: 'should reject a shortcut given as a string',
		text: settingsFile({
			schemaVersion: 3,
			shortcuts: { 'copy-link': 'Shift+KeyC' },
		}),
		expected: SHORTCUT_ERROR,
	},
	{
		title: 'should reject a shortcut without "enabled"',
		text: settingsFile({
			schemaVersion: 3,
			shortcuts: { 'copy-link': { keys: ['Alt', 'KeyL'] } },
		}),
		expected: SHORTCUT_ERROR,
	},
	{
		title: 'should reject a shortcut whose "enabled" is a string',
		text: settingsFile({
			schemaVersion: 2,
			shortcuts: {
				'copy-link': { keys: ['Alt', 'KeyL'], enabled: 'yes' },
			},
		}),
		expected: SHORTCUT_ERROR,
	},
	{
		title: 'should reject shortcut keys without a modifier',
		text: settingsFile({
			schemaVersion: 3,
			shortcuts: { 'copy-link': { keys: ['KeyC'], enabled: true } },
		}),
		expected: SHORTCUT_ERROR,
	},
	{
		title: 'should reject browser-reserved shortcut keys, even when disabled',
		text: settingsFile({
			schemaVersion: 3,
			shortcuts: {
				'copy-link': { keys: ['Control', 'KeyV'], enabled: false },
			},
		}),
		expected: SHORTCUT_ERROR,
	},
	{
		title: 'should reject shortcut keys with a disallowed main key',
		text: settingsFile({
			schemaVersion: 3,
			shortcuts: {
				'copy-link': { keys: ['Shift', 'Escape'], enabled: true },
			},
		}),
		expected: SHORTCUT_ERROR,
	},
	{
		title: 'should reject an authorAvatars display setting that is a string',
		text: settingsFile({
			schemaVersion: 3,
			display: { authorAvatars: 'no' },
		}),
		expected: {
			ok: false,
			error: 'Display setting "authorAvatars" must be true or false.',
		},
	},
	{
		title: 'should reject an authorAvatars display setting that is null',
		text: settingsFile({
			schemaVersion: 2,
			display: { authorAvatars: null },
		}),
		expected: {
			ok: false,
			error: 'Display setting "authorAvatars" must be true or false.',
		},
	},
];

const TEMPLATE_LIMIT_CASES: ParseCase[] = [
	{
		title: 'should accept a schema 3 template of exactly 500 characters',
		text: settingsFile({
			schemaVersion: 3,
			templates: { issue: 'a'.repeat(500) },
		}),
		expected: {
			ok: true,
			settings: { templates: { [LinkType.Issue]: 'a'.repeat(500) } },
		},
	},
	{
		title: 'should reject a schema 3 template of 501 characters',
		text: settingsFile({
			schemaVersion: 3,
			templates: { issue: 'a'.repeat(501) },
		}),
		expected: templateError(LinkType.Issue),
	},
	{
		title: 'should count the 500 characters of a schema 3 template after trimming it',
		text: settingsFile({
			schemaVersion: 3,
			templates: { issue: ` ${'a'.repeat(500)} ` },
		}),
		expected: {
			ok: true,
			settings: { templates: { [LinkType.Issue]: 'a'.repeat(500) } },
		},
	},
	{
		title: 'should accept a schema 2 template of 500 brackets that is longer after conversion',
		text: settingsFile({
			schemaVersion: 2,
			templates: { 'pull-request': BRACKETS_AT_LIMIT },
		}),
		expected: {
			ok: true,
			settings: {
				templates: {
					[LinkType.PullRequest]: BRACKETS_AT_LIMIT_CONVERTED,
				},
			},
		},
	},
	{
		title: 'should reject a schema 2 template of 501 characters',
		text: settingsFile({
			schemaVersion: 2,
			templates: { 'pull-request': 'a'.repeat(501) },
		}),
		expected: templateError(LinkType.PullRequest),
	},
	{
		title: 'should accept a schema 1 template of 500 brackets that is longer after conversion',
		text: settingsFile({
			schemaVersion: 1,
			templates: { issue: BRACKETS_AT_LIMIT },
		}),
		expected: {
			ok: true,
			settings: {
				templates: { [LinkType.Issue]: BRACKETS_AT_LIMIT_CONVERTED },
			},
		},
	},
	{
		title: 'should reject a schema 1 template of 501 characters',
		text: settingsFile({
			schemaVersion: 1,
			templates: { issue: 'a'.repeat(501) },
		}),
		expected: templateError(LinkType.Issue),
	},
];

/** A valid schema 3 file padded with trailing whitespace to the given UTF-8 size */
function fileOfBytes(bytes: number): string {
	const file = settingsFile({
		schemaVersion: 3,
		display: { authorAvatars: false },
	});
	return file + ' '.repeat(bytes - file.length);
}

const SIZE_CASES: ParseCase[] = [
	{
		title: 'should accept a file of exactly 64 KB',
		text: fileOfBytes(65536),
		expected: { ok: true, settings: { display: { authorAvatars: false } } },
	},
	{
		title: 'should reject a file of 64 KB and one byte',
		text: fileOfBytes(65537),
		expected: { ok: false, error: 'The file is too large (max 64 KB).' },
	},
	{
		title: 'should measure the size in UTF-8 bytes, not in characters',
		// 40000 two-byte characters: under 64K characters, over 64 KB
		text: settingsFile({
			schemaVersion: 3,
			display: { authorAvatars: false },
			note: 'é'.repeat(40000),
		}),
		expected: { ok: false, error: 'The file is too large (max 64 KB).' },
	},
];

for (const c of [
	...SUCCESS_CASES,
	...ERROR_CASES,
	...TEMPLATE_LIMIT_CASES,
	...SIZE_CASES,
]) {
	test(c.title, () => {
		expect(parseSettings(c.text)).toEqual(c.expected);
	});
}
