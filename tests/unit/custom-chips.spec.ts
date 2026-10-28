import { expect, test } from '@playwright/test';
import {
	CHIP_COLOURS,
	CUSTOM_CHIP_ICONS,
	FILTER_CHIPS,
	MAX_CUSTOM_CHIPS,
	MAX_CUSTOM_LABEL_LENGTH,
	MAX_CUSTOM_QUERY_LENGTH,
} from '@shared/constants';
import { CustomChipModel, FiltersModel } from '@shared/models';
import { cloneDefaultConfig, toStoredConfig } from '@shared/services';
import {
	deriveFacets,
	joinQuery,
	normalizeCustomChips,
	parseCustomLabel,
	parseCustomQuery,
	resolveChips,
	toggleChip,
	tokenizeQuery,
	validateCustomChip,
} from '@shared/utils';

import { FILTER_ICONS } from '../../src/content/icons/octicons';

/** A valid custom chip the tests change one field of */
const BUGS: CustomChipModel = {
	id: 'custom-abcd1234',
	label: 'Bugs',
	icon: 'bug',
	colour: 'red',
	query: 'label:bug -label:wip',
};

/**
 * Clicks a custom chip on a query text and returns the new query text.
 *
 * @param query - Filter of the chip.
 * @param text - Search text before the click.
 */
function click(query: string, text: string): string {
	const [chip] = resolveChips({
		chips: [BUGS.id],
		sticky: { drafts: false },
		custom: [{ ...BUGS, query }],
	});

	return joinQuery(toggleChip(chip, tokenizeQuery(text)));
}

test.describe('parseCustomQuery', () => {
	test('should split the words and clean the spaces', () => {
		expect(parseCustomQuery('  label:bug    -label:wip ')).toEqual({
			ok: true,
			tokens: ['label:bug', '-label:wip'],
			query: 'label:bug -label:wip',
		});
	});

	test('should keep a quoted value as one word', () => {
		expect(parseCustomQuery('label:"good first issue" fix')).toEqual({
			ok: true,
			tokens: ['label:"good first issue"', 'fix'],
			query: 'label:"good first issue" fix',
		});
	});

	const ERRORS: { title: string; text: unknown; error: string }[] = [
		{
			title: 'an empty text',
			text: '   ',
			error: 'Enter at least one search word.',
		},
		{
			title: 'something that is not text',
			text: 5,
			error: 'Enter at least one search word.',
		},
		{
			title: 'a line break',
			text: 'label:a\nlabel:b',
			error: 'Use a single line of text.',
		},
		{
			title: 'an open quotation mark',
			text: 'label:"good first',
			error: 'Close the quotation mark.',
		},
		{
			title: 'more than 10 words',
			text: Array.from({ length: 11 }, (_, i) => `label:l${i}`).join(' '),
			error: 'Use up to 10 search words.',
		},
		{
			title: '201 characters',
			text: `label:${'a'.repeat(195)}`,
			error: 'Use up to 200 characters.',
		},
		{
			title: 'a line separator',
			text: 'label:a\u2028label:b',
			error: 'Use a single line of text.',
		},
		{
			title: 'a bidirectional control',
			text: 'label:a\u202Eb',
			error: 'Use a single line of text.',
		},
		{
			title: 'a group',
			text: '(label:a OR label:b)',
			error: 'Groups (parentheses, OR, AND, NOT) are not supported.',
		},
		{
			title: 'a bare OR',
			text: 'label:a OR label:b',
			error: 'Groups (parentheses, OR, AND, NOT) are not supported.',
		},
		{
			title: 'is:pr',
			text: 'IS:PR label:bug',
			error: 'The list is already Pull Requests; leave out is:pr.',
		},
	];

	for (const c of ERRORS) {
		test(`should reject ${c.title}`, () => {
			expect(parseCustomQuery(c.text)).toEqual({
				ok: false,
				error: c.error,
			});
		});
	}

	test('should count the bytes of letters outside the English alphabet', () => {
		expect(parseCustomQuery(`label:${'é'.repeat(97)}`).ok).toBe(true);
		expect(parseCustomQuery(`label:${'é'.repeat(98)}`)).toEqual({
			ok: false,
			error: 'Use a shorter filter (up to 200 bytes: letters outside the English alphabet count double).',
		});
	});

	test('should count a quotation mark and a backslash twice, as the JSON of the storage does', () => {
		expect(parseCustomQuery(`a:${'\\'.repeat(98)}`).ok).toBe(true);
		expect(parseCustomQuery(`a:${'\\'.repeat(100)}`)).toEqual({
			ok: false,
			error: 'Use a shorter filter (up to 200 bytes: letters outside the English alphabet count double).',
		});
	});

	test('should add a word typed twice once, ignoring case', () => {
		expect(parseCustomQuery('label:bug LABEL:BUG label:wip')).toEqual({
			ok: true,
			tokens: ['label:bug', 'label:wip'],
			query: 'label:bug label:wip',
		});
	});

	test('should accept exactly 200 characters and 10 words', () => {
		const ten = Array.from({ length: 10 }, (_, i) => `l:${i}`).join(' ');
		const long = `label:${'a'.repeat(MAX_CUSTOM_QUERY_LENGTH - 6)}`;

		expect(parseCustomQuery(ten).ok).toBe(true);
		expect(parseCustomQuery(long).ok).toBe(true);
	});
});

test.describe('parseCustomLabel', () => {
	test('should trim the name', () => {
		expect(parseCustomLabel('  Bugs ')).toBe('Bugs');
	});

	for (const [title, text] of [
		['an empty name', '  '],
		['a name over 30 characters', 'x'.repeat(MAX_CUSTOM_LABEL_LENGTH + 1)],
		['a tab', 'a\tb'],
		['something that is not text', 7],
	] as const) {
		test(`should reject ${title}`, () => {
			expect(parseCustomLabel(text)).toBeNull();
		});
	}

	test('should count a quotation mark twice in the name', () => {
		expect(parseCustomLabel('"'.repeat(24))).toBe('"'.repeat(24));
		expect(parseCustomLabel('"'.repeat(25))).toBeNull();
	});

	test('should count the bytes of the name too', () => {
		expect(parseCustomLabel('é'.repeat(24))).toBe('é'.repeat(24));
		expect(parseCustomLabel('é'.repeat(25))).toBeNull();
	});

	test('should accept a name of exactly 30 characters', () => {
		expect(parseCustomLabel('x'.repeat(MAX_CUSTOM_LABEL_LENGTH))).toBe(
			'x'.repeat(MAX_CUSTOM_LABEL_LENGTH)
		);
	});
});

test.describe('validateCustomChip', () => {
	test('should clean a valid chip', () => {
		expect(
			validateCustomChip({
				...BUGS,
				label: ' Bugs ',
				query: ' label:bug  -label:wip',
			})
		).toEqual({ ok: true, chip: BUGS });
	});

	test('should accept every icon and colour of the lists', () => {
		for (const icon of CUSTOM_CHIP_ICONS) {
			expect(validateCustomChip({ ...BUGS, icon }).ok).toBe(true);
		}
		for (const colour of CHIP_COLOURS) {
			expect(validateCustomChip({ ...BUGS, colour }).ok).toBe(true);
		}
	});

	for (const [title, chip] of [
		['a list', []],
		['null', null],
		['an id of the wrong shape', { ...BUGS, id: 'custom-ABCD1234' }],
		['an unknown icon', { ...BUGS, icon: 'unicorn' }],
		['an unknown colour', { ...BUGS, colour: 'pink' }],
		['an empty filter', { ...BUGS, query: '' }],
		['an empty name', { ...BUGS, label: '' }],
	] as const) {
		test(`should reject ${title}`, () => {
			expect(validateCustomChip(chip).ok).toBe(false);
		});
	}
});

test.describe('normalizeCustomChips', () => {
	test('should keep valid chips, drop invalid ones and repeated ids', () => {
		expect(
			normalizeCustomChips([
				BUGS,
				{ ...BUGS, label: 'Same id' },
				{ ...BUGS, id: 'custom-zzzz9999', icon: 'Unicorn!' },
				{ ...BUGS, id: 'custom-wxyz0000', label: 'Other' },
			])
		).toEqual([BUGS, { ...BUGS, id: 'custom-wxyz0000', label: 'Other' }]);
	});

	test('should keep the first 10 chips', () => {
		const many = Array.from({ length: 15 }, (_, i) => ({
			...BUGS,
			id: `custom-abcd${String(1000 + i)}`,
		}));

		expect(normalizeCustomChips(many)?.map((chip) => chip.id)).toEqual(
			many.slice(0, MAX_CUSTOM_CHIPS).map((chip) => chip.id)
		);
	});

	test('should keep a chip with an icon or colour of a later version, so it is not lost on the next write', () => {
		expect(
			normalizeCustomChips([
				{ ...BUGS, icon: 'telescope', colour: 'teal' },
			])
		).toEqual([{ ...BUGS, icon: 'telescope', colour: 'default' }]);
	});

	test('should return null for something that is not a list', () => {
		expect(normalizeCustomChips('chips')).toBeNull();
	});
});

test.describe('deriveFacets', () => {
	test('should make a single-value qualifier replace its own key', () => {
		expect(deriveFacets(['status:failure'])).toEqual({
			facets: ['status'],
			facetTokens: [],
		});
	});

	test('should make a who-word replace the whole group', () => {
		expect(deriveFacets(['reviewed-by:@me'])).toEqual({
			facets: [
				'author',
				'review-requested',
				'user-review-requested',
				'-user-review-requested',
				'reviewed-by',
				'-reviewed-by',
				'involves',
				'mentions',
			],
			facetTokens: [],
		});
	});

	test('should make a state word replace the other state words', () => {
		expect(deriveFacets(['is:merged'])).toEqual({
			facets: [],
			facetTokens: [
				'is:open',
				'is:closed',
				'is:merged',
				'is:unmerged',
				'state:open',
				'state:closed',
				'state:merged',
			],
		});
	});

	test('should add label words next to the rest', () => {
		expect(deriveFacets(['label:bug', '-label:wip', 'repo:a/b'])).toEqual({
			facets: [],
			facetTokens: [],
		});
	});
});

test.describe('a custom chip in the search text', () => {
	test('should add its words', () => {
		expect(click('label:bug -label:wip', 'is:pr state:open')).toBe(
			'is:pr state:open label:bug -label:wip'
		);
	});

	test('should remove its words when it is on', () => {
		expect(
			click(
				'label:bug -label:wip',
				'is:pr state:open label:bug -label:wip'
			)
		).toBe('is:pr state:open');
	});

	test('should replace another base branch', () => {
		expect(click('base:main', 'is:pr base:develop')).toBe(
			'is:pr base:main'
		);
	});

	test('should replace state:open when it asks for merged ones', () => {
		expect(click('is:merged', 'is:pr state:open label:x')).toBe(
			'is:pr label:x is:merged'
		);
	});

	test('should replace author:@me with another who-word', () => {
		expect(click('reviewed-by:@me', 'is:pr author:@me')).toBe(
			'is:pr reviewed-by:@me'
		);
	});

	test('should only add its words to a grouped query', () => {
		expect(click('base:main', 'is:pr (base:a OR base:b)')).toBe(
			'is:pr (base:a OR base:b) base:main'
		);
	});
});

test.describe('resolveChips', () => {
	const FILTERS: FiltersModel = {
		chips: ['ci-passing', BUGS.id, 'drafts', 'custom-missing0', 'unicorns'],
		sticky: { drafts: false },
		custom: [BUGS, { ...BUGS, id: 'custom-hidden00', label: 'Hidden' }],
	};

	test('should follow the order of the list, skip ids no chip has and leave out a custom chip that is not listed', () => {
		expect(resolveChips(FILTERS).map((chip) => chip.id)).toEqual([
			'ci-passing',
			BUGS.id,
			'drafts',
		]);
	});

	test('should give a custom chip the shape of a catalog chip', () => {
		const chip = resolveChips(FILTERS)[1];

		expect(chip).toMatchObject({
			id: BUGS.id,
			kind: 'tokens',
			label: 'Bugs',
			icon: 'bug',
			colour: 'red',
			tokens: ['label:bug', '-label:wip'],
			facets: [],
			facetTokens: [],
		});
	});
});

test.describe('lists', () => {
	test('should have path data in the content script for every icon of the lists', () => {
		const missing = [
			...CUSTOM_CHIP_ICONS,
			...FILTER_CHIPS.map((chip) => chip.icon),
		].filter((name) => !FILTER_ICONS[name]);

		expect(missing).toEqual([]);
	});

	test('should list every icon of the catalog among the icons a user can pick', () => {
		for (const chip of FILTER_CHIPS) {
			expect(CUSTOM_CHIP_ICONS).toContain(chip.icon);
		}
	});
});

test('should keep a config with templates of 500 characters and 10 custom chips of 30 and 200 characters under the storage quota', () => {
	const config = cloneDefaultConfig();
	config.templates = {
		'pull-request': 'x'.repeat(500),
		issue: 'x'.repeat(500),
		discussion: 'x'.repeat(500),
		'workflow-run': 'x'.repeat(500),
	};
	config.filters.custom = Array.from(
		{ length: MAX_CUSTOM_CHIPS },
		(_, i) => ({
			id: `custom-abcd${String(1000 + i)}`,
			label: 'x'.repeat(MAX_CUSTOM_LABEL_LENGTH),
			icon: 'git-pull-request-draft',
			colour: 'orange' as const,
			query: `label:${'a'.repeat(MAX_CUSTOM_QUERY_LENGTH - 6)}`,
		})
	);
	config.filters.chips = [
		...FILTER_CHIPS.map((chip) => chip.id),
		...config.filters.custom.map((chip) => chip.id),
	];

	// chrome.storage.sync counts the key and the JSON text of an item; 8,192 bytes is the limit.
	// Templates with many escapes or non-English text are larger: the config service refuses a write
	// over the limit (see its spec), and these limits keep the usual case far under it.
	const bytes = new TextEncoder().encode(
		`hyperfriend-config${JSON.stringify(toStoredConfig(config))}`
	).length;

	expect(bytes, `the case takes ${bytes} bytes`).toBeLessThan(8_192);
});
