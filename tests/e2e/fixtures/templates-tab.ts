import { Locator, Page } from '@playwright/test';

/** Names on the link type switch of the Templates tab. */
export type LinkTypeName = 'PR' | 'Issue' | 'Discussion' | 'Run';

/**
 * The template editor (a text box that shows placeholders as chips) with this accessible name.
 * Only the selected link type's editor is visible, so the others are not found until selected.
 * Its `data-value` attribute holds the template text without the guard characters.
 *
 * @param options - Settings page.
 * @param label - Accessible name of the editor, e.g. "Pull Request link template".
 */
export function templateEditor(options: Page, label: string): Locator {
	return options.getByRole('textbox', { name: label, exact: true });
}

/**
 * The whole field of one template: editor, placeholder buttons, preview and "Saved".
 *
 * @param options - Settings page.
 * @param label - Accessible name of the field's editor.
 */
export function templateField(options: Page, label: string): Locator {
	return options.locator('.hyperfriend-field').filter({
		has: templateEditor(options, label),
	});
}

/**
 * Selects a link type on the switch of the Templates tab.
 *
 * @param options - Settings page.
 * @param name - Short name of the link type.
 */
export async function selectLinkType(
	options: Page,
	name: LinkTypeName
): Promise<void> {
	await options
		.getByRole('group', { name: 'Link type' })
		.getByRole('button', {
			// A customized template adds " (customized)" to the name
			name: new RegExp(`^${name}( \\(customized\\))?$`),
		})
		.click();
}
