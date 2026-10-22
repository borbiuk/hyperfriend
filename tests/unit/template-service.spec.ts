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

/** Pull request with every detail the page can show */
const DETAILED_PULL_REQUEST: LinkTargetModel = {
	...PULL_REQUEST,
	author: 'pingan1927',
	state: 'merged',
	labels: ['CLA Signed', 'React Core Team'],
	assignees: ['aweary', 'gaearon'],
	milestone: 'v16',
	headBranch: 'koubei-fe:master',
	baseBranch: 'react:master',
};

/** Issue with every detail the page can show */
const DETAILED_ISSUE: LinkTargetModel = {
	...ISSUE,
	author: 'jriecken',
	state: 'closed',
	labels: ['Type: Bug'],
	assignees: ['aweary'],
	milestone: 'v15',
};

/** Discussion with every detail the page can show */
const DISCUSSION: LinkTargetModel = {
	type: LinkType.Discussion,
	owner: 'vercel',
	repo: 'next.js',
	number: 10640,
	title: 'Companies / Sites using Next.js',
	url: 'https://github.com/vercel/next.js/discussions/10640',
	author: 'timneutkens',
	category: 'Show and tell',
};

/** Workflow run with every detail the page can show; `number` is the run number, the URL has the run id */
const WORKFLOW_RUN: LinkTargetModel = {
	type: LinkType.WorkflowRun,
	owner: 'react',
	repo: 'react',
	number: 20481,
	title: '[compiler] Allow ref access',
	url: 'https://github.com/react/react/actions/runs/39798109963',
	workflow: '(Shared) Lint',
	branch: 'zhoubiao188:scan-2026-10-19',
	status: 'completed successfully',
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
		title: 'should fill every discussion placeholder',
		template:
			'{{discussion_number}} {{discussion_name}} {{owner}}/{{repo}} {{ref}} {{author}} {{category}} {{url}}',
		target: DISCUSSION,
		expected: {
			before: '',
			link: '10640 Companies / Sites using Next.js vercel/next.js vercel/next.js#10640 timneutkens Show and tell https://github.com/vercel/next.js/discussions/10640',
			after: '',
		},
	},
	{
		title: 'should fill every workflow run placeholder',
		template:
			'{{run_number}} {{run_name}} {{workflow}} {{branch}} {{status}} {{owner}}/{{repo}} {{url}}',
		target: WORKFLOW_RUN,
		expected: {
			before: '',
			link: '20481 [compiler] Allow ref access (Shared) Lint zhoubiao188:scan-2026-10-19 completed successfully react/react https://github.com/react/react/actions/runs/39798109963',
			after: '',
		},
	},
	{
		title: 'should fill the aliases "{{number}}: {{title}}" for a workflow run with the run number',
		template: '{{number}}: {{title}}',
		target: WORKFLOW_RUN,
		expected: {
			before: '',
			link: '20481: [compiler] Allow ref access',
			after: '',
		},
	},
	{
		title: 'should keep "{{ref}}" of a workflow run as typed, since a run is no numbered item',
		template: '{{ref}} {{run_number}}',
		target: WORKFLOW_RUN,
		expected: { before: '', link: '{{ref}} 20481', after: '' },
	},
	{
		title: 'should keep the pull request details of a discussion as typed',
		template: '{{labels}} {{state}} {{discussion_number}}',
		target: DISCUSSION,
		expected: { before: '', link: '{{labels}} {{state}} 10640', after: '' },
	},
	{
		title: 'should render the details a page did not show as empty text for a discussion',
		template: '{{discussion_number}} [{{author}}{{category}}]',
		target: { ...DISCUSSION, author: undefined, category: undefined },
		expected: { before: '', link: '10640', after: '' },
	},
	{
		title: 'should render the details a page did not show as empty text for a workflow run',
		template: '{{run_number}} [{{branch}}{{status}}] {{workflow}}',
		target: { ...WORKFLOW_RUN, branch: undefined, status: undefined },
		expected: { before: '', link: '20481  (Shared) Lint', after: '' },
	},
	{
		title: 'should use the default discussion template for an empty template',
		template: '',
		target: DISCUSSION,
		expected: {
			before: '',
			link: 'Discussion 10640',
			after: ': Companies / Sites using Next.js',
		},
	},
	{
		title: 'should use the default workflow run template for an empty template',
		template: '',
		target: WORKFLOW_RUN,
		expected: {
			before: '',
			link: '(Shared) Lint #20481',
			after: ': [compiler] Allow ref access',
		},
	},
	{
		title: 'should fill "{{ref}}" with owner, repo and number for a pull request',
		template: '{{ref}}',
		target: PULL_REQUEST,
		expected: { before: '', link: 'react/react#9713', after: '' },
	},
	{
		title: 'should fill "{{ref}}" with owner, repo and number for an issue',
		template: '{{ref}}',
		target: ISSUE,
		expected: { before: '', link: 'react/react#10', after: '' },
	},
	{
		title: 'should fill every detail placeholder of a pull request',
		template:
			'{{author}} | {{state}} | {{labels}} | {{assignees}} | {{milestone}} | {{base_branch}} <- {{head_branch}}',
		target: DETAILED_PULL_REQUEST,
		expected: {
			before: '',
			link: 'pingan1927 | merged | CLA Signed, React Core Team | aweary, gaearon | v16 | react:master <- koubei-fe:master',
			after: '',
		},
	},
	{
		title: 'should fill every detail placeholder of an issue',
		template:
			'{{author}} | {{state}} | {{labels}} | {{assignees}} | {{milestone}}',
		target: DETAILED_ISSUE,
		expected: {
			before: '',
			link: 'jriecken | closed | Type: Bug | aweary | v15',
			after: '',
		},
	},
	{
		title: 'should render details the page did not show as empty text and use the whole text as the link in "[{{author}}]: {{state}}{{labels}}{{milestone}}"',
		template: '[{{author}}]: {{state}}{{labels}}{{milestone}}',
		target: PULL_REQUEST,
		expected: { before: '', link: ':', after: '' },
	},
	{
		title: 'should use the default template when every placeholder of the template is empty',
		template: '{{author}}{{labels}}',
		target: PULL_REQUEST,
		expected: {
			before: '',
			link: 'PR 9713',
			after: ': Fix number input value',
		},
	},
	{
		title: 'should keep the branch placeholders of "{{head_branch}}" as is for an issue',
		template: '{{head_branch}} {{base_branch}}',
		target: DETAILED_ISSUE,
		expected: {
			before: '',
			link: '{{head_branch}} {{base_branch}}',
			after: '',
		},
	},
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
