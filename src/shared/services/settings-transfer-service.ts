import { ConfigModel, LinkType, SettingsFileModel } from '@shared/models';

/** File name used when exporting settings. */
export const SETTINGS_FILE_NAME = 'hyperfriend-settings.json';

/** Value of the `app` marker in a settings file. */
const SETTINGS_APP = 'hyperfriend';

/** Settings file format version written and accepted by this build. */
const SCHEMA_VERSION = 1;

/** Maximum accepted input size in bytes (64 KB). */
const MAX_FILE_SIZE = 64 * 1024;

/** Maximum template length in characters (after trimming). */
const MAX_TEMPLATE_LENGTH = 500;

/** Control characters (including tabs and newlines), not allowed in templates. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

/** UTF-8 byte order mark as decoded into a string. */
const BOM = '\uFEFF';

/**
 * Result of parsing a settings file: either the templates to apply or a user-facing error.
 */
export type ParseSettingsResult =
	| { ok: true; templates: Partial<Record<LinkType, string>> }
	| { ok: false; error: string };

/**
 * Serializes the config into the settings file format.
 *
 * @param config - Current (merged) config.
 * @param now - Export time; defaults to the current time.
 * @returns Pretty-printed JSON (2-space indent) with a trailing newline.
 */
export function serializeSettings(
	config: ConfigModel,
	now: Date = new Date()
): string {
	const file: SettingsFileModel = {
		app: SETTINGS_APP,
		schemaVersion: SCHEMA_VERSION,
		exportedAt: now.toISOString(),
		templates: {
			[LinkType.PullRequest]: config.templates[LinkType.PullRequest],
			[LinkType.Issue]: config.templates[LinkType.Issue],
		},
	};

	return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * Returns true for a plain (non-null, non-array) object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns a failed parse result with the given message.
 */
function fail(error: string): ParseSettingsResult {
	return { ok: false, error };
}

/**
 * Parses and validates the text of a settings file.
 * Only known link types are read; unknown keys are ignored. Templates are trimmed.
 *
 * @param text - File contents (a leading UTF-8 BOM is allowed).
 * @returns The templates found in the file, or a short user-facing error message.
 */
export function parseSettings(text: string): ParseSettingsResult {
	if (new TextEncoder().encode(text).length > MAX_FILE_SIZE) {
		return fail('The file is too large (max 64 KB).');
	}

	const source = text.startsWith(BOM) ? text.slice(BOM.length) : text;

	let data: unknown;
	try {
		data = JSON.parse(source);
	} catch {
		return fail('This file is not valid JSON.');
	}

	if (!isObject(data) || data.app !== SETTINGS_APP) {
		return fail('This is not a Hyperfriend settings file.');
	}

	const version = data.schemaVersion;
	if (Number.isInteger(version) && (version as number) > SCHEMA_VERSION) {
		return fail('This file was created by a newer version of Hyperfriend.');
	}

	if (version !== SCHEMA_VERSION) {
		return fail('This settings file has an unsupported version.');
	}

	if (!isObject(data.templates)) {
		return fail('The file does not contain any templates.');
	}

	const templates: Partial<Record<LinkType, string>> = {};
	for (const type of Object.values(LinkType)) {
		if (!Object.prototype.hasOwnProperty.call(data.templates, type)) {
			continue;
		}

		const value = data.templates[type];
		const template = typeof value === 'string' ? value.trim() : null;
		if (
			template === null ||
			template.length > MAX_TEMPLATE_LENGTH ||
			CONTROL_CHARS_REGEX.test(template)
		) {
			return fail(
				`Template "${type}" must be a single line of text up to ${MAX_TEMPLATE_LENGTH} characters.`
			);
		}

		templates[type] = template;
	}

	if (Object.keys(templates).length === 0) {
		return fail('The file does not contain any templates.');
	}

	return { ok: true, templates };
}
