import { ChevronRightIcon } from '@primer/octicons-react';
import { Text, ToggleSwitch, VisuallyHidden } from '@primer/react';
import { ConfigModel, LinkFormat } from '@shared/models';
import { buildLinkPayload, configService } from '@shared/services';
import { useEffect, useId, useRef, useState } from 'react';

import { useOptimisticToggle } from '../hooks/use-optimistic-toggle';
import { ViewMode } from '../hooks/use-view-mode';
import '../styles/general.css';
import '../styles/templates.css';

import { EnterpriseSection } from './enterprise-section';
import { SettingsActions } from './settings-actions';
import { SettingsSection } from './settings-section';
import { SAMPLE_PULL_REQUEST } from './templates-panel';

/** The copy formats in display order, with what each one is for. */
const FORMATS: { value: LinkFormat; label: string; caption: string }[] = [
	{
		value: LinkFormat.Rich,
		label: 'Rich link',
		caption: 'A clickable link for Teams, Slack and other chats.',
	},
	{
		value: LinkFormat.Markdown,
		label: 'Markdown',
		caption: 'Plain text for GitHub, Notion and docs.',
	},
];

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
	const formatLabelId = useId();
	const [view, setView] = useState<'main' | 'enterprise'>('main');
	/** `null` until the list of added domains is read. */
	const [hostCount, setHostCount] = useState<number | null>(null);
	const enterpriseRow = useRef<HTMLButtonElement>(null);
	const enterpriseBack = useRef<HTMLButtonElement>(null);
	const viewChanged = useRef(false);

	// Move the focus with the view (not on the first render)
	useEffect(() => {
		if (!viewChanged.current) {
			viewChanged.current = true;
			return;
		}

		(view === 'enterprise'
			? enterpriseBack
			: enterpriseRow
		).current?.focus();
	}, [view]);

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

	const formatCaption = FORMATS.find(
		(item) => item.value === format
	)?.caption;
	// The preview uses the user's own Pull Request template, so it shows what is really pasted.
	const payload = buildLinkPayload(SAMPLE_PULL_REQUEST, {
		...config,
		format,
	});
	const preview = payload.parts;

	return (
		<div className="hyperfriend-views">
			<div
				className="hyperfriend-view"
				data-inactive={view === 'main' ? undefined : ''}
			>
				<SettingsSection title="Copy format" id={formatLabelId}>
					<div
						role="radiogroup"
						aria-labelledby={formatLabelId}
						className="hyperfriend-switch hyperfriend-switch--equal"
					>
						{FORMATS.map((item) => (
							<label
								key={item.value}
								className="hyperfriend-switch__item"
							>
								<input
									type="radio"
									name="copy-format"
									value={item.value}
									checked={format === item.value}
									onChange={() =>
										handleFormatChange(item.value)
									}
								/>
								{item.label}
							</label>
						))}
					</div>
					<Text
						size="small"
						style={{ color: 'var(--fgColor-muted)' }}
					>
						{formatCaption}
					</Text>
					<div
						style={{
							padding: '10px 12px',
							border: '1px solid var(--borderColor-default)',
							borderRadius: 6,
							backgroundColor: 'var(--bgColor-muted)',
							overflowWrap: 'anywhere',
						}}
					>
						{format === LinkFormat.Markdown ? (
							// Markdown is pasted as source text: no link to underline
							<Text
								size="small"
								style={{
									fontFamily: 'var(--fontStack-monospace)',
								}}
							>
								<VisuallyHidden>Pasted text: </VisuallyHidden>
								{payload.markdown}
							</Text>
						) : (
							<Text>
								<VisuallyHidden>Pasted text: </VisuallyHidden>
								{preview.before}
								<span
									style={{
										color: 'var(--fgColor-accent)',
										textDecoration: 'underline',
									}}
								>
									{preview.link}
								</span>
								{preview.link && (
									<VisuallyHidden> (link)</VisuallyHidden>
								)}
								{preview.after}
							</Text>
						)}
					</div>
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

				<SettingsSection title="Options">
					<div className="hyperfriend-group">
						<div className="hyperfriend-row">
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
				</SettingsSection>

				{/* The row names itself, so it needs no heading (the popup must stay short) */}
				<div className="hyperfriend-group">
					<button
						ref={enterpriseRow}
						type="button"
						className="hyperfriend-row"
						onClick={() => setView('enterprise')}
					>
						<span style={{ flex: 1, minWidth: 0 }}>
							<Text
								weight="semibold"
								size="medium"
								style={{ display: 'block' }}
							>
								Enterprise Server domains
							</Text>
							<Text
								size="small"
								style={{
									display: 'block',
									color: 'var(--fgColor-muted)',
								}}
							>
								*.ghe.com works without setup
							</Text>
						</span>
						<Text
							size="small"
							style={{ color: 'var(--fgColor-muted)' }}
						>
							{hostCount === null
								? ''
								: hostCount === 0
									? 'None added'
									: `${hostCount} added`}
						</Text>
						<ChevronRightIcon
							size={16}
							fill="var(--fgColor-muted)"
						/>
					</button>
				</div>

				<SettingsActions
					viewMode={viewMode}
					flushAll={flushAll}
					cancelAll={cancelAll}
					applyStored={applyStored}
				/>
			</div>

			{/* Stays mounted, so the domains (and the count above) are known before it is opened */}
			<div
				className="hyperfriend-view"
				data-inactive={view === 'enterprise' ? undefined : ''}
			>
				<EnterpriseSection
					viewMode={viewMode}
					onBack={() => setView('main')}
					backRef={enterpriseBack}
					onHostsChange={setHostCount}
				/>
			</div>
		</div>
	);
}
