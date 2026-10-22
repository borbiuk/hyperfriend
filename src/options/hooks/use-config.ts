import { ConfigModel } from '@shared/models';
import { configService } from '@shared/services';
import { useCallback, useEffect, useState } from 'react';

/**
 * Loads the extension config and keeps it fresh when storage changes.
 *
 * @returns The current config (`null` until the first read completes) and a function
 * that re-reads it from storage.
 */
export function useConfig(): {
	config: ConfigModel | null;
	refresh: () => Promise<void>;
} {
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

		// configService.get never rejects
		void configService.get().then((value) => {
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

	const refresh = useCallback(async (): Promise<void> => {
		setConfig(await configService.get());
	}, []);

	return { config, refresh };
}
