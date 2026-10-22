import { ChevronLeftIcon } from '@primer/octicons-react';
import { Button, Text, TextInput } from '@primer/react';
import {
	listEnterpriseHosts,
	parseEnterpriseHost,
	removeEnterpriseHost,
	requestEnterpriseHost,
} from '@shared/services';
import { Ref, useCallback, useEffect, useId, useRef, useState } from 'react';

import { ViewMode } from '../hooks/use-view-mode';

/** Settings page URL the Firefox popup opens for the permission prompt (General tab). */
const SETTINGS_TAB_PATH = 'options.html#general';

/** How long the "added" message stays visible. */
const NOTICE_VISIBLE_MS = 6000;

interface EnterpriseSectionProps {
	/** `null` until the view is detected; adding waits until then. */
	viewMode: ViewMode | null;
	/** Returns to the settings view. */
	onBack: () => void;
	/** The back button, so the parent can focus it when this view opens. */
	backRef: Ref<HTMLButtonElement>;
	/** Called with the number of added domains every time the list is read. */
	onHostsChange: (count: number) => void;
}

/**
 * The GitHub Enterprise view of the General tab: the domains the extension runs on besides
 * github.com. Adding a domain asks the browser for access to it (a prompt the user confirms);
 * the background script then registers the content script for it.
 */
export function EnterpriseSection({
	viewMode,
	onBack,
	backRef,
	onHostsChange,
}: EnterpriseSectionProps) {
	const [hosts, setHosts] = useState<string[]>([]);
	const [input, setInput] = useState('');
	const [error, setError] = useState<string | null>(null);
	/** The error is about the typed domain (the field is marked invalid), not about the browser. */
	const [inputInvalid, setInputInvalid] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const inputId = useId();
	const descriptionId = useId();
	const errorId = useId();

	/** Number of the latest list request: an older answer that arrives later is dropped. */
	const latestRequest = useRef(0);
	const mounted = useRef(true);
	const onHostsChangeRef = useRef(onHostsChange);
	onHostsChangeRef.current = onHostsChange;

	const showError = (message: string, forInput = false): void => {
		setError(message);
		setInputInvalid(forInput);
	};

	const refresh = useCallback((): void => {
		const request = ++latestRequest.current;
		listEnterpriseHosts().then(
			(list) => {
				if (!mounted.current || request !== latestRequest.current) {
					return;
				}

				setHosts(list);
				onHostsChangeRef.current(list.length);
			},
			() => {
				if (!mounted.current || request !== latestRequest.current) {
					return;
				}

				setHosts([]);
				onHostsChangeRef.current(0);
				setError('Could not read the added domains.');
				setInputInvalid(false);
			}
		);
	}, []);

	useEffect(() => {
		mounted.current = true;
		refresh();
		// The access can also be changed elsewhere (the browser's extension settings)
		chrome.permissions?.onAdded?.addListener(refresh);
		chrome.permissions?.onRemoved?.addListener(refresh);
		return () => {
			mounted.current = false;
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
			.catch(() => showError('Could not open the settings page.'));
		return true;
	};

	const handleAdd = (): void => {
		setError(null);
		setInputInvalid(false);
		setNotice(null);
		const parsed = parseEnterpriseHost(input);
		if (!parsed.ok) {
			showError(parsed.error, true);
			return;
		}

		if (hosts.includes(parsed.host)) {
			showError('This domain is already added.', true);
			return;
		}

		if (viewMode === null || openSettingsTabInstead()) {
			return;
		}

		// Called directly from the click: the browser needs the user gesture for its prompt
		requestEnterpriseHost(parsed.host).then(
			(granted) => {
				if (!granted) {
					showError('The browser did not give the access.');
					return;
				}

				refresh();
				// A broader access (all sites) makes the browser say yes without storing this
				// domain, and then no content script is registered for it
				listEnterpriseHosts().then(
					(list) => {
						if (!mounted.current) {
							return;
						}

						if (list.includes(parsed.host)) {
							setInput('');
							setNotice(`Added ${parsed.host}.`);
							return;
						}

						showError(
							`The browser already gives access to all sites, so ${parsed.host} was not added. Turn off the access to all sites in the browser's extension settings, then add the domain again.`
						);
					},
					() => showError('Could not read the added domains.')
				);
			},
			() => showError('Could not ask the browser for the access.')
		);
	};

	const handleRemove = (host: string): void => {
		setError(null);
		setInputInvalid(false);
		setNotice(null);
		removeEnterpriseHost(host).then(
			(removed) => {
				if (!removed) {
					showError('Could not remove the access.');
				} else {
					// Tabs of the domain that are already open keep the content script until a reload
					setNotice(
						`Removed ${host}. Reload its open tabs to remove the buttons there.`
					);
				}
				refresh();
			},
			() => showError('Could not remove the access.')
		);
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
					gap: 6,
				}}
			>
				<Button
					ref={backRef}
					size="small"
					variant="invisible"
					leadingVisual={ChevronLeftIcon}
					style={{ marginLeft: -8 }}
					onClick={onBack}
				>
					General
				</Button>
				<Text
					as="h2"
					size="large"
					weight="semibold"
					style={{ margin: 0 }}
				>
					GitHub Enterprise Server
				</Text>
				<Text
					id={descriptionId}
					size="small"
					style={{ color: 'var(--fgColor-muted)' }}
				>
					Sites on *.ghe.com work without setup. For a GitHub
					Enterprise Server on its own domain, add that domain, such
					as github.example.com, to get the copy buttons there. The
					browser asks you to allow it.
				</Text>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
				<Text
					as="label"
					htmlFor={inputId}
					size="small"
					weight="semibold"
					style={{ color: 'var(--fgColor-muted)' }}
				>
					Domain
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
						aria-describedby={
							inputInvalid
								? `${descriptionId} ${errorId}`
								: descriptionId
						}
						aria-invalid={inputInvalid ? true : undefined}
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
			</div>

			{hosts.length > 0 && (
				<div
					style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
				>
					<Text
						size="small"
						weight="semibold"
						style={{ color: 'var(--fgColor-muted)' }}
					>
						Added domains
					</Text>
					<ul
						className="hyperfriend-group"
						aria-label="Added domains"
						style={{
							listStyle: 'none',
							margin: 0,
							padding: 0,
							// A long list must not make the popup taller than the browser allows
							maxHeight: 160,
							overflowY: 'auto',
						}}
					>
						{hosts.map((host, index) => (
							<li
								key={host}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									gap: 8,
									padding: '4px 4px 4px 12px',
									borderTop:
										index === 0
											? undefined
											: '1px solid var(--borderColor-default)',
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
									style={{ color: 'var(--fgColor-danger)' }}
									onClick={() => handleRemove(host)}
								>
									Remove
								</Button>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
