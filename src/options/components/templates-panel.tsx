import { GitPullRequestIcon, IssueOpenedIcon } from '@primer/octicons-react';
import { ConfigModel, LinkTargetModel, LinkType } from '@shared/models';

import { FieldControls, TemplateField } from './template-field';

/** Sample items used for the live previews. */
const SAMPLE_PULL_REQUEST: LinkTargetModel = {
	type: LinkType.PullRequest,
	owner: 'borbiuk',
	repo: 'hyperfriend',
	number: 12,
	title: 'Add copy button to PR list',
	url: 'https://github.com/borbiuk/hyperfriend/pull/12',
};

const SAMPLE_ISSUE: LinkTargetModel = {
	type: LinkType.Issue,
	owner: 'borbiuk',
	repo: 'hyperfriend',
	number: 7,
	title: 'Button is missing on the issue page',
	url: 'https://github.com/borbiuk/hyperfriend/issues/7',
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
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<TemplateField
				type={LinkType.PullRequest}
				label="Pull Request link template"
				icon={GitPullRequestIcon}
				value={config.templates[LinkType.PullRequest]}
				sample={SAMPLE_PULL_REQUEST}
				syncEpoch={syncEpoch}
				registerField={registerField}
			/>
			<TemplateField
				type={LinkType.Issue}
				label="Issue link template"
				icon={IssueOpenedIcon}
				value={config.templates[LinkType.Issue]}
				sample={SAMPLE_ISSUE}
				syncEpoch={syncEpoch}
				registerField={registerField}
			/>
		</div>
	);
}
