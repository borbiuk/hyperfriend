import { LinkType } from '@shared/models';

/**
 * Zero-width space. The editor puts it next to a placeholder chip so the caret has a place
 * to stand; it is never part of a template.
 */
export const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

/** A part of a template: plain text or one `{{placeholder}}` shown as a chip. */
export interface TemplateSegment {
	kind: 'text' | 'token';
	/** The text; for a token, the placeholder name without braces. */
	value: string;
}

/** Placeholder written exactly as `{{name}}`; other spellings stay plain text. */
const TOKEN_REGEX = /\{\{([a-z_]+)\}\}/g;

/**
 * Splits a template into plain text and known `{{placeholder}}` tokens.
 * Unknown names (and the hidden `{{number}}` / `{{title}}` aliases) stay plain text.
 *
 * @param template - Template text.
 * @param known - Placeholder names that become chips.
 */
export function splitTemplateTokens(
	template: string,
	known: readonly string[]
): TemplateSegment[] {
	const segments: TemplateSegment[] = [];
	let last = 0;

	for (const match of template.matchAll(TOKEN_REGEX)) {
		if (!known.includes(match[1])) {
			continue;
		}

		if (match.index > last) {
			segments.push({
				kind: 'text',
				value: template.slice(last, match.index),
			});
		}
		segments.push({ kind: 'token', value: match[1] });
		last = match.index + match[0].length;
	}

	if (last < template.length) {
		segments.push({ kind: 'text', value: template.slice(last) });
	}

	return segments;
}

/** Position of a placeholder token in a template text. */
export interface TokenRange {
	/** Index of the first `{`. */
	start: number;
	/** Index after the last `}`. */
	end: number;
}

/**
 * Finds where the known `{{placeholder}}` tokens are in a template.
 *
 * @param template - Template text.
 * @param known - Placeholder names that count as tokens.
 */
export function findTokenRanges(
	template: string,
	known: readonly string[]
): TokenRange[] {
	const ranges: TokenRange[] = [];
	let index = 0;

	for (const segment of splitTemplateTokens(template, known)) {
		const length =
			segment.kind === 'token'
				? segment.value.length + 4
				: segment.value.length;
		if (segment.kind === 'token') {
			ranges.push({ start: index, end: index + length });
		}
		index += length;
	}

	return ranges;
}

/** Position of the link segment in a template text. */
export interface LinkRange {
	/** Index of the opening `[`. */
	start: number;
	/** Index after the closing `]`. */
	end: number;
}

/**
 * Finds the link segment the same way the copy code does: the first unescaped `[` and the
 * next unescaped `]` after it. `\[` and `\]` are literal brackets; an unclosed `[` is text.
 *
 * @param template - Template text.
 * @returns The range, or `null` when the template has no complete `[...]` segment.
 */
export function findLinkRange(template: string): LinkRange | null {
	let start = -1;

	for (let i = 0; i < template.length; i++) {
		const char = template[i];
		if (
			char === '\\' &&
			(template[i + 1] === '[' || template[i + 1] === ']')
		) {
			i++;
			continue;
		}

		if (start === -1 && char === '[') {
			start = i;
			continue;
		}

		if (start !== -1 && char === ']') {
			return { start, end: i + 1 };
		}
	}

	return null;
}

/** Placeholders shown as quick buttons under the editor, per link type. */
export const QUICK_PLACEHOLDERS: Record<LinkType, string[]> = {
	[LinkType.PullRequest]: ['author', 'labels', 'state', 'head_branch', 'url'],
	[LinkType.Issue]: ['author', 'labels', 'state', 'milestone', 'url'],
	[LinkType.Discussion]: ['author', 'category', 'owner', 'repo', 'url'],
	[LinkType.WorkflowRun]: ['branch', 'status', 'owner', 'repo', 'url'],
};

/** A titled group of placeholder names for the "all placeholders" menu. */
export interface PlaceholderGroup {
	title: string;
	names: string[];
}

/** Group of a placeholder name; the first matching rule wins. */
const PLACEHOLDER_GROUPS: { title: string; test: (name: string) => boolean }[] =
	[
		{
			title: 'Item',
			test: (name) =>
				/(_number|_name)$/.test(name) ||
				name === 'ref' ||
				name === 'workflow',
		},
		{
			title: 'Repository',
			test: (name) =>
				name === 'owner' || name === 'repo' || name === 'url',
		},
		{
			title: 'Branches',
			test: (name) => name.endsWith('branch'),
		},
	];

/** Title of the group for placeholders that match no rule. */
const OTHER_GROUP_TITLE = 'Details';

/**
 * Sorts placeholder names into titled groups, keeping the order of the names inside a group.
 * Groups come in a fixed order and empty ones are left out.
 *
 * @param names - Placeholder names of one link type.
 */
export function groupPlaceholders(
	names: readonly string[]
): PlaceholderGroup[] {
	const titles = [
		...PLACEHOLDER_GROUPS.map((group) => group.title),
		OTHER_GROUP_TITLE,
	];
	const groups = new Map<string, string[]>(
		titles.map((title) => [title, []])
	);

	for (const name of names) {
		const rule = PLACEHOLDER_GROUPS.find((group) => group.test(name));
		groups.get(rule?.title ?? OTHER_GROUP_TITLE)?.push(name);
	}

	return titles
		.map((title) => ({ title, names: groups.get(title) ?? [] }))
		.filter((group) => group.names.length > 0);
}
