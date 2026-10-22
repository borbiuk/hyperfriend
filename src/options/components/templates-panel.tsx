import { GitPullRequestIcon, IssueOpenedIcon } from '@primer/octicons-react';
import { Text } from '@primer/react';
import { ConfigModel, LinkTargetModel, LinkType } from '@shared/models';
import { useId } from 'react';

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

interface TemplatesPanelProps {
	config: ConfigModel;
	/** Increments every time the settings are replaced from outside (reset, import). */
	syncEpoch: number;
	/** Registers a field's save controls with the parent. Returns an unregister function. */
	registerField: (controls: FieldControls) => () => void;
}

/**
 * Content of the Templates tab: the Pull Request and Issue link templates.
 */
export function TemplatesPanel({
	config,
	syncEpoch,
	registerField,
}: TemplatesPanelProps) {
	const noteId = useId();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
			{/* A note for both fields, so it comes first; each input lists it in aria-describedby. */}
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
			</div>
		</div>
	);
}
