import { ConfigModel } from '@shared/models';
import { cloneDefaultConfig, configService } from '@shared/services';

/**
 * Keeps the current config in memory, so click handlers can read it synchronously
 * (the clipboard write must start without awaiting anything, to keep the user activation).
 */
export class ConfigStore {
	private config: ConfigModel = cloneDefaultConfig();

	/**
	 * Loads the stored config and keeps it fresh.
	 *
	 * @param onChange - Called on every config change.
	 * @returns Resolves when the initial config is loaded.
	 */
	public async start(onChange: () => void): Promise<void> {
		let changed = false;
		configService.subscribe((config: ConfigModel) => {
			changed = true;
			this.config = config;
			onChange();
		});

		const config = await configService.get();
		if (changed) {
			// A change notification arrived meanwhile and is newer than this read
			return;
		}

		this.config = config;
	}

	/**
	 * Returns the current config.
	 */
	public get(): ConfigModel {
		return this.config;
	}
}
