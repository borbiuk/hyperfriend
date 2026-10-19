import { MAX_TEMPLATE_LENGTH } from '@shared/constants';
import {
	ConfigModel,
	DisplayModel,
	LinkType,
	SettingsFileModel,
	SettingsImportModel,
	ShortcutBindingModel,
	ShortcutType,
} from '@shared/models';
import { normalizeShortcut, shortcutsEqual } from '@shared/utils';

import { cloneConfig } from './config-service';

/** File name used when exporting settings. */
export const SETTINGS_FILE_NAME = 'hyperfriend-settings.json';

/** Value of the `app` marker in a settings file. */
const SETTINGS_APP = 'hyperfriend';

/** Settings file format version written by this build (versions 1 and 2 are read). */
const SCHEMA_VERSION = 2;

/** Version 1 files (1.0.0) contain templates only. */
const SCHEMA_VERSION_TEMPLATES_ONLY = 1;

/** Maximum accepted input size in bytes (64 KB). */
const MAX_FILE_SIZE = 64 * 1024;

/** Control characters (including tabs and newlines), not allowed in templates. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

/** UTF-8 byte order mark as decoded into a string. */
const BOM = '\uFEFF';

/**
 * Result of parsing a settings file: either the settings to apply or a user-facing error.
 */
export type ParseSettingsResult =
	{ ok: true; settings: SettingsImportModel } | { ok: false; error: string };

/**
 * Serializes the config into the settings file format (schema version 2).
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
		shortcuts: cloneConfig(config).shortcuts,
		display: {
			authorAvatars: config.display.authorAvatars,
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
 * Returns true when the object has its own property `key`.
 */
function has(object: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(object, key);
}

/** Parsed part of a settings file, or a user-facing error. */
type SectionResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Reads the templates of known link types: each trimmed, a single line of at most
 * MAX_TEMPLATE_LENGTH characters.
 */
function parseTemplates(
	templates: Record<string, unknown>
): SectionResult<Partial<Record<LinkType, string>>> {
	const value: Partial<Record<LinkType, string>> = {};
	for (const type of Object.values(LinkType)) {
		if (!has(templates, type)) {
			continue;
		}

		const raw = templates[type];
		const template = typeof raw === 'string' ? raw.trim() : null;
		if (
			template === null ||
			template.length > MAX_TEMPLATE_LENGTH ||
			CONTROL_CHARS_REGEX.test(template)
		) {
			return {
				ok: false,
				error: `Template "${type}" must be a single line of text up to ${MAX_TEMPLATE_LENGTH} characters.`,
			};
		}

		value[type] = template;
	}

	return { ok: true, value };
}

/**
 * Reads the bindings of known shortcut types: each `{ keys, enabled }` with keys that
 * pass normalizeShortcut (stored normalized; browser-reserved combinations fail) and a
 * boolean `enabled`. Two enabled bindings with the same keys make the later one invalid.
 */
function parseShortcuts(
	shortcuts: Record<string, unknown>
): SectionResult<Partial<Record<ShortcutType, ShortcutBindingModel>>> {
	const value: Partial<Record<ShortcutType, ShortcutBindingModel>> = {};
	for (const type of Object.values(ShortcutType)) {
		if (!has(shortcuts, type)) {
			continue;
		}

		const invalid: SectionResult<never> = {
			ok: false,
			error: `Shortcut "${type}" is not valid.`,
		};
		const raw = shortcuts[type];
		if (!isObject(raw) || typeof raw.enabled !== 'boolean') {
			return invalid;
		}

		const keys = normalizeShortcut(raw.keys);
		if (!keys) {
			return invalid;
		}

		const duplicate =
			raw.enabled &&
			Object.values(value).some(
				(binding) =>
					binding.enabled && shortcutsEqual(binding.keys, keys)
			);
		if (duplicate) {
			return invalid;
		}

		value[type] = { keys, enabled: raw.enabled };
	}

	return { ok: true, value };
}

/**
 * Reads the known display preferences (booleans).
 */
function parseDisplay(
	display: Record<string, unknown>
): SectionResult<Partial<DisplayModel>> {
	const value: Partial<DisplayModel> = {};
	if (has(display, 'authorAvatars')) {
		if (typeof display.authorAvatars !== 'boolean') {
			return {
				ok: false,
				error: 'Display setting "authorAvatars" must be true or false.',
			};
		}

		value.authorAvatars = display.authorAvatars;
	}

	return { ok: true, value };
}

/**
 * Returns a failed parse result with the given message.
 */
function fail(error: string): ParseSettingsResult {
	return { ok: false, error };
}

/**
 * Parses a version 1 file: `templates` is required and must hold at least one template.
 */
function parseVersion1(data: Record<string, unknown>): ParseSettingsResult {
	if (!isObject(data.templates)) {
		return fail('The file does not contain any templates.');
	}

	const templates = parseTemplates(data.templates);
	if (!templates.ok) {
		return fail(templates.error);
	}

	if (Object.keys(templates.value).length === 0) {
		return fail('The file does not contain any templates.');
	}

	return { ok: true, settings: { templates: templates.value } };
}

/**
 * Parses a version 2 file: `templates`, `shortcuts` and `display` are each optional,
 * but a present section must be an object and at least one setting must be present.
 */
function parseVersion2(data: Record<string, unknown>): ParseSettingsResult {
	const settings: SettingsImportModel = {};
	let count = 0;

	for (const section of ['templates', 'shortcuts', 'display'] as const) {
		if (data[section] !== undefined && !isObject(data[section])) {
			return fail(`The "${section}" section of the file is not valid.`);
		}
	}

	if (isObject(data.templates)) {
		const templates = parseTemplates(data.templates);
		if (!templates.ok) {
			return fail(templates.error);
		}

		if (Object.keys(templates.value).length > 0) {
			settings.templates = templates.value;
			count += Object.keys(templates.value).length;
		}
	}

	if (isObject(data.shortcuts)) {
		const shortcuts = parseShortcuts(data.shortcuts);
		if (!shortcuts.ok) {
			return fail(shortcuts.error);
		}

		if (Object.keys(shortcuts.value).length > 0) {
			settings.shortcuts = shortcuts.value;
			count += Object.keys(shortcuts.value).length;
		}
	}

	if (isObject(data.display)) {
		const display = parseDisplay(data.display);
		if (!display.ok) {
			return fail(display.error);
		}

		if (Object.keys(display.value).length > 0) {
			settings.display = display.value;
			count += Object.keys(display.value).length;
		}
	}

	if (count === 0) {
		return fail('The file does not contain any settings.');
	}

	return { ok: true, settings };
}

/**
 * Parses and validates the text of a settings file (schema version 1 or 2).
 * Only known link types, shortcut types and display keys are read; unknown keys are
 * ignored. Templates are trimmed, shortcut keys normalized.
 *
 * @param text - File contents (a leading UTF-8 BOM is allowed).
 * @returns The settings found in the file, or a short user-facing error message.
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

	if (version === SCHEMA_VERSION_TEMPLATES_ONLY) {
		return parseVersion1(data);
	}

	if (version === SCHEMA_VERSION) {
		return parseVersion2(data);
	}

	return fail('This settings file has an unsupported version.');
}
