import { Button, Text, TextInput } from '@primer/react';
import {
	listEnterpriseHosts,
	parseEnterpriseHost,
	removeEnterpriseHost,
	requestEnterpriseHost,
} from '@shared/services';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { ViewMode } from '../hooks/use-view-mode';

/** Settings page URL the Firefox popup opens for the permission prompt (General tab). */
const SETTINGS_TAB_PATH = 'options.html#general';

/** How long the "added" message stays visible. */
const NOTICE_VISIBLE_MS = 6000;

interface EnterpriseSectionProps {
	/** `null` until the view is detected; adding waits until then. */
	viewMode: ViewMode | null;
}

/**
 * The "GitHub Enterprise" section of the General tab: the domains the extension runs on besides
 * github.com. Adding a domain asks the browser for access to it (a prompt the user confirms);
 * the background script then registers the content script for it.
 */
export function EnterpriseSection({ viewMode }: EnterpriseSectionProps) {
	const [hosts, setHosts] = useState<string[]>([]);
	const [input, setInput] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const inputId = useId();
	const errorId = useId();

	const refresh = useCallback((): void => {
		listEnterpriseHosts().then(setHosts, () => setHosts([]));
	}, []);

	// Closed at first, so the popup stays short; opened once when domains were added before
	// (not again after the user closed it)
	const openedForHosts = useRef(false);
	useEffect(() => {
		if (hosts.length > 0 && !openedForHosts.current) {
			openedForHosts.current = true;
			setOpen(true);
		}
	}, [hosts.length]);

	useEffect(() => {
		refresh();
		// The access can also be changed elsewhere (the browser's extension settings)
		chrome.permissions?.onAdded?.addListener(refresh);
		chrome.permissions?.onRemoved?.addListener(refresh);
		return () => {
			chrome.permissions?.onAdded?.removeListener(refresh);
			chrome.permissions?.onRemoved?.removeListener(refresh);
		};
	}, [refresh]);

	useEffect(() => {
		if (!notice) {
			return;
		}

		const timer = window.setTimeout(
			() => setNotice(null),
			NOTICE_VISIBLE_MS
		);
		return () => window.clearTimeout(timer);
	}, [notice]);

	/**
	 * The Firefox popup closes when the permission prompt opens, so the prompt is answered on the
	 * settings page, opened in a tab on the General tab.
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
			.then(() => window.close())
			.catch(() => setError('Could not open the settings page.'));
		return true;
	};

	const handleAdd = (): void => {
		setError(null);
		setNotice(null);
		const parsed = parseEnterpriseHost(input);
		if (!parsed.ok) {
			setError(parsed.error);
			return;
		}

		if (hosts.includes(parsed.host)) {
			setError('This domain is already added.');
			return;
		}

		if (viewMode === null || openSettingsTabInstead()) {
			return;
		}

		// Called directly from the click: the browser needs the user gesture for its prompt
		requestEnterpriseHost(parsed.host).then(
			(granted) => {
				if (!granted) {
					setError('The browser did not give the access.');
					return;
				}

				setInput('');
				setNotice(`Added ${parsed.host}.`);
				refresh();
			},
			() => setError('Could not ask the browser for the access.')
		);
	};

	const handleRemove = (host: string): void => {
		setError(null);
		setNotice(null);
		removeEnterpriseHost(host).then(
			(removed) => {
				if (!removed) {
					setError('Could not remove the access.');
				}
				refresh();
			},
			() => setError('Could not remove the access.')
		);
	};

	return (
		<details
			open={open}
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary style={{ cursor: 'pointer' }}>
				<Text
					as="h2"
					size="medium"
					weight="semibold"
					style={{ display: 'inline', margin: 0 }}
				>
					GitHub Enterprise
				</Text>
			</summary>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 8,
					marginTop: 8,
				}}
			>
				<Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
					Add the domain of your GitHub Enterprise site, such as
					github.example.com, to get the copy buttons there. The
					browser asks you to allow it. Works with the markup of
					recent versions.
				</Text>
				<form
					style={{ display: 'flex', gap: 8 }}
					onSubmit={(event) => {
						event.preventDefault();
						handleAdd();
					}}
				>
					<TextInput
						id={inputId}
						block
						size="small"
						value={input}
						aria-label="GitHub Enterprise domain"
						aria-describedby={error ? errorId : undefined}
						aria-invalid={error ? true : undefined}
						placeholder="github.example.com"
						onChange={(event) => setInput(event.target.value)}
						spellCheck={false}
						autoComplete="off"
					/>
					<Button
						type="submit"
						size="small"
						disabled={viewMode === null}
					>
						Add
					</Button>
				</form>
				<Text
					id={errorId}
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
						color: 'var(--fgColor-success)',
					}}
				>
					{notice ?? ''}
				</Text>
				{hosts.length > 0 && (
					<ul
						aria-label="Added domains"
						style={{
							listStyle: 'none',
							margin: 0,
							padding: 0,
							display: 'flex',
							flexDirection: 'column',
							gap: 4,
							// A long list must not make the popup taller than the browser allows
							maxHeight: 96,
							overflowY: 'auto',
						}}
					>
						{hosts.map((host) => (
							<li
								key={host}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									gap: 8,
								}}
							>
								<Text
									size="small"
									style={{ overflowWrap: 'anywhere' }}
								>
									{host}
								</Text>
								<Button
									size="small"
									variant="invisible"
									aria-label={`Remove ${host}`}
									onClick={() => handleRemove(host)}
								>
									Remove
								</Button>
							</li>
						))}
					</ul>
				)}
			</div>
		</details>
	);
}
