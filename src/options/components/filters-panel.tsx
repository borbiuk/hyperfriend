import { PlusIcon } from '@primer/octicons-react';
import { Button, Text, ToggleSwitch } from '@primer/react';
import { MAX_CUSTOM_CHIPS } from '@shared/constants';
import { ConfigModel, CustomChipModel } from '@shared/models';
import { ConfigTooLargeError, configService } from '@shared/services';
import { useEffect, useId, useRef, useState } from 'react';

import { useOptimisticToggle } from '../hooks/use-optimistic-toggle';
import '../styles/filters.css';
import '../styles/general.css';

import { CustomChipDraft, FilterChipEditor } from './filter-chip-editor';
import { FilterChipList } from './filter-chip-list';
import { SettingsSection } from './settings-section';

interface FiltersPanelProps {
	config: ConfigModel;
}

/** What the user is told when the browser would refuse the settings for their size. */
const TOO_LARGE_MESSAGE =
	'These settings are too large for the browser to sync (8 KB). Shorten a name, a filter or a template.';

/** The id of a new custom chip: `custom-` and 8 lower case letters or digits. */
function newChipId(taken: ReadonlySet<string>): string {
	for (;;) {
		const bytes = crypto.getRandomValues(new Uint8Array(8));
		const id = `custom-${Array.from(bytes, (byte) => (byte % 36).toString(36)).join('')}`;
		if (!taken.has(id)) {
			return id;
		}
	}
}

/**
 * Content of the Filters tab: the chips of the bar (reorder, hide, add, make your own) and whether
 * the drafts chip remembers its state. Two views share the tab: the list and the chip editor.
 */
export function FiltersPanel({ config }: FiltersPanelProps) {
	const [view, setView] = useState<'list' | 'edit'>('list');
	/** Id of the custom chip being edited; `null` is a new chip. */
	const [editingId, setEditingId] = useState<string | null>(null);
	/** Counts the openings of the editor: every one starts with fresh fields. */
	const [session, setSession] = useState(0);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [editorError, setEditorError] = useState<string | null>(null);
	const [shown, setShown] = useState(config.filters.chips);
	/** Saves of the chip list that are still in flight; storage updates are followed only without any. */
	const pendingShown = useRef(0);
	const storedShown = useRef(config.filters.chips);
	storedShown.current = config.filters.chips;
	const draftsLabelId = useId();
	const viewRef = useRef<HTMLDivElement>(null);
	const addRef = useRef<HTMLButtonElement>(null);
	const backRef = useRef<HTMLButtonElement>(null);
	/** The chip whose Edit button opened the editor, so the focus can go back to it. */
	const openedFrom = useRef<string | null>(null);
	const viewChanged = useRef(false);

	const custom = config.filters.custom;
	const editing = custom.find((chip) => chip.id === editingId) ?? null;

	const [stickyDrafts, setStickyDrafts] = useOptimisticToggle(
		config.filters.sticky.drafts,
		(value) => configService.setFilters({ sticky: { drafts: value } }),
		() => setSaveError('Could not save. Try again.')
	);

	useEffect(() => {
		if (pendingShown.current === 0) {
			setShown(config.filters.chips);
		}
	}, [config.filters.chips]);

	// The chip that is being edited was deleted somewhere else: there is nothing to edit any more
	useEffect(() => {
		if (view === 'edit' && editingId !== null && !editing) {
			setView('list');
		}
	}, [view, editingId, editing]);

	// Move the focus back to the button that opened the editor (not on the first render)
	useEffect(() => {
		if (!viewChanged.current) {
			viewChanged.current = true;
			return;
		}

		if (view !== 'list') {
			return;
		}

		const edit =
			openedFrom.current &&
			viewRef.current?.querySelector<HTMLButtonElement>(
				`[data-chip-id="${openedFrom.current}"] [data-action="edit"]`
			);
		(edit || addRef.current)?.focus();
	}, [view]);

	const commitShown = (next: string[]): void => {
		setSaveError(null);
		setShown(next);
		pendingShown.current++;
		configService
			.setFilters({ chips: next })
			.catch((error: unknown) => {
				setShown(storedShown.current);
				setSaveError(
					error instanceof ConfigTooLargeError
						? TOO_LARGE_MESSAGE
						: 'Could not save. Try again.'
				);
			})
			.finally(() => {
				pendingShown.current--;
			});
	};

	const openEditor = (id: string | null): void => {
		setEditorError(null);
		setEditingId(id);
		setSession((count) => count + 1);
		openedFrom.current = id;
		setView('edit');
	};

	const write = (
		change: Parameters<typeof configService.setFilters>[0],
		failure: string
	): void => {
		if (saving) {
			return;
		}

		setSaving(true);
		setEditorError(null);
		configService
			.setFilters(change)
			.then(() => setView('list'))
			.catch((error: unknown) =>
				setEditorError(
					error instanceof ConfigTooLargeError
						? TOO_LARGE_MESSAGE
						: failure
				)
			)
			.finally(() => setSaving(false));
	};

	const saveChip = (draft: CustomChipDraft): void => {
		const taken = new Set(custom.map((chip) => chip.id));
		const id = editing ? editing.id : newChipId(taken);
		const chip: CustomChipModel = { id, ...draft };
		const nextCustom = editing
			? custom.map((item) => (item.id === id ? chip : item))
			: [...custom, chip];
		// A new chip joins the bar at once; an edited one keeps its place
		const nextShown =
			editing || shown.includes(id) ? shown : [...shown, id];
		write(
			{ custom: nextCustom, chips: nextShown },
			'Could not save. Try again.'
		);
	};

	const deleteChip = (): void => {
		if (!editing) {
			return;
		}

		write(
			{
				custom: custom.filter((chip) => chip.id !== editing.id),
				chips: shown.filter((id) => id !== editing.id),
			},
			'Could not save. Try again.'
		);
	};

	const draftsShown = shown.includes('drafts');

	return (
		<div className="hyperfriend-views">
			<div
				ref={viewRef}
				className="hyperfriend-view"
				data-inactive={view === 'list' ? undefined : ''}
			>
				<SettingsSection title="Quick filters in pull request lists">
					<div className="hyperfriend-group">
						<FilterChipList
							shown={shown}
							custom={custom}
							onShownChange={commitShown}
							onEdit={openEditor}
						/>
					</div>
					<Button
						ref={addRef}
						size="small"
						leadingVisual={PlusIcon}
						disabled={custom.length >= MAX_CUSTOM_CHIPS}
						onClick={() => openEditor(null)}
					>
						{custom.length >= MAX_CUSTOM_CHIPS
							? `Up to ${MAX_CUSTOM_CHIPS} custom chips`
							: 'Add a custom chip'}
					</Button>
				</SettingsSection>

				<SettingsSection title="Remember your choice on every list">
					<div className="hyperfriend-group">
						<div className="hyperfriend-row">
							<div style={{ flex: 1, minWidth: 0 }}>
								<Text
									id={draftsLabelId}
									weight="semibold"
									size="medium"
									style={{ display: 'block' }}
								>
									Remember the drafts filter
								</Text>
							</div>
							<ToggleSwitch
								size="small"
								aria-labelledby={draftsLabelId}
								disabled={!draftsShown}
								checked={stickyDrafts}
								onChange={(value) => {
									setSaveError(null);
									setStickyDrafts(value);
								}}
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
			</div>

			{/* Stays mounted, so the tab never changes its height; a new key resets the fields */}
			<div
				className="hyperfriend-view"
				data-inactive={view === 'edit' ? undefined : ''}
			>
				<FilterChipEditor
					key={session}
					chip={editing}
					active={view === 'edit'}
					saving={saving}
					saveError={editorError}
					backRef={backRef}
					onSave={saveChip}
					onDelete={deleteChip}
					onBack={() => setView('list')}
				/>
			</div>
		</div>
	);
}
