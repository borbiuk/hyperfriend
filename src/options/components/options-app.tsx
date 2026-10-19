import { GitPullRequestIcon, IssueOpenedIcon } from '@primer/octicons-react';
import { Button, Heading, Link, Text } from '@primer/react';
import { LinkTargetModel, LinkType } from '@shared/models';
import { configService } from '@shared/services';
import { useCallback, useRef, useState } from 'react';

import { useConfig } from '../hooks/use-config';

import { SettingsSection } from './settings-section';
import { TemplateField } from './template-field';

const REPOSITORY_URL = 'https://github.com/borbiuk/hyperfriend';

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
	const config = useConfig();
	const [resetEpoch, setResetEpoch] = useState(0);
	const [resetError, setResetError] = useState(false);
	const cancels = useRef(new Set<() => Promise<void>>());

	const registerCancel = useCallback(
		(cancel: () => Promise<void>): (() => void) => {
			cancels.current.add(cancel);
			return () => {
				cancels.current.delete(cancel);
			};
		},
		[]
	);

	const handleReset = async (): Promise<void> => {
		setResetError(false);
		try {
			// Pending saves must not overwrite the defaults afterwards.
			await Promise.all([...cancels.current].map((cancel) => cancel()));
			await configService.reset();
			setResetEpoch((epoch) => epoch + 1);
		} catch {
			setResetError(true);
		}
	};

	return (
		<main
			style={{
				boxSizing: 'border-box',
				width: 400,
				minHeight: 120,
				padding: 16,
				display: 'flex',
				flexDirection: 'column',
				gap: 16,
				backgroundColor: 'var(--bgColor-default)',
				color: 'var(--fgColor-default)',
			}}
		>
			<header>
				<Heading as="h1" variant="small">
					Hyperfriend
				</Heading>
				<Text
					size="small"
					style={{ color: 'var(--fgColor-muted)', display: 'block' }}
				>
					Link templates
				</Text>
			</header>

			{config && (
				<SettingsSection title="Copied link text">
					<TemplateField
						type={LinkType.PullRequest}
						label="Pull Request link template"
						icon={GitPullRequestIcon}
						value={config.templates[LinkType.PullRequest]}
						sample={SAMPLE_PULL_REQUEST}
						resetEpoch={resetEpoch}
						registerCancel={registerCancel}
					/>
					<TemplateField
						type={LinkType.Issue}
						label="Issue link template"
						icon={IssueOpenedIcon}
						value={config.templates[LinkType.Issue]}
						sample={SAMPLE_ISSUE}
						resetEpoch={resetEpoch}
						registerCancel={registerCancel}
					/>
				</SettingsSection>
			)}

			<footer
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
				}}
			>
				<Button size="small" onClick={handleReset}>
					Reset to defaults
				</Button>
				{resetError && (
					<Text
						size="small"
						style={{ color: 'var(--fgColor-danger)' }}
						role="alert"
					>
						Could not reset.
					</Text>
				)}
				<Link
					href={REPOSITORY_URL}
					target="_blank"
					rel="noreferrer"
					style={{ fontSize: 12 }}
				>
					GitHub
				</Link>
			</footer>
		</main>
	);
}
