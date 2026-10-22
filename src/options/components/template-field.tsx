import { AlertIcon, CheckIcon } from '@primer/octicons-react';
import {
	ActionList,
	ActionMenu,
	Button,
	Text,
	VisuallyHidden,
} from '@primer/react';
import {
	DEFAULT_CONFIG,
	MAX_TEMPLATE_LENGTH,
	TEMPLATE_PLACEHOLDERS,
} from '@shared/constants';
import { LinkFormat, LinkTargetModel, LinkType } from '@shared/models';
import {
	buildLinkPayload,
	configService,
	toSingleLineTemplate,
} from '@shared/services';
import { useCallback, useEffect, useRef, useState } from 'react';

import '../styles/templates.css';
import {
	groupPlaceholders,
	QUICK_PLACEHOLDERS,
} from '../utils/template-tokens';

import { TokenEditor, TokenEditorHandle } from './token-editor';

/** Delay before a change is written to storage. */
const SAVE_DELAY_MS = 300;

/** How long the "Saved" status stays visible. */
const SAVED_VISIBLE_MS = 2000;

/** Lets the parent flush or drop the field's pending save. */
export interface FieldControls {
	/** Writes the unsaved text now and waits until the write is finished. */
	flush: () => Promise<void>;
	/** Drops the unsaved text and waits for a save already in flight. */
	cancel: () => Promise<void>;
}

interface TemplateFieldProps {
	type: LinkType;
	label: string;
	/** False for the fields of the link types that are not selected: they stay mounted but hidden. */
	active: boolean;
	/** Template currently stored in the config. */
	value: string;
	/** Sample item used for the live preview. */
	sample: LinkTargetModel;
	/** Copy format; the preview shows what is pasted in it. */
	format: LinkFormat;
	/** Increments every time the settings are replaced from outside (reset, import). */
	syncEpoch: number;
	/** Registers this field's save controls with the parent. Returns an unregister function. */
	registerField: (controls: FieldControls) => () => void;
}

/**
 * One template setting: editor with autosave, placeholder buttons and a live preview.
 */
export function TemplateField({
	type,
	label,
	active,
	value,
	sample,
	format,
	syncEpoch,
	registerField,
}: TemplateFieldProps) {
	const editor = useRef<TokenEditorHandle>(null);
	const [draft, setDraft] = useState(value);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);
	/** True while the user has unsaved or in-flight changes. */
	const pending = useRef(false);
	const revision = useRef(0);
	/** Latest text that has not been sent to storage yet. */
	const unsaved = useRef<string | null>(null);
	const inFlight = useRef<Promise<void> | null>(null);
	const saveTimer = useRef<number>(0);
	const savedTimer = useRef<number>(0);

	const valueRef = useRef(value);
	valueRef.current = value;

	// Follow storage updates, but never clobber what the user is typing.
	useEffect(() => {
		if (!pending.current) {
			setDraft(value);
		}
	}, [value]);

	/**
	 * Writes the unsaved text to storage right away.
	 *
	 * @param closing - The page is about to close: skip the storage read, so the write is sent
	 *   before the page is torn down.
	 */
	const flush = useCallback(
		(closing = false): void => {
			window.clearTimeout(saveTimer.current);
			if (unsaved.current === null) {
				return;
			}

			const text = unsaved.current;
			const current = revision.current;
			unsaved.current = null;

			const write = closing
				? configService.setTemplateBeforeClose(type, text)
				: configService.setTemplate(type, text);
			const save = write
				.then(() => {
					setSaved(true);
					window.clearTimeout(savedTimer.current);
					savedTimer.current = window.setTimeout(
						() => setSaved(false),
						SAVED_VISIBLE_MS
					);
				})
				.catch(() => {
					// Keep the text, so the next blur, pagehide or export tries again
					// (unless a newer edit or a reset replaced it meanwhile).
					if (
						current === revision.current &&
						unsaved.current === null
					) {
						unsaved.current = text;
					}
					setError('Could not save. Your text is kept.');
				})
				.finally(() => {
					// A newer change may have been typed while this save was in flight.
					if (
						current === revision.current &&
						unsaved.current === null
					) {
						pending.current = false;
					}
					if (inFlight.current === save) {
						inFlight.current = null;
					}
				});
			inFlight.current = save;
		},
		[type]
	);

	// Do not lose the last edit when the popup closes right after typing.
	useEffect(() => {
		const handlePageHide = (): void => {
			flush(true);
		};
		const handleVisibility = (): void => {
			if (document.visibilityState === 'hidden') {
				flush(true);
			}
		};

		window.addEventListener('pagehide', handlePageHide);
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			window.removeEventListener('pagehide', handlePageHide);
			document.removeEventListener('visibilitychange', handleVisibility);
			flush();
			window.clearTimeout(savedTimer.current);
		};
	}, [flush]);

	// Lets the parent flush or drop this field's pending save (export, reset, import).
	useEffect(() => {
		return registerField({
			flush: async () => {
				flush();
				await inFlight.current;
			},
			cancel: async () => {
				window.clearTimeout(saveTimer.current);
				unsaved.current = null;
				revision.current++;
				pending.current = false;
				await inFlight.current;
			},
		});
	}, [registerField, flush]);

	// Show the stored value after the settings were replaced from outside.
	useEffect(() => {
		if (syncEpoch === 0) {
			return;
		}

		setDraft(valueRef.current);
		setSaved(false);
		setError(null);
	}, [syncEpoch]);

	const handleChange = (input: string): void => {
		// A pasted tab would make the exported settings file fail to import
		const next = toSingleLineTemplate(input);
		setDraft(next);
		setSaved(false);
		setError(null);
		pending.current = true;
		revision.current++;
		unsaved.current = next;

		window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => flush(), SAVE_DELAY_MS);
	};

	// Same split as the pasted link: only `parts.link` is the hyperlink.
	const payload = buildLinkPayload(sample, {
		...DEFAULT_CONFIG,
		format,
		templates: { ...DEFAULT_CONFIG.templates, [type]: draft },
	});
	const preview = payload.parts;
	const baseId = `template-${type}`;
	const labelId = `${baseId}-label`;
	const hintId = `${baseId}-hint`;
	const errorId = `${baseId}-error`;
	const describedBy = [error ? errorId : null, hintId]
		.filter(Boolean)
		.join(' ');
	const groups = groupPlaceholders(TEMPLATE_PLACEHOLDERS[type]);
	const isDefault = draft === DEFAULT_CONFIG.templates[type];

	const insert = (name: string): void => {
		editor.current?.insert(`{{${name}}}`);
	};

	const retry = (): void => {
		setError(null);
		flush();
	};

	return (
		<div
			className="hyperfriend-field"
			data-inactive={active ? undefined : ''}
		>
			<div>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						gap: 8,
						minHeight: 28,
					}}
				>
					<Text
						id={labelId}
						size="small"
						weight="semibold"
						style={{ color: 'var(--fgColor-muted)' }}
					>
						{label}
					</Text>
					<span
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 8,
						}}
					>
						{!isDefault && (
							<Button
								variant="invisible"
								size="small"
								onClick={() =>
									handleChange(DEFAULT_CONFIG.templates[type])
								}
							>
								Reset to default
							</Button>
						)}
						{/* Hidden with `visibility` to keep its space; the status region below announces it */}
						<Text
							size="small"
							style={{
								color: 'var(--fgColor-success)',
								visibility: saved ? 'visible' : 'hidden',
							}}
							aria-hidden="true"
						>
							<CheckIcon size={12} /> Saved
						</Text>
					</span>
				</div>
				<TokenEditor
					ref={editor}
					type={type}
					value={draft}
					// Longer templates could be exported but not imported again.
					maxLength={MAX_TEMPLATE_LENGTH}
					labelId={labelId}
					describedBy={describedBy}
					invalid={error !== null}
					placeholder="Type text and insert placeholders"
					onChange={handleChange}
					onBlur={() => flush()}
				/>
				<Text
					id={hintId}
					as="div"
					size="small"
					style={{ color: 'var(--fgColor-muted)', marginTop: 6 }}
				>
					Text inside [brackets] becomes the link.
				</Text>
				{error && (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							marginTop: 6,
							padding: '4px 8px',
							borderRadius: 6,
							backgroundColor: 'var(--bgColor-danger-muted)',
							color: 'var(--fgColor-danger)',
							fontSize: 12,
						}}
					>
						<AlertIcon size={14} />
						<span id={errorId}>{error}</span>
						<Button
							variant="invisible"
							size="small"
							style={{ marginLeft: 'auto' }}
							onClick={retry}
						>
							Try again
						</Button>
					</div>
				)}
			</div>

			<div>
				<Text
					as="div"
					size="small"
					weight="semibold"
					style={{ color: 'var(--fgColor-muted)', marginBottom: 6 }}
				>
					Insert placeholder
				</Text>
				<div
					style={{
						display: 'flex',
						flexWrap: 'wrap',
						alignItems: 'center',
						gap: 6,
					}}
				>
					{QUICK_PLACEHOLDERS[type].map((name) => (
						<button
							key={name}
							type="button"
							className="hyperfriend-chip"
							// Keep the caret in the editor
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => insert(name)}
						>
							{`{{${name}}}`}
						</button>
					))}
					<ActionMenu>
						<ActionMenu.Button size="small" variant="invisible">
							All placeholders
						</ActionMenu.Button>
						<ActionMenu.Overlay width="medium" maxHeight="medium">
							<ActionList>
								{groups.map((group) => (
									<ActionList.Group key={group.title}>
										<ActionList.GroupHeading>
											{group.title}
										</ActionList.GroupHeading>
										{group.names.map((name) => (
											<ActionList.Item
												key={name}
												// The menu gives the focus back to its button after this
												onSelect={() =>
													window.setTimeout(
														() => insert(name),
														0
													)
												}
											>
												<span
													style={{
														fontFamily:
															'var(--fontStack-monospace)',
														fontSize: 12,
													}}
												>
													{`{{${name}}}`}
												</span>
											</ActionList.Item>
										))}
									</ActionList.Group>
								))}
							</ActionList>
							<Text
								as="div"
								size="small"
								style={{
									color: 'var(--fgColor-muted)',
									padding: '4px 16px 8px',
								}}
							>
								Details such as labels and branches are filled
								only where the page shows them.
							</Text>
						</ActionMenu.Overlay>
					</ActionMenu>
				</div>
			</div>

			<div>
				<Text
					as="div"
					size="small"
					weight="semibold"
					style={{ color: 'var(--fgColor-muted)', marginBottom: 6 }}
				>
					You will paste
				</Text>
				<div
					style={{
						padding: 12,
						border: '1px solid var(--borderColor-default)',
						borderRadius: 6,
						backgroundColor: 'var(--bgColor-muted)',
					}}
				>
					<Text style={{ overflowWrap: 'anywhere' }}>
						<VisuallyHidden>Preview: </VisuallyHidden>
						{format === LinkFormat.Markdown ? (
							// Markdown is pasted as source text: no link to underline
							payload.markdown
						) : (
							<>
								{preview.before}
								<span
									style={{
										color: 'var(--fgColor-accent)',
										textDecoration: 'underline',
									}}
								>
									{preview.link}
								</span>
								{/* The styling alone does not tell screen reader users which part is the link. */}
								{preview.link && (
									<VisuallyHidden> (link)</VisuallyHidden>
								)}
								{preview.after}
							</>
						)}
					</Text>
				</div>
				<Text
					as="div"
					size="small"
					style={{ color: 'var(--fgColor-muted)', marginTop: 6 }}
				>
					{format === LinkFormat.Markdown
						? 'Pasted as Markdown.'
						: 'Pasted as a rich link.'}{' '}
					Change the format in the General tab.
				</Text>
			</div>

			{/* Always mounted, so screen readers announce the text when it changes */}
			<VisuallyHidden role="status">
				{saved ? `${label} saved` : ''}
			</VisuallyHidden>
			<VisuallyHidden role="alert">{error ?? ''}</VisuallyHidden>
		</div>
	);
}
