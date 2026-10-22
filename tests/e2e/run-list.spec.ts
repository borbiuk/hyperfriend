import { LinkType } from '@shared/models';

import { expect, test } from './fixtures/extension';
import {
	PAGES,
	REPOSITORY,
	SnapshotItem,
	snapshotItems,
	snapshotUrl,
} from './fixtures/github';

// Workflow run list (react/react/actions snapshot): one button per run, named after its workflow
// and run number, the copied payload and the details the row shows.

const RUNS = snapshotItems(PAGES.runList);

/**
 * A run with its own name (a scheduled run is named like its workflow, which would hide a mix-up
 * of the two), a branch and a plain title, so the payload literal stays readable
 */
const RUN = RUNS.find(
	({ title, workflow, status, branch }) =>
		title !== workflow &&
		!/[&<>"']/.test(`${title}${workflow}${branch}`) &&
		status &&
		branch
);
const urlOf = (runId?: number): string =>
	`https://github.com${REPOSITORY}/actions/runs/${runId}`;

/** The accessible name of a run's button: the workflow tells apart the runs with the same number */
const nameOf = (number: number, workflow?: string): string =>
	`Copy link to workflow run ${workflow} #${number}`;

test('should give every run exactly one copy button named after its workflow and number', async ({
	page,
}) => {
	await page.goto(snapshotUrl(PAGES.runList));

	await expect(page.locator('[data-hyperfriend="copy-button"]')).toHaveCount(
		RUNS.length
	);
	for (const { number, workflow } of RUNS) {
		await expect(
			page.getByRole('button', {
				name: nameOf(number, workflow),
				exact: true,
			})
		).toHaveCount(1);
	}
});

test('should copy the rich link of a run from its row with the workflow and the run number', async ({
	page,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	test.skip(!RUN, 'no run has its own plain name and a branch');
	const run = RUN as SnapshotItem;
	await page.goto(snapshotUrl(PAGES.runList));
	await writeClipboardSentinel(page, 'sentinel: run row');

	await page
		.getByRole('button', {
			name: nameOf(run.number, run.workflow),
			exact: true,
		})
		.click();

	// The URL has the run id, the text the run number
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${urlOf(run.runId)}">${run.workflow} #${run.number}</a>: ${run.title}`
			),
			text: `${run.workflow} #${run.number}: ${run.title} — ${urlOf(run.runId)}`,
		});
	await expect(page.locator('[data-hyperfriend="tooltip"]')).toHaveText(
		'Copied!'
	);
});

test('should fill the workflow, branch and status placeholders from the run row', async ({
	page,
	storage,
	readClipboard,
	writeClipboardSentinel,
	normalizeHtml,
}) => {
	test.skip(!RUN, 'no run has its own plain name and a branch');
	const run = RUN as SnapshotItem;
	await storage.seedConfig({
		templates: {
			[LinkType.WorkflowRun]:
				'{{run_number}} | {{workflow}} | {{run_name}} | {{branch}} | {{status}} | {{ref}}',
		},
	});
	await page.goto(snapshotUrl(PAGES.runList));
	await writeClipboardSentinel(page, 'sentinel: run placeholders');

	await page
		.getByRole('button', {
			name: nameOf(run.number, run.workflow),
			exact: true,
		})
		.click();

	// A run is no numbered item of the repository, so {{ref}} stays as typed
	const text = `${run.number} | ${run.workflow} | ${run.title} | ${run.branch} | ${run.status} | {{ref}}`;
	await expect
		.poll(() => readClipboard(page))
		.toEqual({
			html: await normalizeHtml(
				page,
				`<a href="${urlOf(run.runId)}">${text}</a>`
			),
			text: `${text} — ${urlOf(run.runId)}`,
		});
});
