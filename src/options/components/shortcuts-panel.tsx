import { Text } from '@primer/react';
import { ConfigModel } from '@shared/models';

import { SHORTCUT_ITEMS } from '../constants/shortcut-items';

import { ShortcutRow } from './shortcut-row';

interface ShortcutsPanelProps {
	config: ConfigModel;
	/** Increments every time the settings are replaced from outside (reset, import). */
	syncEpoch: number;
}

/**
 * Content of the Shortcuts tab: one row per SHORTCUT_ITEMS entry and a usage hint.
 */
export function ShortcutsPanel({ config, syncEpoch }: ShortcutsPanelProps) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
			{SHORTCUT_ITEMS.map((item) => (
				<ShortcutRow
					key={item.type}
					item={item}
					binding={config.shortcuts[item.type]}
					shortcuts={config.shortcuts}
					syncEpoch={syncEpoch}
				/>
			))}
			<Text size="small" style={{ color: 'var(--fgColor-muted)' }}>
				Click the keys to change them, then press a new shortcut. Esc
				cancels. Shortcuts don&apos;t work while you type in a text
				field.
			</Text>
		</div>
	);
}
