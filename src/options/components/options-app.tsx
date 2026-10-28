import { Heading, Link } from '@primer/react';
import { UnderlinePanels } from '@primer/react/experimental';
import { useCallback, useRef, useState } from 'react';

import { useConfig } from '../hooks/use-config';
import { useViewMode } from '../hooks/use-view-mode';
import '../styles/tabs.css';
import { DEFAULT_OPTIONS_TAB, parseOptionsHash } from '../utils/options-hash';

import { FiltersPanel } from './filters-panel';
import { GeneralPanel } from './general-panel';
import { Logo } from './logo';
import { ShortcutsPanel } from './shortcuts-panel';
import { FieldControls } from './template-field';
import { TemplatesPanel } from './templates-panel';

const REPOSITORY_URL = 'https://github.com/borbiuk/hyperfriend';

/**
 * Root of the toolbar popup: header, the Templates / Shortcuts / Filters / General tabs and footer.
 * The URL hash selects the first tab (see parseOptionsHash), e.g. `#general`.
 */
export function OptionsApp() {
	const { config, refresh } = useConfig();
	const viewMode = useViewMode();
	const [initialTab] = useState(
		() => parseOptionsHash(location.hash).tab ?? DEFAULT_OPTIONS_TAB
	);
	const [syncEpoch, setSyncEpoch] = useState(0);
	const fields = useRef(new Set<FieldControls>());

	const registerField = useCallback(
		(controls: FieldControls): (() => void) => {
			fields.current.add(controls);
			return () => {
				fields.current.delete(controls);
			};
		},
		[]
	);

	const flushAll = useCallback(async (): Promise<void> => {
		await Promise.all([...fields.current].map((field) => field.flush()));
	}, []);

	const cancelAll = useCallback(async (): Promise<void> => {
		await Promise.all([...fields.current].map((field) => field.cancel()));
	}, []);

	// Both updates land in one render, so every tab sees the new config with the new epoch.
	const applyStored = useCallback(async (): Promise<void> => {
		await refresh();
		setSyncEpoch((epoch) => epoch + 1);
	}, [refresh]);

	return (
		<main
			style={{
				boxSizing: 'border-box',
				width: 400,
				minHeight: 120,
				padding: 16,
				// Center the panel when the page is shown in a browser tab.
				margin: viewMode === 'tab' ? '24px auto' : 0,
				display: 'flex',
				flexDirection: 'column',
				gap: 8,
				backgroundColor: 'var(--bgColor-default)',
				color: 'var(--fgColor-default)',
			}}
		>
			<header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<Logo size={24} />
				<Heading as="h1" variant="small">
					Hyperfriend
				</Heading>
			</header>

			{config && (
				<div className="hyperfriend-tabs">
					<UnderlinePanels
						aria-label="Settings"
						defaultValue={initialTab}
						className="hyperfriend-tabs__list"
					>
						<UnderlinePanels.Tab value="templates">
							Templates
						</UnderlinePanels.Tab>
						<UnderlinePanels.Tab value="shortcuts">
							Shortcuts
						</UnderlinePanels.Tab>
						<UnderlinePanels.Tab value="filters">
							Filters
						</UnderlinePanels.Tab>
						<UnderlinePanels.Tab value="general">
							General
						</UnderlinePanels.Tab>
						<UnderlinePanels.Panel
							value="templates"
							className="hyperfriend-tabs__panel"
						>
							<TemplatesPanel
								config={config}
								syncEpoch={syncEpoch}
								registerField={registerField}
							/>
						</UnderlinePanels.Panel>
						<UnderlinePanels.Panel
							value="shortcuts"
							className="hyperfriend-tabs__panel"
						>
							<ShortcutsPanel
								config={config}
								syncEpoch={syncEpoch}
							/>
						</UnderlinePanels.Panel>
						<UnderlinePanels.Panel
							value="filters"
							className="hyperfriend-tabs__panel"
						>
							<FiltersPanel key={syncEpoch} config={config} />
						</UnderlinePanels.Panel>
						<UnderlinePanels.Panel
							value="general"
							className="hyperfriend-tabs__panel"
						>
							<GeneralPanel
								config={config}
								viewMode={viewMode}
								flushAll={flushAll}
								cancelAll={cancelAll}
								applyStored={applyStored}
							/>
						</UnderlinePanels.Panel>
					</UnderlinePanels>
				</div>
			)}

			<footer
				style={{
					display: 'flex',
					justifyContent: 'flex-end',
					marginTop: 'auto',
				}}
			>
				<Link
					href={REPOSITORY_URL}
					target="_blank"
					rel="noreferrer"
					style={{ fontSize: 12 }}
				>
					GitHub
				</Link>
			</footer>
		</main>
	);
}
