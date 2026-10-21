import { expect, test } from '@playwright/test';
import { DEFAULT_CONFIG } from '@shared/constants';
import { LinkTargetModel, LinkType } from '@shared/models';
import {
	renderTemplate,
	renderTemplateParts,
	TemplateParts,
} from '@shared/services';
import { convertLegacyTemplate } from '@shared/services/template-service';

const PULL_REQUEST: LinkTargetModel = {
	type: LinkType.PullRequest,
	owner: 'react',
	repo: 'react',
	number: 9713,
	title: 'Fix number input value',
	url: 'https://github.com/react/react/pull/9713',
};

const ISSUE: LinkTargetModel = {
	type: LinkType.Issue,
	owner: 'react',
	repo: 'react',
	number: 10,
	title: 'Crash on select',
	url: 'https://github.com/react/react/issues/10',
};

/** Pull request whose title has brackets, to prove they are plain text */
const BRACKET_PULL_REQUEST: LinkTargetModel = {
	...PULL_REQUEST,
	title: '[WIP] Fix [input]',
};

test('should split the default pull request template into link and text', () => {
	const parts = renderTemplateParts(
		DEFAULT_CONFIG.templates[LinkType.PullRequest],
		PULL_REQUEST
	);

	expect(parts).toEqual({
		before: '',
		link: 'PR 9713',
		after: ': Fix number input value',
	});
});

interface PartsCase {
	title: string;
	template: string;
	target: LinkTargetModel;
	expected: TemplateParts;
}

const PLACEHOLDER_CASES: PartsCase[] = [
	{
		title: 'should fill every pull request placeholder in "{{pr_number}} {{pr_name}} {{owner}}/{{repo}} {{url}}"',
		template: '{{pr_number}} {{pr_name}} {{owner}}/{{repo}} {{url}}',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: '9713 Fix number input value react/react https://github.com/react/react/pull/9713',
			after: '',
		},
	},
	{
		title: 'should fill every issue placeholder in "{{issue_number}} {{issue_name}} {{owner}}/{{repo}} {{url}}"',
		template: '{{issue_number}} {{issue_name}} {{owner}}/{{repo}} {{url}}',
		target: ISSUE,
		expected: {
			before: '',
			link: '10 Crash on select react/react https://github.com/react/react/issues/10',
			after: '',
		},
	},
	{
		title: 'should fill the aliases "{{number}}: {{title}}" for a pull request',
		template: '{{number}}: {{title}}',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: '9713: Fix number input value',
			after: '',
		},
	},
	{
		title: 'should fill the aliases "{{number}}: {{title}}" for an issue',
		template: '{{number}}: {{title}}',
		target: ISSUE,
		expected: { before: '', link: '10: Crash on select', after: '' },
	},
	{
		title: 'should allow whitespace inside the braces in "{{ pr_number }} {{  pr_name}}"',
		template: '{{ pr_number }} {{  pr_name}}',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: '9713 Fix number input value',
			after: '',
		},
	},
	{
		title: 'should keep the unknown placeholder of "{{branch}} {{pr_number}}" as is',
		template: '{{branch}} {{pr_number}}',
		target: PULL_REQUEST,
		expected: { before: '', link: '{{branch}} 9713', after: '' },
	},
	{
		title: 'should keep the issue placeholder of "{{issue_number}} {{pr_number}}" as is for a pull request',
		template: '{{issue_number}} {{pr_number}}',
		target: PULL_REQUEST,
		expected: { before: '', link: '{{issue_number}} 9713', after: '' },
	},
	{
		title: 'should keep the pull request placeholder of "{{pr_name}} {{issue_name}}" as is for an issue',
		template: '{{pr_name}} {{issue_name}}',
		target: ISSUE,
		expected: {
			before: '',
			link: '{{pr_name}} Crash on select',
			after: '',
		},
	},
	{
		title: 'should keep the upper-case "{{PR_NUMBER}}" as is',
		template: '{{PR_NUMBER}} {{pr_number}}',
		target: PULL_REQUEST,
		expected: { before: '', link: '{{PR_NUMBER}} 9713', after: '' },
	},
];

const FALLBACK_CASES: PartsCase[] = [
	{
		title: 'should fall back to the default pull request template for ""',
		template: '',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: 'PR 9713',
			after: ': Fix number input value',
		},
	},
	{
		title: 'should fall back to the default issue template for a whitespace-only template',
		template: '  \t ',
		target: ISSUE,
		expected: { before: '', link: 'Issue 10', after: ': Crash on select' },
	},
	{
		title: 'should fall back to the default pull request template for "[]", which renders to empty text',
		template: '[]',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: 'PR 9713',
			after: ': Fix number input value',
		},
	},
	{
		title: 'should fall back to the default issue template for " [ ] ", which renders to whitespace',
		template: ' [ ] ',
		target: ISSUE,
		expected: { before: '', link: 'Issue 10', after: ': Crash on select' },
	},
];

const SEGMENT_CASES: PartsCase[] = [
	{
		title: 'should split the default issue template into link and text',
		template: '[Issue {{issue_number}}]: {{issue_name}}',
		target: ISSUE,
		expected: { before: '', link: 'Issue 10', after: ': Crash on select' },
	},
	{
		title: 'should make the whole text the link when "PR {{pr_number}}: {{pr_name}}" has no brackets',
		template: 'PR {{pr_number}}: {{pr_name}}',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: 'PR 9713: Fix number input value',
			after: '',
		},
	},
	{
		title: 'should link the segment in the middle of "See [#{{pr_number}}] now"',
		template: 'See [#{{pr_number}}] now',
		target: PULL_REQUEST,
		expected: { before: 'See ', link: '#9713', after: ' now' },
	},
	{
		title: 'should link only the first pair of "[{{pr_number}}] [{{pr_name}}]"',
		template: '[{{pr_number}}] [{{pr_name}}]',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: '9713',
			after: ' [Fix number input value]',
		},
	},
	{
		title: 'should keep a "[" inside the segment of "[a [b] c]" literal',
		template: '[a [b] c]',
		target: PULL_REQUEST,
		expected: { before: '', link: 'a [b', after: ' c]' },
	},
	{
		title: 'should keep a "]" before the segment of "a] [b]" literal',
		template: 'a] [b]',
		target: PULL_REQUEST,
		expected: { before: 'a] ', link: 'b', after: '' },
	},
	{
		title: 'should make the whole text the link when "PR [{{pr_number}}: {{pr_name}}" has an unclosed "["',
		template: 'PR [{{pr_number}}: {{pr_name}}',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: 'PR [9713: Fix number input value',
			after: '',
		},
	},
	{
		title: 'should render the escaped brackets of "\\[{{pr_number}}\\] {{pr_name}}" as text',
		template: '\\[{{pr_number}}\\] {{pr_name}}',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: '[9713] Fix number input value',
			after: '',
		},
	},
	{
		title: 'should link the segment after the escaped brackets of "\\[WIP\\] [{{pr_name}}]"',
		template: '\\[WIP\\] [{{pr_name}}]',
		target: PULL_REQUEST,
		expected: {
			before: '[WIP] ',
			link: 'Fix number input value',
			after: '',
		},
	},
	{
		title: 'should keep an escaped "]" inside the segment of "[PR \\] {{pr_number}}] x"',
		template: '[PR \\] {{pr_number}}] x',
		target: PULL_REQUEST,
		expected: { before: '', link: 'PR ] 9713', after: ' x' },
	},
	{
		title: 'should keep a backslash that escapes no bracket in "C:\\docs [{{pr_number}}]"',
		template: 'C:\\docs [{{pr_number}}]',
		target: PULL_REQUEST,
		expected: { before: 'C:\\docs ', link: '9713', after: '' },
	},
	{
		title: 'should keep the first backslash of "\\\\[x]" and read the second as an escape',
		template: '\\\\[x]',
		target: PULL_REQUEST,
		expected: { before: '', link: '\\[x]', after: '' },
	},
	{
		title: 'should keep the brackets of the title as text in the default template',
		template: '[PR {{pr_number}}]: {{pr_name}}',
		target: BRACKET_PULL_REQUEST,
		expected: { before: '', link: 'PR 9713', after: ': [WIP] Fix [input]' },
	},
	{
		title: 'should keep the brackets of the title as text inside the segment of "[{{pr_name}}] #{{pr_number}}"',
		template: '[{{pr_name}}] #{{pr_number}}',
		target: BRACKET_PULL_REQUEST,
		expected: { before: '', link: '[WIP] Fix [input]', after: ' #9713' },
	},
	{
		title: 'should not read "{{pr_[number]}}" as a placeholder',
		template: '{{pr_[number]}}',
		target: PULL_REQUEST,
		expected: { before: '{{pr_', link: 'number', after: '}}' },
	},
	{
		title: 'should not read "[{{pr_]number}}" as a placeholder',
		template: '[{{pr_]number}}',
		target: PULL_REQUEST,
		expected: { before: '', link: '{{pr_', after: 'number}}' },
	},
	{
		title: 'should move the edge spaces of "Fix[ {{pr_number}} ]now" outside the link',
		template: 'Fix[ {{pr_number}} ]now',
		target: PULL_REQUEST,
		expected: { before: 'Fix ', link: '9713', after: ' now' },
	},
	{
		title: 'should trim the ends and keep the inner spacing of "  [{{pr_number}}]  {{pr_name}}  "',
		template: '  [{{pr_number}}]  {{pr_name}}  ',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: '9713',
			after: '  Fix number input value',
		},
	},
	{
		title: 'should make the whole text the link when the segment of "PR [ ] {{pr_number}}" is whitespace',
		template: 'PR [ ] {{pr_number}}',
		target: PULL_REQUEST,
		expected: { before: '', link: 'PR   9713', after: '' },
	},
];

for (const c of [...PLACEHOLDER_CASES, ...FALLBACK_CASES, ...SEGMENT_CASES]) {
	test(c.title, () => {
		expect(renderTemplateParts(c.template, c.target)).toEqual(c.expected);
	});
}

test('should render "[PR {{pr_number}}]: {{pr_name}}" as one string without the brackets', () => {
	expect(
		renderTemplate('[PR {{pr_number}}]: {{pr_name}}', PULL_REQUEST)
	).toBe('PR 9713: Fix number input value');
});

test('should render an empty issue template as the default issue text', () => {
	expect(renderTemplate('', ISSUE)).toBe('Issue 10: Crash on select');
});

interface ConversionCase {
	title: string;
	template: string;
	type: LinkType;
	expected: string;
}

const CONVERSION_CASES: ConversionCase[] = [
	{
		title: 'should convert the old default pull request template to the new default',
		template: 'PR {{pr_number}}: {{pr_name}}',
		type: LinkType.PullRequest,
		expected: '[PR {{pr_number}}]: {{pr_name}}',
	},
	{
		title: 'should convert the old default issue template to the new default',
		template: 'Issue {{issue_number}}: {{issue_name}}',
		type: LinkType.Issue,
		expected: '[Issue {{issue_number}}]: {{issue_name}}',
	},
	{
		title: 'should keep the old default issue template as is when it is the pull request template',
		template: 'Issue {{issue_number}}: {{issue_name}}',
		type: LinkType.PullRequest,
		expected: 'Issue {{issue_number}}: {{issue_name}}',
	},
	{
		title: 'should keep "PR {{pr_number}}: {{pr_name}} " with a trailing space as is',
		template: 'PR {{pr_number}}: {{pr_name}} ',
		type: LinkType.PullRequest,
		expected: 'PR {{pr_number}}: {{pr_name}} ',
	},
	{
		title: 'should escape every bracket of "[{{pr_number}}] {{pr_name}} [x]"',
		template: '[{{pr_number}}] {{pr_name}} [x]',
		type: LinkType.PullRequest,
		expected: '\\[{{pr_number}}\\] {{pr_name}} \\[x\\]',
	},
	{
		title: 'should escape the brackets and keep the backslashes of "a\\[b] c\\d"',
		template: 'a\\[b] c\\d',
		type: LinkType.Issue,
		expected: 'a\\\\[b\\] c\\d',
	},
];

for (const c of CONVERSION_CASES) {
	test(c.title, () => {
		expect(convertLegacyTemplate(c.template, c.type)).toBe(c.expected);
	});
}

interface LegacyRenderCase {
	/** Template as written in 2.0.0 */
	template: string;
	/** Whole text 2.0.0 rendered for PULL_REQUEST, all of it the link */
	rendered: string;
}

const LEGACY_RENDER_CASES: LegacyRenderCase[] = [
	{
		template: '[{{pr_number}}] {{pr_name}}',
		rendered: '[9713] Fix number input value',
	},
	{ template: 'C:\\[{{pr_number}}]', rendered: 'C:\\[9713]' },
	{ template: 'x \\] y {{pr_number}}', rendered: 'x \\] y 9713' },
	{ template: '{{pr_name}} [ ]', rendered: 'Fix number input value [ ]' },
	{ template: '[]{{pr_number}}', rendered: '[]9713' },
];

for (const c of LEGACY_RENDER_CASES) {
	test(`should render the converted old template "${c.template}" as the whole-text link of 2.0.0`, () => {
		const converted = convertLegacyTemplate(
			c.template,
			LinkType.PullRequest
		);

		expect(renderTemplateParts(converted, PULL_REQUEST)).toEqual({
			before: '',
			link: c.rendered,
			after: '',
		});
	});
}
