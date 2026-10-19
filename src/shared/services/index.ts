// @shared/services/index.ts

export { buildLinkPayload, copyLink } from './clipboard-service';
export type { LinkPayload } from './clipboard-service';
export { configService } from './config-service';
export {
	parseSettings,
	serializeSettings,
	SETTINGS_FILE_NAME,
} from './settings-transfer-service';
export type { ParseSettingsResult } from './settings-transfer-service';
export { renderTemplate } from './template-service';
