import { Text } from '@primer/react';
import { ReactNode } from 'react';

interface SettingsSectionProps {
	title: string;
	/** Id of the title, for a control that is named by it. */
	id?: string;
	children: ReactNode;
}

/**
 * A titled group of settings.
 */
export function SettingsSection({ title, id, children }: SettingsSectionProps) {
	return (
		<section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
			<Text
				as="h2"
				id={id}
				size="small"
				weight="semibold"
				style={{ margin: 0, color: 'var(--fgColor-muted)' }}
			>
				{title}
			</Text>
			{children}
		</section>
	);
}
