import {
	CommentDiscussionIcon,
	GitPullRequestIcon,
	IssueOpenedIcon,
	PlayIcon,
} from '@primer/octicons-react';
import { Text } from '@primer/react';
import { DEFAULT_CONFIG } from '@shared/constants';
import { ConfigModel, LinkTargetModel, LinkType } from '@shared/models';
import { useId, useState } from 'react';

import { FieldControls, TemplateField } from './template-field';

/** Sample items used for the live previews. */
const SAMPLE_PULL_REQUEST: LinkTargetModel = {
	type: LinkType.PullRequest,
	owner: 'borbiuk',
	repo: 'hyperfriend',
	number: 12,
	title: 'Add copy button to PR list',
	url: 'https://github.com/borbiuk/hyperfriend/pull/12',
	author: 'borbiuk',
	state: 'open',
	labels: ['enhancement', 'ui'],
	assignees: ['borbiuk'],
	milestone: '2.2.0',
	headBranch: 'copy-button',
	baseBranch: 'master',
};

const SAMPLE_ISSUE: LinkTargetModel = {
	type: LinkType.Issue,
	owner: 'borbiuk',
	repo: 'hyperfriend',
	number: 7,
	title: 'Button is missing on the issue page',
	url: 'https://github.com/borbiuk/hyperfriend/issues/7',
	author: 'borbiuk',
	state: 'open',
	labels: ['bug'],
	assignees: ['borbiuk'],
	milestone: '2.2.0',
};

const SAMPLE_DISCUSSION: LinkTargetModel = {
	type: LinkType.Discussion,
	owner: 'borbiuk',
	repo: 'hyperfriend',
	number: 3,
	title: 'Ideas for new placeholders',
	url: 'https://github.com/borbiuk/hyperfriend/discussions/3',
	author: 'borbiuk',
	category: 'Ideas',
};

const SAMPLE_RUN: LinkTargetModel = {
	type: LinkType.WorkflowRun,
	owner: 'borbiuk',
	repo: 'hyperfriend',
	number: 42,
	title: 'Add copy button to PR list',
	url: 'https://github.com/borbiuk/hyperfriend/actions/runs/1234567890',
	workflow: 'build',
	branch: 'copy-button',
	status: 'completed successfully',
};

interface TemplatesPanelProps {
	config: ConfigModel;
	/** Increments every time the settings are replaced from outside (reset, import). */
	syncEpoch: number;
	/** Registers a field's save controls with the parent. Returns an unregister function. */
	registerField: (controls: FieldControls) => () => void;
}

/**
 * Content of the Templates tab: the Pull Request, Issue, Discussion and workflow run link templates.
 */
export function TemplatesPanel({
	config,
	syncEpoch,
	registerField,
}: TemplatesPanelProps) {
	const noteId = useId();
	// A customized template of the two less common types is not hidden; the disclosure is not
	// re-opened or closed while the user types (the initial value only)
	const [startOpen] = useState(
		() =>
			config.templates[LinkType.Discussion] !==
				DEFAULT_CONFIG.templates[LinkType.Discussion] ||
			config.templates[LinkType.WorkflowRun] !==
				DEFAULT_CONFIG.templates[LinkType.WorkflowRun]
	);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
			{/* A note for all fields, so it comes first; each input lists it in aria-describedby. */}
			<Text
				id={noteId}
				size="small"
				style={{ color: 'var(--fgColor-muted)' }}
			>
				Put the part that should be the link in [square brackets].
				Details such as labels, assignees and branches are filled only
				where the page shows them.
			</Text>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
				<TemplateField
					type={LinkType.PullRequest}
					label="Pull Request link template"
					icon={GitPullRequestIcon}
					value={config.templates[LinkType.PullRequest]}
					sample={SAMPLE_PULL_REQUEST}
					format={config.format}
					syncEpoch={syncEpoch}
					registerField={registerField}
					noteId={noteId}
				/>
				<TemplateField
					type={LinkType.Issue}
					label="Issue link template"
					icon={IssueOpenedIcon}
					value={config.templates[LinkType.Issue]}
					sample={SAMPLE_ISSUE}
					format={config.format}
					syncEpoch={syncEpoch}
					registerField={registerField}
					noteId={noteId}
				/>
				{/* Closed by default: four fields would make the popup taller than Chrome allows (600 px) */}
				<details open={startOpen}>
					<summary
						style={{
							cursor: 'pointer',
							fontWeight: 600,
							fontSize: 14,
						}}
					>
						Discussions and workflow runs
					</summary>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 16,
							marginTop: 12,
						}}
					>
						<TemplateField
							type={LinkType.Discussion}
							label="Discussion link template"
							icon={CommentDiscussionIcon}
							value={config.templates[LinkType.Discussion]}
							sample={SAMPLE_DISCUSSION}
							format={config.format}
							syncEpoch={syncEpoch}
							registerField={registerField}
							noteId={noteId}
						/>
						<TemplateField
							type={LinkType.WorkflowRun}
							label="Workflow run link template"
							icon={PlayIcon}
							value={config.templates[LinkType.WorkflowRun]}
							sample={SAMPLE_RUN}
							format={config.format}
							syncEpoch={syncEpoch}
							registerField={registerField}
							noteId={noteId}
						/>
					</div>
				</details>
			</div>
		</div>
	);
}
