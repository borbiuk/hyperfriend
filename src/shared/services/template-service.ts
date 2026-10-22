import { DEFAULT_CONFIG, LEGACY_DEFAULT_TEMPLATES } from '@shared/constants';
import { LinkTargetModel, LinkType } from '@shared/models';

/** Matches `{{name}}` tokens, allowing whitespace inside the braces. */
const PLACEHOLDER_REGEX = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Separator of list values such as labels and assignees */
const LIST_SEPARATOR = ', ';

/**
 * Builds the placeholder values available for the given target.
 * Besides the advertised placeholders, the generic aliases `number` and `title` work for every type
 * (for a workflow run `number` is the run number).
 * A placeholder whose data the page did not show is empty.
 */
function getPlaceholderValues(target: LinkTargetModel): Record<string, string> {
	const number = String(target.number);
	const values: Record<string, string> = {
		number,
		title: target.title,
		owner: target.owner,
		repo: target.repo,
		url: target.url,
	};

	if (target.type === LinkType.WorkflowRun) {
		values.run_number = number;
		values.run_name = target.title;
		values.workflow = target.workflow ?? '';
		values.branch = target.branch ?? '';
		values.status = target.status ?? '';
		return values;
	}

	// A workflow run is not a numbered item of the repository, so it has no `#number` reference
	values.ref = `${target.owner}/${target.repo}#${number}`;
	values.author = target.author ?? '';

	if (target.type === LinkType.Discussion) {
		values.discussion_number = number;
		values.discussion_name = target.title;
		values.category = target.category ?? '';
		return values;
	}

	values.state = target.state ?? '';
	values.labels = (target.labels ?? []).join(LIST_SEPARATOR);
	values.assignees = (target.assignees ?? []).join(LIST_SEPARATOR);
	values.milestone = target.milestone ?? '';

	if (target.type === LinkType.PullRequest) {
		values.pr_number = number;
		values.pr_name = target.title;
		values.head_branch = target.headBranch ?? '';
		values.base_branch = target.baseBranch ?? '';
	}

	if (target.type === LinkType.Issue) {
		values.issue_number = number;
		values.issue_name = target.title;
	}

	return values;
}

/**
 * Rendered link text split around the part that becomes the hyperlink.
 * `before + link + after` is the full text, with the template's square brackets removed.
 */
export interface TemplateParts {
	/** Plain text before the link (no leading whitespace) */
	before: string;

	/** Text of the hyperlink; the whole text when the template marks no link part */
	link: string;

	/** Plain text after the link (no trailing whitespace) */
	after: string;
}

/**
 * Template split at its link segment, with `\[` / `\]` escapes resolved.
 * `link` is `null` when the template has no complete `[...]` segment.
 */
interface TemplateSegments {
	before: string;
	link: string | null;
	after: string;
}

/**
 * Finds the link segment of a template: the first unescaped `[` and the next unescaped
 * `]` after it. Later brackets and a `[` inside the segment are literal; an unclosed `[`
 * is literal too. `\[` and `\]` become literal brackets; any other backslash stays.
 */
function splitTemplate(template: string): TemplateSegments {
	let before = '';
	let link = '';
	let after = '';
	// 0: before the segment, 1: inside it, 2: after it
	let state = 0;

	for (let i = 0; i < template.length; i++) {
		let char = template[i];
		let escaped = false;
		if (
			char === '\\' &&
			(template[i + 1] === '[' || template[i + 1] === ']')
		) {
			char = template[i + 1];
			escaped = true;
			i++;
		}

		if (!escaped && state === 0 && char === '[') {
			state = 1;
			continue;
		}

		if (!escaped && state === 1 && char === ']') {
			state = 2;
			continue;
		}

		if (state === 0) {
			before += char;
		} else if (state === 1) {
			link += char;
		} else {
			after += char;
		}
	}

	if (state === 1) {
		// Unclosed `[`: no segment, the bracket is plain text.
		return { before: `${before}[${link}`, link: null, after: '' };
	}

	if (state === 0) {
		return { before, link: null, after: '' };
	}

	return { before, link, after };
}

/**
 * Replaces the `{{placeholder}}` tokens of a template piece; unknown ones are left as-is.
 */
function replacePlaceholders(
	text: string,
	values: Record<string, string>
): string {
	return text.replace(PLACEHOLDER_REGEX, (token: string, name: string) => {
		if (Object.prototype.hasOwnProperty.call(values, name)) {
			return values[name];
		}

		return token;
	});
}

/**
 * Fills the placeholders of a template and splits the result around the link part.
 * Whitespace at the edges of the link part moves into `before` / `after`, so the link
 * never starts or ends with a space; the ends of the whole text are trimmed.
 */
function renderParts(
	source: string,
	values: Record<string, string>
): TemplateParts {
	const segments = splitTemplate(source);
	const before = replacePlaceholders(segments.before, values);
	const link =
		segments.link === null
			? ''
			: replacePlaceholders(segments.link, values);
	const after = replacePlaceholders(segments.after, values);

	const trimmedLink = link.trim();
	if (trimmedLink === '') {
		return {
			before: '',
			link: `${before}${link}${after}`.trim(),
			after: '',
		};
	}

	const leading = link.slice(0, link.length - link.trimStart().length);
	const trailing = link.slice(link.trimEnd().length);

	return {
		before: `${before}${leading}`.trimStart(),
		link: trimmedLink,
		after: `${trailing}${after}`.trimEnd(),
	};
}

/**
 * Renders a link text template for the given target, split into the text before the
 * link, the link text and the text after it.
 *
 * The link part is marked with square brackets in the template (`[PR {{pr_number}}]:
 * {{pr_name}}`); brackets are read before placeholders are filled, so brackets in titles
 * never matter. Without a segment, or when it renders to whitespace only, the whole text
 * is the link. Unknown placeholders are left as-is. An empty or whitespace-only template,
 * or one that renders to whitespace only, falls back to the default template for
 * `target.type`. The link never starts or ends with whitespace; the start and the end of
 * the whole text are trimmed, inner spacing is kept.
 *
 * @param template - Template with `{{placeholder}}` tokens and an optional `[link]` part.
 * @param target - The item (Pull Request, Issue, Discussion or workflow run) to render.
 * @returns Plain text parts (NOT HTML-escaped).
 */
export function renderTemplateParts(
	template: string,
	target: LinkTargetModel
): TemplateParts {
	const fallback = DEFAULT_CONFIG.templates[target.type];
	const source = template && template.trim() !== '' ? template : fallback;
	const values = getPlaceholderValues(target);

	const parts = renderParts(source, values);
	if (parts.link === '' && source !== fallback) {
		return renderParts(fallback, values);
	}

	return parts;
}

/**
 * Converts a template written before the `[link]` syntax (settings of 1.x / 2.0.0, files
 * of schema 1 and 2), where brackets and backslashes were plain text.
 * The old default becomes the new default; in any other template every `[` and `]` is
 * escaped. A backslash stays as is: before an escaped bracket it is followed by another
 * backslash, so the parser keeps it, and the text renders exactly as in 2.0.0.
 *
 * @param template - Old template.
 * @param type - Link type of the template.
 * @returns The template in the current syntax.
 */
export function convertLegacyTemplate(
	template: string,
	type: LinkType
): string {
	if (template === LEGACY_DEFAULT_TEMPLATES[type]) {
		return DEFAULT_CONFIG.templates[type];
	}

	return template.replace(/[[\]]/g, '\\$&');
}

/**
 * Renders a link text template for the given target as one string (the link brackets
 * removed). See renderTemplateParts for the rules.
 *
 * @param template - Template with `{{placeholder}}` tokens and an optional `[link]` part.
 * @param target - The item (Pull Request, Issue, Discussion or workflow run) to render.
 * @returns Trimmed plain text (NOT HTML-escaped).
 */
export function renderTemplate(
	template: string,
	target: LinkTargetModel
): string {
	const parts = renderTemplateParts(template, target);
	return `${parts.before}${parts.link}${parts.after}`;
}
