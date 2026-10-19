import { Text } from '@primer/react';
import { ReactNode } from 'react';

interface SettingsSectionProps {
	title: string;
	children: ReactNode;
}

/**
 * A titled group of settings.
 */
export function SettingsSection({ title, children }: SettingsSectionProps) {
	return (
		<section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<Text as="h2" size="medium" weight="semibold" style={{ margin: 0 }}>
				{title}
			</Text>
			{children}
		</section>
	);
}
