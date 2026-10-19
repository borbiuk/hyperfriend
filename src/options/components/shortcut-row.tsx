import { Button, Text, ToggleSwitch, VisuallyHidden } from '@primer/react';
import { DEFAULT_CONFIG } from '@shared/constants';
import { ShortcutBindingModel, ShortcutType } from '@shared/models';
import { configService } from '@shared/services';
import {
	formatShortcutParts,
	MODIFIER_KEYS,
	shortcutFromEvent,
	shortcutsEqual,
	validateShortcut,
} from '@shared/utils';
import {
	KeyboardEvent,
	MouseEvent,
	useEffect,
	useId,
	useRef,
	useState,
} from 'react';

import { ShortcutItem } from '../constants/shortcut-items';
import { useOptimisticToggle } from '../hooks/use-optimistic-toggle';
import { describeShortcut } from '../utils/describe-shortcut';

import { KeyChips } from './key-chips';

/** `KeyboardEvent.key` values of keys that only modify other keys. */
const MODIFIER_EVENT_KEYS = new Set([
	'Shift',
	'Control',
	'Alt',
	'AltGraph',
	'Meta',
	'OS',
	'Fn',
	'FnLock',
	'Hyper',
	'Super',
	'CapsLock',
	'NumLock',
	'ScrollLock',
]);

const SAVE_ERROR = 'Could not save. Try again.';

/** Delay before a new announcement is written, so a repeated text is announced again. */
const ANNOUNCE_DELAY_MS = 50;

interface ShortcutRowProps {
	item: ShortcutItem;
	/** Current binding of this shortcut. */
	binding: ShortcutBindingModel;
	/** Current bindings of every shortcut (to detect conflicts). */
	shortcuts: Record<ShortcutType, ShortcutBindingModel>;
	/** Increments every time the settings are replaced from outside (reset, import). */
	syncEpoch: number;
}

/**
 * Returns the modifiers held during a key event, normalized (e.g. `['Control', 'Shift']`).
 */
function heldModifiers(event: KeyboardEvent): string[] {
	const flags: Record<string, boolean> = {
		Control: event.ctrlKey,
		Alt: event.altKey,
		Shift: event.shiftKey,
		Meta: event.metaKey,
	};

	return MODIFIER_KEYS.filter((key) => flags[key]);
}

/**
 * One shortcut: name and description, a button that records new keys, an on/off switch
 * and a Reset button (only when the keys differ from the default).
 *
 * Recording: click the keys button, then press the new shortcut. It is validated and
 * saved right away; `Escape`, a second click or moving focus away cancels. `Tab` is not
 * captured, so keyboard users can always leave.
 */
export function ShortcutRow({
	item,
	binding,
	shortcuts,
	syncEpoch,
}: ShortcutRowProps) {
	const [recording, setRecording] = useState(false);
	/** Modifiers held right now while recording (live preview). */
	const [held, setHeld] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [warning, setWarning] = useState<string | null>(null);
	/** Text of the polite live region (recording started, shortcut saved or reset). */
	const [announcement, setAnnouncement] = useState('');
	const announceTimer = useRef<number>(0);
	const keysButton = useRef<HTMLButtonElement>(null);
	/** True from a captured key press until its keyup, so it can't click the button. */
	const captured = useRef(false);
	const titleId = useId();
	const descriptionId = useId();
	const messageId = useId();

	const defaultKeys = DEFAULT_CONFIG.shortcuts[item.type].keys;
	const isDefault = shortcutsEqual(binding.keys, defaultKeys);

	const [enabled, setEnabled] = useOptimisticToggle(
		binding.enabled,
		(value) => configService.setShortcut(item.type, { enabled: value }),
		() => setError(SAVE_ERROR)
	);

	useEffect(() => {
		return () => window.clearTimeout(announceTimer.current);
	}, []);

	/** Announces a state change to screen readers (polite). */
	const announce = (text: string): void => {
		window.clearTimeout(announceTimer.current);
		setAnnouncement('');
		announceTimer.current = window.setTimeout(
			() => setAnnouncement(text),
			ANNOUNCE_DELAY_MS
		);
	};

	// The settings were replaced (reset, import): drop the local state.
	useEffect(() => {
		if (syncEpoch === 0) {
			return;
		}

		setRecording(false);
		setHeld([]);
		setError(null);
		setWarning(null);
	}, [syncEpoch]);

	const stopRecording = (): void => {
		setRecording(false);
		setHeld([]);
	};

	const startRecording = (): void => {
		setRecording(true);
		setHeld([]);
		setError(null);
		setWarning(null);
		announce('Press a shortcut…');
	};

	/**
	 * Saves new keys and announces the result.
	 *
	 * @param keys - Normalized shortcut.
	 * @param message - Announcement prefix, followed by the spoken shortcut.
	 */
	const saveKeys = (keys: string[], message: string): void => {
		configService
			.setShortcut(item.type, { keys })
			.then(() => announce(`${message} ${describeShortcut(keys)}`))
			.catch(() => setError(SAVE_ERROR));
	};

	const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
		// Space activates a button on keyup: ignore that keyboard click (`detail` 0) after a
		// captured key. Mouse clicks always count.
		if (captured.current && event.detail === 0) {
			event.preventDefault();
			return;
		}

		if (recording) {
			stopRecording();
			setError(null);
			return;
		}

		startRecording();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
		if (!recording || event.key === 'Tab') {
			return;
		}

		// Keep the key away from the page and the browser. For Escape this also keeps the
		// popup open: Chrome closes it only on an unhandled Escape. The Firefox popup is
		// expected to behave the same (not verified there yet).
		event.preventDefault();
		event.stopPropagation();
		captured.current = true;

		if (event.key === 'Escape') {
			stopRecording();
			setError(null);
			return;
		}

		if (event.repeat) {
			return;
		}

		const keys = shortcutFromEvent(event);
		if (!keys) {
			if (MODIFIER_EVENT_KEYS.has(event.key)) {
				setHeld(heldModifiers(event));
				return;
			}

			setHeld([]);
			setError("This key can't be used in a shortcut.");
			return;
		}

		const result = validateShortcut(keys, item.type, shortcuts);
		if (!result.ok) {
			setHeld([]);
			setError(result.error);
			return;
		}

		stopRecording();
		setError(null);
		setWarning(result.warning ?? null);
		saveKeys(keys, 'Shortcut saved:');
	};

	const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>): void => {
		if (recording) {
			setHeld(heldModifiers(event));
		}

		if (!captured.current) {
			return;
		}

		event.preventDefault();
		// The keyboard click (if any) is dispatched right after this handler.
		window.setTimeout(() => {
			captured.current = false;
		});
	};

	const handleBlur = (): void => {
		// The keyup of a captured key may never arrive here now.
		captured.current = false;
		if (!recording) {
			return;
		}

		stopRecording();
		setError(null);
	};

	const handleToggle = (value: boolean): void => {
		setError(null);
		setEnabled(value);
	};

	const handleReset = (): void => {
		setError(null);
		setWarning(null);
		saveKeys([...defaultKeys], 'Shortcut reset to');
		// The Reset button disappears, so keep the focus in the row.
		keysButton.current?.focus();
	};

	const spoken = describeShortcut(binding.keys);
	let keysLabel = `Change ${item.title} shortcut, currently ${spoken}`;
	let keysContent = (
		<KeyChips parts={formatShortcutParts(binding.keys)} muted={!enabled} />
	);
	if (recording) {
		keysLabel = `Press a shortcut for ${item.title}, or Escape to cancel`;
		keysContent =
			held.length > 0 ? (
				<KeyChips parts={[...formatShortcutParts(held), '…']} />
			) : (
				<span>Press a shortcut…</span>
			);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8,
				}}
			>
				<div style={{ flex: 1, minWidth: 0 }}>
					<Text
						id={titleId}
						weight="semibold"
						size="medium"
						style={{ display: 'block' }}
					>
						{item.title}
						<VisuallyHidden> shortcut</VisuallyHidden>
					</Text>
					<Text
						id={descriptionId}
						size="small"
						style={{
							display: 'block',
							color: 'var(--fgColor-muted)',
						}}
					>
						{item.description}
					</Text>
				</div>
				{!isDefault && !recording && (
					<Button
						variant="invisible"
						size="small"
						onClick={handleReset}
						aria-label={`Reset ${item.title} shortcut to ${describeShortcut(defaultKeys)}`}
					>
						Reset
					</Button>
				)}
				<Button
					ref={keysButton}
					size="small"
					aria-label={keysLabel}
					aria-describedby={messageId}
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					onKeyUp={handleKeyUp}
					onBlur={handleBlur}
					style={
						recording
							? {
									borderColor:
										'var(--borderColor-accent-emphasis)',
								}
							: undefined
					}
				>
					{keysContent}
				</Button>
				<ToggleSwitch
					size="small"
					aria-labelledby={titleId}
					aria-describedby={descriptionId}
					checked={enabled}
					onChange={handleToggle}
				/>
			</div>
			{/* Live regions stay mounted, so screen readers announce the text changes. */}
			<div id={messageId}>
				<Text
					size="small"
					role="alert"
					style={{ display: 'block', color: 'var(--fgColor-danger)' }}
				>
					{error ?? ''}
				</Text>
				<Text
					size="small"
					role="status"
					style={{
						display: 'block',
						color: 'var(--fgColor-attention)',
					}}
				>
					{warning ?? ''}
				</Text>
			</div>
			{/* Outside the button's description, so it is only announced, not repeated. */}
			<VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
		</div>
	);
}
