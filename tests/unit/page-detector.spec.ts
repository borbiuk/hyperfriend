import { expect, test } from '@playwright/test';

import {
	detectPageKind,
	isDiscussionOrActionsList,
	isWorkflowRunSummary,
	PageKind,
} from '../../src/content/services/page-detector';

// URL to page kind: what the content script injects into, and where the shortcut may work.

interface KindCase {
	path: string;
	kind: PageKind;
}

const KIND_CASES: KindCase[] = [
	{ path: '/vercel/next.js/discussions', kind: PageKind.List },
	{
		path: '/vercel/next.js/discussions?discussions_q=is%3Aclosed',
		kind: PageKind.List,
	},
	{
		path: '/vercel/next.js/discussions/categories/help',
		kind: PageKind.List,
	},
	{ path: '/react/react/actions', kind: PageKind.List },
	{ path: '/react/react/actions/workflows/ci.yml', kind: PageKind.List },
	{ path: '/vercel/next.js/discussions/10640', kind: PageKind.Discussion },
	{ path: '/vercel/next.js/discussions/10640/', kind: PageKind.Discussion },
	{
		path: '/react/react/actions/runs/39798109963',
		kind: PageKind.WorkflowRun,
	},
	{
		path: '/react/react/actions/runs/39798109963/attempts/2',
		kind: PageKind.WorkflowRun,
	},
	{
		path: '/react/react/actions/runs/39798109963/job/118012345678',
		kind: PageKind.WorkflowRun,
	},
	// Organization discussions have no repository, so they are not supported
	{ path: '/orgs/community/discussions', kind: PageKind.Unsupported },
	{ path: '/orgs/community/discussions/123', kind: PageKind.Unsupported },
	{ path: '/vercel/next.js/discussions/new', kind: PageKind.Unsupported },
	{
		path: '/vercel/next.js/discussions/new/choose',
		kind: PageKind.Unsupported,
	},
	{
		path: '/vercel/next.js/discussions/categories',
		kind: PageKind.Unsupported,
	},
	{
		path: '/vercel/next.js/discussions/10640/edit',
		kind: PageKind.Unsupported,
	},
	{ path: '/react/react/actions/new', kind: PageKind.Unsupported },
	{ path: '/react/react/actions/caches', kind: PageKind.Unsupported },
	{ path: '/react/react/actions/runs', kind: PageKind.Unsupported },
	{ path: '/react/react/actions/runs/abc', kind: PageKind.Unsupported },
	// The pages that already had a kind keep it
	{ path: '/react/react/pulls', kind: PageKind.List },
	{ path: '/react/react/pull/9713/files', kind: PageKind.PullRequest },
	{ path: '/react/react/issues/10', kind: PageKind.Issue },
];

for (const { path, kind } of KIND_CASES) {
	test(`should detect ${path} as ${kind}`, () => {
		expect(detectPageKind(new URL(`https://github.com${path}`))).toBe(kind);
	});
}

const SUMMARY_CASES: { path: string; summary: boolean }[] = [
	{ path: '/react/react/actions/runs/39798109963', summary: true },
	{ path: '/react/react/actions/runs/39798109963/', summary: true },
	{
		path: '/react/react/actions/runs/39798109963/attempts/2',
		summary: true,
	},
	{ path: '/react/react/actions/runs/39798109963/job/1', summary: false },
	{ path: '/react/react/actions/runs/39798109963/workflow', summary: false },
	{ path: '/react/react/pull/9713', summary: false },
];

for (const { path, summary } of SUMMARY_CASES) {
	test(`should say ${summary ? 'yes' : 'no'} to the workflow run summary for ${path}`, () => {
		expect(isWorkflowRunSummary(new URL(`https://github.com${path}`))).toBe(
			summary
		);
	});
}

const LIST_CASES: { path: string; list: boolean }[] = [
	{ path: '/react/react/actions', list: true },
	{ path: '/vercel/next.js/discussions', list: true },
	{ path: '/vercel/next.js/discussions/categories/help', list: true },
	// Pull Request and Issue lists keep the link fallback
	{ path: '/react/react/pulls', list: false },
	{ path: '/react/react/issues', list: false },
	{ path: '/react/react/actions/runs/39798109963', list: false },
];

for (const { path, list } of LIST_CASES) {
	test(`should say ${list ? 'yes' : 'no'} to a Discussion or Actions list for ${path}`, () => {
		expect(
			isDiscussionOrActionsList(new URL(`https://github.com${path}`))
		).toBe(list);
	});
}
