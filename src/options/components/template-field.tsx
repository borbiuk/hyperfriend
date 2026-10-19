import { CheckIcon, Icon } from '@primer/octicons-react';
import { FormControl, Text, TextInput, Token } from '@primer/react';
import {
	DEFAULT_CONFIG,
	MAX_TEMPLATE_LENGTH,
	TEMPLATE_PLACEHOLDERS,
} from '@shared/constants';
import { LinkTargetModel, LinkType } from '@shared/models';
import { buildLinkPayload, configService } from '@shared/services';
import { useCallback, useEffect, useRef, useState } from 'react';

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
	/** Octicon shown before the label, like in the GitHub repository tabs. */
	icon: Icon;
	/** Template currently stored in the config. */
	value: string;
	/** Sample item used for the live preview. */
	sample: LinkTargetModel;
	/** Increments every time the settings are replaced from outside (reset, import). */
	syncEpoch: number;
	/** Registers this field's save controls with the parent. Returns an unregister function. */
	registerField: (controls: FieldControls) => () => void;
}

/**
 * One template setting: input with autosave, placeholder hints and a live preview.
 */
export function TemplateField({
	type,
	label,
	icon: LabelIcon,
	value,
	sample,
	syncEpoch,
	registerField,
}: TemplateFieldProps) {
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

	/** Writes the unsaved text to storage right away (the call starts synchronously). */
	const flush = useCallback((): void => {
		window.clearTimeout(saveTimer.current);
		if (unsaved.current === null) {
			return;
		}

		const text = unsaved.current;
		const current = revision.current;
		unsaved.current = null;

		const save = configService
			.setTemplate(type, text)
			.then(() => {
				setSaved(true);
				window.clearTimeout(savedTimer.current);
				savedTimer.current = window.setTimeout(
					() => setSaved(false),
					SAVED_VISIBLE_MS
				);
			})
			.catch(() => {
				setError('Could not save. Try again.');
			})
			.finally(() => {
				// A newer change may have been typed while this save was in flight.
				if (current === revision.current) {
					pending.current = false;
				}
				if (inFlight.current === save) {
					inFlight.current = null;
				}
			});
		inFlight.current = save;
	}, [type]);

	// Do not lose the last edit when the popup closes right after typing.
	useEffect(() => {
		const handleVisibility = (): void => {
			if (document.visibilityState === 'hidden') {
				flush();
			}
		};

		window.addEventListener('pagehide', flush);
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			window.removeEventListener('pagehide', flush);
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

	const handleChange = (next: string): void => {
		setDraft(next);
		setSaved(false);
		setError(null);
		pending.current = true;
		revision.current++;
		unsaved.current = next;

		window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(flush, SAVE_DELAY_MS);
	};

	const preview = buildLinkPayload(sample, {
		...DEFAULT_CONFIG,
		templates: { ...DEFAULT_CONFIG.templates, [type]: draft },
	}).text;
	const inputId = `template-${type}`;

	return (
		<FormControl id={inputId}>
			<FormControl.Label>
				<span
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 8,
					}}
				>
					<LabelIcon
						size={16}
						aria-hidden="true"
						fill="var(--fgColor-muted)"
					/>
					{label}
				</span>
			</FormControl.Label>
			<TextInput
				block
				monospace
				size="small"
				value={draft}
				// Longer templates could be exported but not imported again.
				maxLength={MAX_TEMPLATE_LENGTH}
				onChange={(event) => handleChange(event.target.value)}
				onBlur={flush}
				spellCheck={false}
				autoComplete="off"
			/>
			<FormControl.Caption>
				<span
					style={{
						display: 'flex',
						flexWrap: 'wrap',
						gap: 4,
						alignItems: 'center',
					}}
				>
					<span>Available:</span>
					{TEMPLATE_PLACEHOLDERS[type].map((name) => (
						<Token key={name} text={`{{${name}}}`} size="small" />
					))}
				</span>
			</FormControl.Caption>
			{error && (
				<FormControl.Validation variant="error">
					{error}
				</FormControl.Validation>
			)}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'baseline',
					gap: 8,
					marginTop: 8,
				}}
			>
				<Text
					size="small"
					style={{
						color: 'var(--fgColor-accent)',
						textDecoration: 'underline',
						overflowWrap: 'anywhere',
						minWidth: 0,
					}}
				>
					{preview}
				</Text>
				<Text
					size="small"
					style={{
						color: 'var(--fgColor-muted)',
						flexShrink: 0,
						visibility: saved ? 'visible' : 'hidden',
					}}
					aria-live="polite"
				>
					<CheckIcon size={12} /> Saved
				</Text>
			</div>
		</FormControl>
	);
}
