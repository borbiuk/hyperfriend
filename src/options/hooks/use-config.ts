import { ConfigModel } from '@shared/models';
import { configService } from '@shared/services';
import { useEffect, useState } from 'react';

/**
 * Loads the extension config and keeps it fresh when storage changes.
 *
 * @returns The current config, or `null` until the first read completes.
 */
export function useConfig(): ConfigModel | null {
	const [config, setConfig] = useState<ConfigModel | null>(null);

	useEffect(() => {
		let active = true;
		let changed = false;

		const unsubscribe = configService.subscribe((value) => {
			changed = true;
			if (active) {
				setConfig(value);
			}
		});

		configService.get().then((value) => {
			// A change notification that arrived meanwhile is newer than this read.
			if (active && !changed) {
				setConfig(value);
			}
		});

		return () => {
			active = false;
			unsubscribe();
		};
	}, []);

	return config;
}
