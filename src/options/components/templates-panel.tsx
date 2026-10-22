import {
	CommentDiscussionIcon,
	GitPullRequestIcon,
	Icon,
	IssueOpenedIcon,
	PlayIcon,
} from '@primer/octicons-react';
import { VisuallyHidden } from '@primer/react';
import { DEFAULT_CONFIG } from '@shared/constants';
import { ConfigModel, LinkTargetModel, LinkType } from '@shared/models';
import { useState } from 'react';

import '../styles/templates.css';

import { FieldControls, TemplateField } from './template-field';

/** Sample items used for the live previews. */
export const SAMPLE_PULL_REQUEST: LinkTargetModel = {
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

interface LinkTypeItem {
	type: LinkType;
	/** Short name on the switch. */
	short: string;
	/** Name of the template field. */
	label: string;
	icon: Icon;
	sample: LinkTargetModel;
}

/** The link types in display order. */
const LINK_TYPES: LinkTypeItem[] = [
	{
		type: LinkType.PullRequest,
		short: 'PR',
		label: 'Pull Request link template',
		icon: GitPullRequestIcon,
		sample: SAMPLE_PULL_REQUEST,
	},
	{
		type: LinkType.Issue,
		short: 'Issue',
		label: 'Issue link template',
		icon: IssueOpenedIcon,
		sample: SAMPLE_ISSUE,
	},
	{
		type: LinkType.Discussion,
		short: 'Discussion',
		label: 'Discussion link template',
		icon: CommentDiscussionIcon,
		sample: SAMPLE_DISCUSSION,
	},
	{
		type: LinkType.WorkflowRun,
		short: 'Run',
		label: 'Workflow run link template',
		icon: PlayIcon,
		sample: SAMPLE_RUN,
	},
];

interface TemplatesPanelProps {
	config: ConfigModel;
	/** Increments every time the settings are replaced from outside (reset, import). */
	syncEpoch: number;
	/** Registers a field's save controls with the parent. Returns an unregister function. */
	registerField: (controls: FieldControls) => () => void;
}

/**
 * Content of the Templates tab: a switch between the Pull Request, Issue, Discussion and
 * workflow run templates and the editor of the selected one. All four editors stay mounted
 * (the hidden ones keep their state and their box), so the tab never changes its height.
 */
export function TemplatesPanel({
	config,
	syncEpoch,
	registerField,
}: TemplatesPanelProps) {
	const [selected, setSelected] = useState<LinkType>(LinkType.PullRequest);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<div
				role="group"
				aria-label="Link type"
				className="hyperfriend-switch"
			>
				{LINK_TYPES.map(({ type, short, icon: TypeIcon }) => {
					const customized =
						config.templates[type] !==
						DEFAULT_CONFIG.templates[type];

					return (
						<button
							key={type}
							type="button"
							className="hyperfriend-switch__item"
							aria-pressed={type === selected}
							onClick={() => setSelected(type)}
						>
							<TypeIcon size={14} aria-hidden="true" />
							{short}
							{customized && (
								<>
									<span
										className="hyperfriend-dot"
										aria-hidden="true"
									/>
									<VisuallyHidden>
										{' '}
										(customized)
									</VisuallyHidden>
								</>
							)}
						</button>
					);
				})}
			</div>
			<div className="hyperfriend-fields">
				{LINK_TYPES.map(({ type, label, sample }) => (
					<TemplateField
						key={type}
						type={type}
						label={label}
						active={type === selected}
						value={config.templates[type]}
						sample={sample}
						format={config.format}
						syncEpoch={syncEpoch}
						registerField={registerField}
					/>
				))}
			</div>
		</div>
	);
}
