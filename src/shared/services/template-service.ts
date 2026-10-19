import { DEFAULT_CONFIG } from '@shared/constants';
import { LinkTargetModel, LinkType } from '@shared/models';

/** Matches `{{name}}` tokens, allowing whitespace inside the braces. */
const PLACEHOLDER_REGEX = /\{\{\s*([a-z_]+)\s*\}\}/g;

/**
 * Builds the placeholder values available for the given target.
 * Besides the advertised placeholders, the generic aliases `number` and `title` work for every type.
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

	if (target.type === LinkType.PullRequest) {
		values.pr_number = number;
		values.pr_name = target.title;
	}

	if (target.type === LinkType.Issue) {
		values.issue_number = number;
		values.issue_name = target.title;
	}

	return values;
}

/**
 * Renders a link text template for the given target.
 * Unknown placeholders (including those of the other link type) are left as-is.
 * An empty or whitespace-only template falls back to the default template for `target.type`.
 *
 * @param template - Template with `{{placeholder}}` tokens.
 * @param target - The Pull Request or Issue to render.
 * @returns Trimmed plain text (NOT HTML-escaped).
 */
export function renderTemplate(
	template: string,
	target: LinkTargetModel
): string {
	const source =
		template && template.trim() !== ''
			? template
			: DEFAULT_CONFIG.templates[target.type];
	const values = getPlaceholderValues(target);

	return source
		.replace(PLACEHOLDER_REGEX, (token: string, name: string) => {
			if (Object.prototype.hasOwnProperty.call(values, name)) {
				return values[name];
			}

			return token;
		})
		.trim();
}
