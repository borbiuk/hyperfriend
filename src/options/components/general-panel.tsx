import {
	FormControl,
	Radio,
	RadioGroup,
	Text,
	ToggleSwitch,
} from '@primer/react';
import { ConfigModel, LinkFormat } from '@shared/models';
import { configService } from '@shared/services';
import { useEffect, useId, useRef, useState } from 'react';

import { useOptimisticToggle } from '../hooks/use-optimistic-toggle';
import { ViewMode } from '../hooks/use-view-mode';

import { SettingsActions } from './settings-actions';
import { SettingsSection } from './settings-section';

interface GeneralPanelProps {
	config: ConfigModel;
	/** `null` until the view is detected; transfer buttons stay disabled until then. */
	viewMode: ViewMode | null;
	/** Writes all pending field edits and waits for the writes. */
	flushAll: () => Promise<void>;
	/** Drops all pending field edits (before the settings are replaced). */
	cancelAll: () => Promise<void>;
	/** Re-reads the config and makes every tab show it. */
	applyStored: () => Promise<void>;
}

/**
 * Content of the General tab: display preferences and the settings file actions.
 */
export function GeneralPanel({
	config,
	viewMode,
	flushAll,
	cancelAll,
	applyStored,
}: GeneralPanelProps) {
	const [saveError, setSaveError] = useState<string | null>(null);
	const [format, setFormat] = useState(config.format);
	const [formatError, setFormatError] = useState<string | null>(null);
	/** Saves of the format that are still in flight; storage updates are followed only without any. */
	const pendingFormat = useRef(0);
	const storedFormat = useRef(config.format);
	storedFormat.current = config.format;
	const avatarsLabelId = useId();
	const avatarsCaptionId = useId();

	const [authorAvatars, setAuthorAvatars] = useOptimisticToggle(
		config.display.authorAvatars,
		(value) => configService.setDisplay({ authorAvatars: value }),
		() => setSaveError('Could not save. Try again.')
	);

	useEffect(() => {
		if (pendingFormat.current === 0) {
			setFormat(config.format);
		}
	}, [config.format]);

	const handleFormatChange = (next: LinkFormat): void => {
		setFormatError(null);
		setFormat(next);
		pendingFormat.current++;
		configService
			.setFormat(next)
			.catch(() => {
				setFormat(storedFormat.current);
				setFormatError('Could not save. Try again.');
			})
			.finally(() => {
				pendingFormat.current--;
			});
	};

	const handleAvatarsChange = (value: boolean): void => {
		setSaveError(null);
		setAuthorAvatars(value);
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<SettingsSection title="Copy format">
				<RadioGroup
					name="copy-format"
					onChange={(value) => {
						if (value) {
							handleFormatChange(value as LinkFormat);
						}
					}}
				>
					<RadioGroup.Label visuallyHidden>
						Copy format
					</RadioGroup.Label>
					<FormControl>
						<Radio
							value={LinkFormat.Rich}
							checked={format === LinkFormat.Rich}
						/>
						<FormControl.Label>Rich link</FormControl.Label>
						<FormControl.Caption>
							A clickable link for Teams, Slack and other chats
						</FormControl.Caption>
					</FormControl>
					<FormControl>
						<Radio
							value={LinkFormat.Markdown}
							checked={format === LinkFormat.Markdown}
						/>
						<FormControl.Label>Markdown</FormControl.Label>
						<FormControl.Caption>
							Plain text like [PR 12](https://github.com/…) for
							GitHub, Notion and docs
						</FormControl.Caption>
					</FormControl>
				</RadioGroup>
				<Text
					size="small"
					role="alert"
					style={{
						display: 'block',
						color: 'var(--fgColor-danger)',
					}}
				>
					{formatError ?? ''}
				</Text>
			</SettingsSection>

			<div
				role="presentation"
				style={{ borderTop: '1px solid var(--borderColor-muted)' }}
			/>

			<SettingsSection title="Display">
				<div>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 8,
						}}
					>
						<div style={{ flex: 1, minWidth: 0 }}>
							<Text
								id={avatarsLabelId}
								weight="semibold"
								size="medium"
								style={{ display: 'block' }}
							>
								Show author avatars
							</Text>
							<Text
								id={avatarsCaptionId}
								size="small"
								style={{
									display: 'block',
									color: 'var(--fgColor-muted)',
								}}
							>
								In pull request lists
							</Text>
						</div>
						<ToggleSwitch
							size="small"
							aria-labelledby={avatarsLabelId}
							aria-describedby={avatarsCaptionId}
							checked={authorAvatars}
							onChange={handleAvatarsChange}
						/>
					</div>
					<Text
						size="small"
						role="alert"
						style={{
							display: 'block',
							color: 'var(--fgColor-danger)',
						}}
					>
						{saveError ?? ''}
					</Text>
				</div>
			</SettingsSection>

			<div
				role="presentation"
				style={{ borderTop: '1px solid var(--borderColor-muted)' }}
			/>

			<SettingsSection title="Settings">
				<Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
					Share templates, copy format and shortcuts with your team as
					a JSON file.
				</Text>
				<SettingsActions
					viewMode={viewMode}
					flushAll={flushAll}
					cancelAll={cancelAll}
					applyStored={applyStored}
				/>
			</SettingsSection>
		</div>
	);
}
