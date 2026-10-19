import { Text, ToggleSwitch } from '@primer/react';
import { ConfigModel } from '@shared/models';
import { configService } from '@shared/services';
import { useId, useState } from 'react';

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
	const avatarsLabelId = useId();
	const avatarsCaptionId = useId();

	const [authorAvatars, setAuthorAvatars] = useOptimisticToggle(
		config.display.authorAvatars,
		(value) => configService.setDisplay({ authorAvatars: value }),
		() => setSaveError('Could not save. Try again.')
	);

	const handleAvatarsChange = (value: boolean): void => {
		setSaveError(null);
		setAuthorAvatars(value);
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
					Share templates and shortcuts with your team as a JSON file.
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
