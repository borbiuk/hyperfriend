import { DownloadIcon, UploadIcon } from '@primer/octicons-react';
import { Button, ConfirmationDialog, Text } from '@primer/react';
import {
	configService,
	parseSettings,
	serializeSettings,
	SETTINGS_FILE_NAME,
} from '@shared/services';
import { ChangeEvent, useEffect, useRef, useState } from 'react';

import { ViewMode } from '../hooks/use-view-mode';
import { downloadText } from '../utils/download-text';

/** Settings page URL the Firefox popup opens for Export and Import (General tab). */
const SETTINGS_TAB_PATH = 'options.html#general';

/** How long a success message stays visible. */
const NOTICE_VISIBLE_MS = 4000;

/** Max size of a settings file, checked before the file is read. */
const MAX_FILE_BYTES = 64 * 1024;

interface Notice {
	kind: 'success' | 'error';
	text: string;
}

interface SettingsActionsProps {
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
 * Export, Import and "Reset all settings" (with a confirmation) plus their messages.
 */
export function SettingsActions({
	viewMode,
	flushAll,
	cancelAll,
	applyStored,
}: SettingsActionsProps) {
	const [notice, setNotice] = useState<Notice | null>(null);
	const [confirmingReset, setConfirmingReset] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const noticeTimer = useRef<number>(0);

	useEffect(() => {
		return () => window.clearTimeout(noticeTimer.current);
	}, []);

	const show = (next: Notice | null): void => {
		window.clearTimeout(noticeTimer.current);
		setNotice(next);
		if (next?.kind === 'success') {
			noticeTimer.current = window.setTimeout(
				() => setNotice(null),
				NOTICE_VISIBLE_MS
			);
		}
	};

	const reset = async (): Promise<void> => {
		show(null);
		try {
			// Pending saves must not overwrite the defaults afterwards.
			await cancelAll();
			await configService.reset();
			await applyStored();
			show({ kind: 'success', text: 'All settings were reset.' });
		} catch {
			show({ kind: 'error', text: 'Could not reset.' });
		}
	};

	const handleResetDialogClose = (
		gesture: 'confirm' | 'close-button' | 'cancel' | 'escape'
	): void => {
		setConfirmingReset(false);
		if (gesture === 'confirm') {
			void reset();
		}
	};

	/**
	 * The Firefox popup closes when the OS file picker or the download panel opens, so
	 * the import file would never arrive and the export blob URL would die. There both
	 * actions happen on the settings page, opened in a tab on the General tab.
	 *
	 * @returns True when the settings page was opened instead (the popup is closing).
	 */
	const openSettingsTabInstead = (): boolean => {
		if (viewMode !== 'popup' || !navigator.userAgent.includes('Firefox')) {
			return false;
		}

		Promise.resolve()
			.then(() =>
				chrome.tabs.create({
					url: chrome.runtime.getURL(SETTINGS_TAB_PATH),
				})
			)
			// Close the popup only on success, so a failure message stays readable.
			.then(() => window.close())
			.catch(() =>
				show({
					kind: 'error',
					text: 'Could not open the settings page.',
				})
			);
		return true;
	};

	const handleExport = async (): Promise<void> => {
		show(null);
		if (openSettingsTabInstead()) {
			return;
		}

		try {
			await flushAll();
			const config = await configService.get();
			downloadText(SETTINGS_FILE_NAME, serializeSettings(config));
		} catch {
			show({ kind: 'error', text: 'Could not export the settings.' });
		}
	};

	const handleImportClick = (): void => {
		show(null);

		if (openSettingsTabInstead()) {
			return;
		}

		fileInput.current?.click();
	};

	const handleFileChange = async (
		event: ChangeEvent<HTMLInputElement>
	): Promise<void> => {
		const input = event.target;
		const file = input.files?.[0];
		// Allows picking the same file again later.
		input.value = '';
		if (!file) {
			return;
		}

		if (file.size > MAX_FILE_BYTES) {
			show({ kind: 'error', text: 'The file is too large (max 64 KB).' });
			return;
		}

		try {
			const result = parseSettings(await file.text());
			if (!result.ok) {
				show({ kind: 'error', text: result.error });
				return;
			}

			await cancelAll();
			await configService.importSettings(result.settings);
			await applyStored();
			show({ kind: 'success', text: 'Settings imported.' });
		} catch {
			show({ kind: 'error', text: 'Could not import the file.' });
		}
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
				<Button
					size="small"
					leadingVisual={DownloadIcon}
					disabled={viewMode === null}
					onClick={handleExport}
				>
					Export
				</Button>
				<Button
					size="small"
					leadingVisual={UploadIcon}
					disabled={viewMode === null}
					onClick={handleImportClick}
				>
					Import
				</Button>
				<Button
					size="small"
					variant="danger"
					onClick={() => {
						show(null);
						setConfirmingReset(true);
					}}
				>
					Reset all settings
				</Button>
				<input
					ref={fileInput}
					type="file"
					accept="application/json,.json"
					hidden
					onChange={handleFileChange}
				/>
			</div>
			{/* Live regions stay mounted, so screen readers announce the text changes. */}
			<div>
				<Text
					size="small"
					role="status"
					style={{
						display: 'block',
						color: 'var(--fgColor-success)',
						overflowWrap: 'anywhere',
					}}
				>
					{notice?.kind === 'success' ? notice.text : ''}
				</Text>
				<Text
					size="small"
					role="alert"
					style={{
						display: 'block',
						color: 'var(--fgColor-danger)',
						overflowWrap: 'anywhere',
					}}
				>
					{notice?.kind === 'error' ? notice.text : ''}
				</Text>
			</div>
			{confirmingReset && (
				<ConfirmationDialog
					title="Reset all settings?"
					onClose={handleResetDialogClose}
					confirmButtonContent="Reset"
					confirmButtonType="danger"
				>
					Templates, shortcuts and display settings return to their
					defaults.
				</ConfirmationDialog>
			)}
		</div>
	);
}
