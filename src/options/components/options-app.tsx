import { GitPullRequestIcon, IssueOpenedIcon } from '@primer/octicons-react';
import { Heading, Text } from '@primer/react';
import { LinkTargetModel, LinkType } from '@shared/models';
import { useCallback, useRef, useState } from 'react';

import { useConfig } from '../hooks/use-config';
import { useViewMode } from '../hooks/use-view-mode';

import { FooterActions } from './footer-actions';
import { Logo } from './logo';
import { SettingsSection } from './settings-section';
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

/**
 * Root of the toolbar popup: header, settings sections and footer.
 */
export function OptionsApp() {
	const { config, refresh } = useConfig();
	const viewMode = useViewMode();
	const [syncEpoch, setSyncEpoch] = useState(0);
	const fields = useRef(new Set<FieldControls>());

	const registerField = useCallback(
		(controls: FieldControls): (() => void) => {
			fields.current.add(controls);
			return () => {
				fields.current.delete(controls);
			};
		},
		[]
	);

	const flushAll = useCallback(async (): Promise<void> => {
		await Promise.all([...fields.current].map((field) => field.flush()));
	}, []);

	const cancelAll = useCallback(async (): Promise<void> => {
		await Promise.all([...fields.current].map((field) => field.cancel()));
	}, []);

	// Both updates land in one render, so the fields see the new value with the new epoch.
	const applyStored = useCallback(async (): Promise<void> => {
		await refresh();
		setSyncEpoch((epoch) => epoch + 1);
	}, [refresh]);

	return (
		<main
			style={{
				boxSizing: 'border-box',
				width: 400,
				minHeight: 120,
				padding: 16,
				// Center the panel when the page is shown in a browser tab.
				margin: viewMode === 'tab' ? '24px auto' : 0,
				display: 'flex',
				flexDirection: 'column',
				gap: 16,
				backgroundColor: 'var(--bgColor-default)',
				color: 'var(--fgColor-default)',
			}}
		>
			<header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<Logo size={28} />
				<div>
					<Heading as="h1" variant="small">
						Hyperfriend
					</Heading>
					<Text
						size="small"
						style={{
							color: 'var(--fgColor-muted)',
							display: 'block',
						}}
					>
						Link templates
					</Text>
				</div>
			</header>

			{config && (
				<SettingsSection title="Copied link text">
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
				</SettingsSection>
			)}

			<FooterActions
				viewMode={viewMode}
				flushAll={flushAll}
				cancelAll={cancelAll}
				applyStored={applyStored}
			/>
		</main>
	);
}
