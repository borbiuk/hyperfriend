import { useEffect, useState } from 'react';

export type ViewMode = 'popup' | 'tab';

/**
 * Tells whether the page is shown in the toolbar popup or in a regular browser tab
 * (the "settings page" opened by `chrome.runtime.openOptionsPage()`).
 *
 * `chrome.tabs.getCurrent()` is used because it needs no permission and is reliable:
 * it resolves with the tab only for pages rendered in a tab, and with `undefined` for
 * the popup. The `#tab` URL hash is an explicit override (handy for manual testing).
 *
 * @returns The view mode, or `null` until the check has finished. Callers must not
 * treat `null` as the popup: a click in a tab must never take the popup branch.
 */
export function useViewMode(): ViewMode | null {
	const [mode, setMode] = useState<ViewMode | null>(
		location.hash === '#tab' ? 'tab' : null
	);

	useEffect(() => {
		if (mode !== null) {
			return;
		}

		let active = true;
		const settle = (tab: unknown): void => {
			if (active) {
				setMode(tab ? 'tab' : 'popup');
			}
		};

		try {
			Promise.resolve(chrome.tabs?.getCurrent?.()).then(settle, () =>
				settle(undefined)
			);
		} catch {
			settle(undefined);
		}

		return () => {
			active = false;
		};
	}, [mode]);

	return mode;
}
