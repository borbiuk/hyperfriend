import { ChevronLeftIcon, TrashIcon } from '@primer/octicons-react';
import { Button, Text, TextInput } from '@primer/react';
import {
	CHIP_COLOURS,
	CUSTOM_CHIP_ICONS,
	MAX_CUSTOM_LABEL_LENGTH,
	MAX_CUSTOM_QUERY_LENGTH,
} from '@shared/constants';
import { ChipColour, CustomChipModel } from '@shared/models';
import { parseCustomLabel, parseCustomQuery } from '@shared/utils';
import { Ref, useEffect, useId, useRef, useState } from 'react';

import '../styles/filters.css';

import { ChipIcon } from './chip-icon';

/** What the editor hands back: a chip without the id the parent gives a new chip. */
export type CustomChipDraft = Omit<CustomChipModel, 'id'>;

interface FilterChipEditorProps {
	/** The chip to edit, or `null` for a new one */
	chip: CustomChipModel | null;

	/** The view is shown: the name field takes the focus */
	active: boolean;

	/** A write of this editor is in flight: Save and Delete wait for it */
	saving: boolean;

	/** Error of the last save, shown under the buttons */
	saveError: string | null;

	/** Ref of the back button, so the parent can move the focus back */
	backRef: Ref<HTMLButtonElement>;

	onSave: (draft: CustomChipDraft) => void;
	onDelete: () => void;
	onBack: () => void;
}

/** Ideas shown under the filter field. */
const EXAMPLES = ['label:bug -label:wip', 'base:main', 'reviewed-by:@me'];

/**
 * The screen to make or change a custom chip: name, icon, colour and filter, with a preview of
 * the chip. The filter is GitHub search words; only their shape is checked here.
 */
export function FilterChipEditor({
	chip,
	active,
	saving,
	saveError,
	backRef,
	onSave,
	onDelete,
	onBack,
}: FilterChipEditorProps) {
	const [label, setLabel] = useState(chip?.label ?? '');
	const [icon, setIcon] = useState(chip?.icon ?? CUSTOM_CHIP_ICONS[0]);
	const [colour, setColour] = useState<ChipColour>(chip?.colour ?? 'default');
	const [query, setQuery] = useState(chip?.query ?? '');
	const [labelError, setLabelError] = useState<string | null>(null);
	const [queryError, setQueryError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const nameRef = useRef<HTMLInputElement>(null);
	const nameId = useId();
	const queryId = useId();
	const queryHintId = useId();
	const queryErrorId = useId();

	useEffect(() => {
		if (active) {
			nameRef.current?.focus();
		}
	}, [active]);

	const save = (): void => {
		if (saving) {
			return;
		}

		const name = parseCustomLabel(label);
		const parsed = parseCustomQuery(query);
		setLabelError(
			name
				? null
				: `Enter a name of up to ${MAX_CUSTOM_LABEL_LENGTH} characters (non-English letters count more).`
		);
		setQueryError(parsed.ok ? null : parsed.error);
		if (!name || !parsed.ok) {
			return;
		}

		onSave({ label: name, icon, colour, query: parsed.query });
	};

	return (
		<div className="hyperfriend-chip-editor">
			<div className="hyperfriend-chip-editor__header">
				<Button
					ref={backRef}
					variant="invisible"
					size="small"
					leadingVisual={ChevronLeftIcon}
					onClick={onBack}
				>
					Filters
				</Button>
				<Text as="h2" weight="semibold" size="medium">
					{chip ? 'Edit chip' : 'New chip'}
				</Text>
			</div>

			<div className="hyperfriend-chip-editor__field">
				<label htmlFor={nameId}>
					<Text size="small" weight="semibold">
						Name
					</Text>
				</label>
				<TextInput
					id={nameId}
					ref={nameRef}
					block
					size="small"
					value={label}
					maxLength={MAX_CUSTOM_LABEL_LENGTH}
					aria-invalid={labelError ? true : undefined}
					onChange={(event) => setLabel(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							save();
						}
					}}
				/>
				{labelError && (
					<Text
						size="small"
						role="alert"
						style={{
							display: 'block',
							color: 'var(--fgColor-danger)',
						}}
					>
						{labelError}
					</Text>
				)}
			</div>

			<div className="hyperfriend-chip-editor__field">
				<Text size="small" weight="semibold">
					Icon
				</Text>
				<div
					role="radiogroup"
					aria-label="Icon"
					className="hyperfriend-chip-editor__icons"
				>
					{CUSTOM_CHIP_ICONS.map((name) => (
						<label
							key={name}
							className="hyperfriend-chip-editor__option"
						>
							<input
								type="radio"
								name="chip-icon"
								value={name}
								aria-label={name.replaceAll('-', ' ')}
								checked={icon === name}
								onChange={() => setIcon(name)}
							/>
							<ChipIcon name={name} colour={colour} />
						</label>
					))}
				</div>
			</div>

			<div className="hyperfriend-chip-editor__field">
				<Text size="small" weight="semibold">
					Colour
				</Text>
				<div
					role="radiogroup"
					aria-label="Colour"
					className="hyperfriend-chip-editor__colours"
				>
					{CHIP_COLOURS.map((name) => (
						<label
							key={name}
							className="hyperfriend-chip-editor__option"
						>
							<input
								type="radio"
								name="chip-colour"
								value={name}
								aria-label={name}
								checked={colour === name}
								onChange={() => setColour(name)}
							/>
							<span
								className="hyperfriend-chip-editor__swatch"
								data-colour={name}
								aria-hidden="true"
							/>
						</label>
					))}
				</div>
			</div>

			<div className="hyperfriend-chip-editor__field">
				<label htmlFor={queryId}>
					<Text size="small" weight="semibold">
						Filter
					</Text>
				</label>
				<TextInput
					id={queryId}
					block
					size="small"
					value={query}
					maxLength={MAX_CUSTOM_QUERY_LENGTH}
					placeholder={EXAMPLES[0]}
					spellCheck={false}
					autoComplete="off"
					aria-describedby={
						queryError
							? `${queryHintId} ${queryErrorId}`
							: queryHintId
					}
					aria-invalid={queryError ? true : undefined}
					style={{ fontFamily: 'var(--fontStack-monospace)' }}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							save();
						}
					}}
				/>
				<Text
					id={queryHintId}
					size="small"
					style={{ display: 'block', color: 'var(--fgColor-muted)' }}
				>
					GitHub search words, e.g. {EXAMPLES[0]} or {EXAMPLES[1]}.
				</Text>
				{queryError && (
					<Text
						id={queryErrorId}
						size="small"
						role="alert"
						style={{
							display: 'block',
							color: 'var(--fgColor-danger)',
						}}
					>
						{queryError}
					</Text>
				)}
			</div>

			<div className="hyperfriend-chip-editor__footer">
				<span
					className="hyperfriend-chip-preview"
					data-colour={colour === 'default' ? undefined : colour}
				>
					<ChipIcon name={icon} colour={colour} />
					<span>{label.trim() || 'Chip'}</span>
				</span>
				{confirmingDelete ? (
					<span className="hyperfriend-chip-editor__actions">
						<Text size="small">Delete this chip?</Text>
						<Button
							size="small"
							onClick={() => setConfirmingDelete(false)}
						>
							Keep
						</Button>
						<Button
							variant="danger"
							size="small"
							disabled={saving}
							onClick={onDelete}
						>
							Yes, delete
						</Button>
					</span>
				) : (
					<span className="hyperfriend-chip-editor__actions">
						{chip && (
							<Button
								variant="danger"
								size="small"
								leadingVisual={TrashIcon}
								disabled={saving}
								onClick={() => setConfirmingDelete(true)}
							>
								Delete
							</Button>
						)}
						<Button
							variant="primary"
							size="small"
							disabled={saving}
							onClick={save}
						>
							Save
						</Button>
					</span>
				)}
			</div>
			{saveError && (
				<Text
					size="small"
					role="alert"
					style={{ display: 'block', color: 'var(--fgColor-danger)' }}
				>
					{saveError}
				</Text>
			)}
		</div>
	);
}
