import {
	ChevronDownIcon,
	ChevronUpIcon,
	GrabberIcon,
	PencilIcon,
	PlusIcon,
	XIcon,
} from '@primer/octicons-react';
import { IconButton, Text, VisuallyHidden } from '@primer/react';
import { FILTER_CHIPS } from '@shared/constants';
import { CustomChipModel, FilterChipModel } from '@shared/models';
import { toChipModel } from '@shared/utils';
import { useEffect, useRef, useState } from 'react';

import '../styles/filters.css';

import { ChipIcon } from './chip-icon';

interface FilterChipListProps {
	/** Ids of the chips shown in the bar, in order */
	shown: readonly string[];

	/** Custom chips (shown or not) */
	custom: readonly CustomChipModel[];

	/** Writes a new list of shown ids */
	onShownChange: (next: string[]) => void;

	/** Opens the editor of a custom chip */
	onEdit: (id: string) => void;
}

/** A button of a row the focus can go to (`data-action`). */
type RowAction = 'up' | 'down' | 'edit' | 'hide' | 'show';

/**
 * Returns a copy of the list with the item at `from` moved to `to`.
 */
function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
	const next = [...list];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);

	return next;
}

/**
 * The two groups of the Filters tab: the chips shown in the bar, which can be reordered by
 * dragging or with the arrow buttons, and the chips that are not shown, which can be added.
 */
export function FilterChipList({
	shown,
	custom,
	onShownChange,
	onEdit,
}: FilterChipListProps) {
	const [dragId, setDragId] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);
	/** Said to screen readers after a move, since the row that moved keeps its focus. */
	const [announcement, setAnnouncement] = useState('');
	const rootRef = useRef<HTMLDivElement>(null);
	/** Where the focus goes after the next change of the list (the row that was used moves or goes). */
	const focusAfter = useRef<{ id: string; action: RowAction } | null>(null);

	const customIds = new Set(custom.map((chip) => chip.id));
	const all: FilterChipModel[] = [
		...FILTER_CHIPS,
		...custom.map((chip) => toChipModel(chip)),
	];
	const byId = new Map(all.map((chip) => [chip.id, chip]));
	const shownChips = shown
		.map((id) => byId.get(id))
		.filter((chip): chip is FilterChipModel => chip !== undefined);
	const available = all.filter((chip) => !shown.includes(chip.id));

	// A button that turned disabled (a chip moved to an end) or a row that left the list loses the
	// focus; it goes to the nearest button that can take it
	useEffect(() => {
		const target = focusAfter.current;
		focusAfter.current = null;
		if (!target || !rootRef.current) {
			return;
		}

		const order: RowAction[] =
			target.action === 'up'
				? ['up', 'down', 'hide']
				: target.action === 'down'
					? ['down', 'up', 'hide']
					: [target.action, 'hide'];
		for (const action of order) {
			const button = rootRef.current.querySelector<HTMLButtonElement>(
				`[data-chip-id="${target.id}"] [data-action="${action}"]:not(:disabled)`
			);
			if (button) {
				button.focus();
				return;
			}
		}
	}, [shown]);

	const move = (id: string, to: number, action: RowAction | null): void => {
		const from = shown.indexOf(id);
		if (from < 0 || from === to || to < 0 || to >= shown.length) {
			return;
		}

		// A drop is done with the mouse: the focus stays where it is
		focusAfter.current = action ? { id, action } : null;
		onShownChange(moveItem(shown, from, to));
		setAnnouncement(
			`${byId.get(id)?.label ?? ''} moved to position ${to + 1} of ${shown.length}`
		);
	};

	const hide = (id: string): void => {
		const index = shown.indexOf(id);
		const neighbour = shown[index + 1] ?? shown[index - 1];
		focusAfter.current = neighbour
			? { id: neighbour, action: 'hide' }
			: null;
		onShownChange(shown.filter((other) => other !== id));
	};

	const show = (id: string): void => {
		focusAfter.current = { id, action: 'hide' };
		onShownChange([...shown, id]);
	};

	const endDrag = (): void => {
		setDragId(null);
		setOverId(null);
	};

	const dragIndex = dragId === null ? -1 : shown.indexOf(dragId);

	return (
		<div className="hyperfriend-chip-lists" ref={rootRef}>
			<Text
				as="h3"
				size="small"
				weight="semibold"
				className="hyperfriend-chip-lists__title"
			>
				Shown in the bar (drag to reorder)
			</Text>
			<ul
				className="hyperfriend-chip-list"
				aria-label="Chips shown in the bar"
			>
				{shownChips.map((chip, index) => (
					<li
						key={chip.id}
						className="hyperfriend-chip-row"
						data-chip-id={chip.id}
						draggable
						data-dragging={dragId === chip.id ? '' : undefined}
						// The line goes where the row lands: below the target when dragging down
						data-over={
							overId === chip.id && dragId !== chip.id
								? dragIndex < index
									? 'below'
									: 'above'
								: undefined
						}
						onDragStart={(event) => {
							event.dataTransfer.effectAllowed = 'move';
							// Firefox starts a drag only when some data is set
							event.dataTransfer.setData('text/plain', chip.id);
							setDragId(chip.id);
						}}
						onDragOver={(event) => {
							if (dragId === null) {
								return;
							}

							event.preventDefault();
							event.dataTransfer.dropEffect = 'move';
							setOverId(chip.id);
						}}
						onDrop={(event) => {
							event.preventDefault();
							if (dragId !== null) {
								move(dragId, shown.indexOf(chip.id), null);
							}
							endDrag();
						}}
						onDragEnd={endDrag}
					>
						<span
							className="hyperfriend-chip-row__handle"
							aria-hidden="true"
						>
							<GrabberIcon size={16} />
						</span>
						<ChipIcon name={chip.icon} colour={chip.colour} />
						<span className="hyperfriend-chip-row__label">
							{chip.label}
						</span>
						<IconButton
							icon={ChevronUpIcon}
							aria-label={`Move ${chip.label} up`}
							data-action="up"
							size="small"
							variant="invisible"
							disabled={index === 0}
							onClick={() => move(chip.id, index - 1, 'up')}
						/>
						<IconButton
							icon={ChevronDownIcon}
							aria-label={`Move ${chip.label} down`}
							data-action="down"
							size="small"
							variant="invisible"
							disabled={index === shownChips.length - 1}
							onClick={() => move(chip.id, index + 1, 'down')}
						/>
						{customIds.has(chip.id) && (
							<IconButton
								icon={PencilIcon}
								aria-label={`Edit ${chip.label}`}
								data-action="edit"
								size="small"
								variant="invisible"
								onClick={() => onEdit(chip.id)}
							/>
						)}
						<IconButton
							icon={XIcon}
							aria-label={`Hide ${chip.label} from the bar`}
							data-action="hide"
							size="small"
							variant="invisible"
							onClick={() => hide(chip.id)}
						/>
					</li>
				))}
			</ul>

			{available.length > 0 && (
				<>
					<Text
						as="h3"
						size="small"
						weight="semibold"
						className="hyperfriend-chip-lists__title"
					>
						Not shown
					</Text>
					<ul
						className="hyperfriend-chip-list"
						aria-label="Chips not shown in the bar"
					>
						{available.map((chip) => (
							<li
								key={chip.id}
								className="hyperfriend-chip-row"
								data-chip-id={chip.id}
							>
								<span
									className="hyperfriend-chip-row__handle"
									aria-hidden="true"
								/>
								<ChipIcon
									name={chip.icon}
									colour={chip.colour}
								/>
								<span className="hyperfriend-chip-row__label">
									{chip.label}
								</span>
								{customIds.has(chip.id) && (
									<IconButton
										icon={PencilIcon}
										aria-label={`Edit ${chip.label}`}
										data-action="edit"
										size="small"
										variant="invisible"
										onClick={() => onEdit(chip.id)}
									/>
								)}
								<IconButton
									icon={PlusIcon}
									aria-label={`Show ${chip.label} in the bar`}
									data-action="show"
									size="small"
									variant="invisible"
									onClick={() => show(chip.id)}
								/>
							</li>
						))}
					</ul>
				</>
			)}
			<VisuallyHidden role="status" aria-live="polite">
				{announcement}
			</VisuallyHidden>
		</div>
	);
}
