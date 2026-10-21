import { Locator, Page } from '@playwright/test';
import { ShortcutBindingModel, ShortcutType } from '@shared/models';

import { DEFAULT_STORED_CONFIG } from './fixtures/defaults';
import { expect, test } from './fixtures/extension';

// Shortcuts tab of the settings popup: the keys button, recording a new combination, the
// validation messages, Reset, the on/off switch and the screen reader announcements.

const DEFAULT_KEYS = ['Shift', 'KeyC'];
/** A free combination: no modifier missing, not reserved, not used by GitHub */
const CUSTOM_KEYS = ['Shift', 'KeyK'];

/** Visible key labels on macOS and elsewhere (`<kbd>` chips) */
const KEY_LABELS: Record<string, { mac: string; other: string }> = {
	Shift: { mac: '⇧', other: 'Shift' },
	KeyC: { mac: 'C', other: 'C' },
	KeyK: { mac: 'K', other: 'K' },
};

interface PlatformTexts {
	/** `<kbd>` labels of a shortcut */
	keyLabels: (keys: string[]) => string[];
	/** Error for a key pressed without a modifier */
	noModifierError: string;
}

/**
 * Platform-dependent texts of the Shortcuts tab, chosen by the platform the page reports
 * (the same navigator fields the popup reads), so the expectations hold on macOS and Linux.
 *
 * @param options - Settings page.
 */
async function platformTexts(options: Page): Promise<PlatformTexts> {
	const isMac = await options.evaluate(() => {
		const nav = navigator as Navigator & {
			userAgentData?: { platform?: string };
		};
		return /mac|iphone|ipad|ipod/i.test(
			nav.userAgentData?.platform || nav.platform || nav.userAgent
		);
	});

	return {
		keyLabels: (keys) =>
			keys.map((key) => KEY_LABELS[key][isMac ? 'mac' : 'other']),
		noModifierError: isMac
			? 'Add Shift, Option, Control or Command to the shortcut.'
			: 'Add Shift, Alt, Ctrl or Win to the shortcut.',
	};
}

/**
 * The stored config with the Copy link binding replaced.
 *
 * @param binding - Expected binding.
 */
function storedWithBinding(binding: ShortcutBindingModel): unknown {
	return {
		...DEFAULT_STORED_CONFIG,
		shortcuts: { [ShortcutType.CopyLink]: binding },
	};
}

/**
 * The Shortcuts tab of the settings page.
 *
 * @param options - Settings page.
 */
function shortcutsPanel(options: Page): Locator {
	return options.getByRole('tabpanel', { name: 'Shortcuts' });
}

/**
 * The Copy link keys button; its name changes while it records.
 *
 * @param options - Settings page.
 */
function keysButton(options: Page): Locator {
	return shortcutsPanel(options).getByRole('button', {
		name: /^(Change Copy link shortcut, currently|Press a shortcut for Copy link)/,
	});
}

/**
 * The on/off switch of the Copy link shortcut.
 *
 * @param options - Settings page.
 */
function enabledSwitch(options: Page): Locator {
	return shortcutsPanel(options).getByRole('button', {
		name: 'Copy link shortcut',
		exact: true,
	});
}

/**
 * The polite live region of the Copy link row (recording started, saved, reset).
 *
 * @param options - Settings page.
 */
function announcement(options: Page): Locator {
	return shortcutsPanel(options).locator('[aria-live="polite"]');
}

/**
 * Opens the Shortcuts tab and waits until the keys button shows the stored shortcut.
 *
 * @param openOptions - The openOptions fixture.
 * @param spokenKeys - Spoken name of the stored shortcut, e.g. `Shift C`.
 */
async function openShortcuts(
	openOptions: (hash?: string) => Promise<Page>,
	spokenKeys: string
): Promise<Page> {
	const options = await openOptions('#shortcuts');
	await expect(keysButton(options)).toHaveAccessibleName(
		`Change Copy link shortcut, currently ${spokenKeys}`
	);
	return options;
}

/**
 * Starts recording and waits for the recording state.
 *
 * @param options - Settings page.
 */
async function startRecording(options: Page): Promise<void> {
	await keysButton(options).click();
	await expect(keysButton(options)).toHaveAccessibleName(
		'Press a shortcut for Copy link, or Escape to cancel'
	);
}

test('should show Shift C on the keys button by default', async ({
	openOptions,
}) => {
	const options = await openShortcuts(openOptions, 'Shift C');
	const { keyLabels } = await platformTexts(options);

	await expect(keysButton(options).locator('kbd')).toHaveText(
		keyLabels(DEFAULT_KEYS)
	);
	await expect(enabledSwitch(options)).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('should save a recorded shortcut and show it after a reload', async ({
	openOptions,
	storage,
}) => {
	const options = await openShortcuts(openOptions, 'Shift C');
	const { keyLabels } = await platformTexts(options);

	await test.step('recording is announced', async () => {
		await startRecording(options);
		await expect(keysButton(options)).toHaveText('Press a shortcut…');
		await expect(announcement(options)).toHaveText('Press a shortcut…');
	});

	await options.keyboard.press('Shift+KeyK');

	await test.step('the keys button shows the new shortcut and announces it', async () => {
		await expect(keysButton(options)).toHaveAccessibleName(
			'Change Copy link shortcut, currently Shift K'
		);
		await expect(keysButton(options).locator('kbd')).toHaveText(
			keyLabels(CUSTOM_KEYS)
		);
		await expect(announcement(options)).toHaveText(
			'Shortcut saved: Shift K'
		);
	});

	await test.step('the keys are stored', async () => {
		await expect
			.poll(() => storage.getConfig())
			.toEqual(storedWithBinding({ keys: CUSTOM_KEYS, enabled: true }));
	});

	await test.step('the keys button shows the shortcut after a reload', async () => {
		await options.reload();
		await expect(keysButton(options)).toHaveAccessibleName(
			'Change Copy link shortcut, currently Shift K'
		);
	});
});

test('should cancel recording with Escape and keep the shortcut', async ({
	openOptions,
	storage,
}) => {
	const options = await openShortcuts(openOptions, 'Shift C');
	await startRecording(options);

	await options.keyboard.press('Escape');

	await expect(keysButton(options)).toHaveAccessibleName(
		'Change Copy link shortcut, currently Shift C'
	);
	await expect(shortcutsPanel(options).getByRole('alert')).toHaveText('');
	expect(await storage.getConfig()).toBeUndefined();
});

for (const { title, press, error } of [
	{ title: 'a key without a modifier', press: 'KeyK', error: null },
	{
		title: 'a browser shortcut (Ctrl/Cmd+C)',
		press: 'ControlOrMeta+KeyC',
		error: 'This shortcut is used by the browser.',
	},
]) {
	test(`should reject ${title} and keep recording`, async ({
		openOptions,
		storage,
	}) => {
		const options = await openShortcuts(openOptions, 'Shift C');
		const { noModifierError } = await platformTexts(options);
		await startRecording(options);

		await options.keyboard.press(press);

		await expect(shortcutsPanel(options).getByRole('alert')).toHaveText(
			error ?? noModifierError
		);
		await expect(keysButton(options)).toHaveAccessibleName(
			'Press a shortcut for Copy link, or Escape to cancel'
		);
		// The error path returns before any write: the message above shows the key was handled
		expect(await storage.getConfig()).toBeUndefined();
	});
}

for (const { title, press, keys, spoken, warning } of [
	{
		title: 'a GitHub shortcut (Shift+/)',
		press: 'Shift+Slash',
		keys: ['Shift', 'Slash'],
		spoken: 'Shift /',
		warning: 'GitHub also uses this shortcut.',
	},
	{
		title: 'a scrolling shortcut (Shift+ArrowDown)',
		press: 'Shift+ArrowDown',
		keys: ['Shift', 'ArrowDown'],
		spoken: 'Shift Down arrow',
		warning: 'This shortcut is used for scrolling or selecting text.',
	},
]) {
	test(`should save ${title} with a warning`, async ({
		openOptions,
		storage,
	}) => {
		const options = await openShortcuts(openOptions, 'Shift C');
		await startRecording(options);

		await options.keyboard.press(press);

		await expect(shortcutsPanel(options).getByRole('status')).toHaveText(
			warning
		);
		await expect(keysButton(options)).toHaveAccessibleName(
			`Change Copy link shortcut, currently ${spoken}`
		);
		await expect
			.poll(() => storage.getConfig())
			.toEqual(storedWithBinding({ keys, enabled: true }));
	});
}

test('should show Reset only after the keys differ from the default', async ({
	openOptions,
}) => {
	const options = await openShortcuts(openOptions, 'Shift C');
	const reset = shortcutsPanel(options).getByRole('button', {
		name: 'Reset Copy link shortcut to Shift C',
	});
	// The keys button above shows the loaded default, so the absence is real
	await expect(reset).toBeHidden();
	await startRecording(options);

	await options.keyboard.press('Shift+KeyK');

	await expect(reset).toBeVisible();
});

test('should restore Shift C with Reset', async ({ openOptions, storage }) => {
	await storage.seedConfig({
		shortcuts: {
			[ShortcutType.CopyLink]: { keys: CUSTOM_KEYS, enabled: true },
		},
	});
	const options = await openShortcuts(openOptions, 'Shift K');
	const { keyLabels } = await platformTexts(options);
	const reset = shortcutsPanel(options).getByRole('button', {
		name: 'Reset Copy link shortcut to Shift C',
	});

	await reset.click();

	await test.step('the keys button shows Shift C and keeps the focus', async () => {
		await expect(keysButton(options)).toHaveAccessibleName(
			'Change Copy link shortcut, currently Shift C'
		);
		await expect(keysButton(options).locator('kbd')).toHaveText(
			keyLabels(DEFAULT_KEYS)
		);
		await expect(keysButton(options)).toBeFocused();
		await expect(reset).toBeHidden();
		await expect(announcement(options)).toHaveText(
			'Shortcut reset to Shift C'
		);
	});

	await test.step('the default keys are stored', async () => {
		await expect
			.poll(() => storage.getConfig())
			.toEqual(storedWithBinding({ keys: DEFAULT_KEYS, enabled: true }));
	});
});

test('should disable the shortcut with the switch and keep it disabled after a reload', async ({
	openOptions,
	storage,
}) => {
	await storage.seedConfig({
		shortcuts: {
			[ShortcutType.CopyLink]: { keys: CUSTOM_KEYS, enabled: true },
		},
	});
	const options = await openShortcuts(openOptions, 'Shift K');
	await expect(enabledSwitch(options)).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await enabledSwitch(options).click();

	await expect
		.poll(() => storage.getConfig())
		.toEqual(storedWithBinding({ keys: CUSTOM_KEYS, enabled: false }));

	await test.step('after a reload the switch is off and the keys are kept', async () => {
		await options.reload();
		await expect(keysButton(options)).toHaveAccessibleName(
			'Change Copy link shortcut, currently Shift K'
		);
		await expect(enabledSwitch(options)).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});
});

test('should enable a disabled shortcut again with its custom keys', async ({
	openOptions,
	storage,
}) => {
	await storage.seedConfig({
		shortcuts: {
			[ShortcutType.CopyLink]: { keys: CUSTOM_KEYS, enabled: false },
		},
	});
	const options = await openShortcuts(openOptions, 'Shift K');
	await expect(enabledSwitch(options)).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	await enabledSwitch(options).click();

	await expect
		.poll(() => storage.getConfig())
		.toEqual(storedWithBinding({ keys: CUSTOM_KEYS, enabled: true }));

	await test.step('after a reload the switch is on with the custom keys', async () => {
		await options.reload();
		await expect(keysButton(options)).toHaveAccessibleName(
			'Change Copy link shortcut, currently Shift K'
		);
		await expect(enabledSwitch(options)).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});
});
