// @shared/services/index.ts

export {
	buildLinkPayload,
	buildLinksPayload,
	copyLink,
	copyLinks,
} from './clipboard-service';
export type { LinkPayload, LinksPayload } from './clipboard-service';
export {
	cloneConfig,
	cloneDefaultConfig,
	configService,
	toStoredConfig,
} from './config-service';
export {
	parseSettings,
	serializeSettings,
	SETTINGS_FILE_NAME,
} from './settings-transfer-service';
export type { ParseSettingsResult } from './settings-transfer-service';
export { renderTemplate, renderTemplateParts } from './template-service';
export type { TemplateParts } from './template-service';
