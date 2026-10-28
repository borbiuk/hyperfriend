import { expect, test } from '@playwright/test';
import { FILTER_CHIPS } from '@shared/constants';
import { FilterChipId, FilterChipModel, FiltersModel } from '@shared/models';
import {
	applyRememberedState,
	buildSearch,
	getDraftState,
	isChipActive,
	joinQuery,
	nextDraftState,
	readQuery,
	setDraftState,
	tokenizeQuery,
	toggleChip,
} from '@shared/utils';

/** Settings of the filter bar the tests start from */
const FILTERS: FiltersModel = {
	chips: [FilterChipId.Drafts, FilterChipId.CiPassing],
	sticky: { drafts: true },
	custom: [],
};

/**
 * Finds a chip of the catalog.
 *
 * @param id - Chip to find.
 */
function chip(id: FilterChipId): FilterChipModel {
	const found = FILTER_CHIPS.find((item) => item.id === id);
	if (!found) {
		throw new Error(`Chip ${id} is not in the catalog.`);
	}

	return found;
}

/**
 * Clicks a chip on a query text and returns the new query text.
 *
 * @param id - Chip to click.
 * @param query - Query before the click.
 */
function click(id: FilterChipId, query: string): string {
	return joinQuery(toggleChip(chip(id), tokenizeQuery(query)));
}

test.describe('tokenizeQuery', () => {
	const CASES: { title: string; query: string; expected: string[] }[] = [
		{
			title: 'should split a query at spaces',
			query: 'is:pr state:open author:@me',
			expected: ['is:pr', 'state:open', 'author:@me'],
		},
		{
			title: 'should keep a quoted value with spaces as one token',
			query: 'is:pr label:"good first issue" fix',
			expected: ['is:pr', 'label:"good first issue"', 'fix'],
		},
		{
			title: 'should ignore repeated and edge whitespace',
			query: '  is:pr   -is:draft ',
			expected: ['is:pr', '-is:draft'],
		},
		{
			title: 'should return no tokens for an empty query',
			query: '',
			expected: [],
		},
	];

	for (const c of CASES) {
		test(c.title, () => {
			expect(tokenizeQuery(c.query)).toEqual(c.expected);
		});
	}
});

test.describe('drafts', () => {
	const STATE_CASES: { query: string; expected: 'any' | 'hide' | 'only' }[] =
		[
			{ query: 'is:pr', expected: 'any' },
			{ query: 'is:pr -is:draft', expected: 'hide' },
			{ query: 'is:pr draft:false', expected: 'hide' },
			{ query: 'is:pr is:draft', expected: 'only' },
			{ query: 'is:pr DRAFT:true', expected: 'only' },
		];

	for (const c of STATE_CASES) {
		test(`should read the draft state "${c.expected}" from "${c.query}"`, () => {
			expect(getDraftState(tokenizeQuery(c.query))).toBe(c.expected);
		});
	}

	test('should replace the draft tokens when the state is set', () => {
		expect(
			joinQuery(setDraftState(tokenizeQuery('is:pr draft:false'), 'only'))
		).toBe('is:pr is:draft');
		expect(
			joinQuery(setDraftState(tokenizeQuery('is:pr is:draft'), 'any'))
		).toBe('is:pr');
	});

	for (const [from, to] of [
		['any', 'hide'],
		['hide', 'only'],
		['only', 'any'],
	] as const) {
		test(`should go from "${from}" to "${to}" when the chip is clicked`, () => {
			expect(nextDraftState(from)).toBe(to);
		});
	}

	test('should cycle the states with clicks on the drafts chip', () => {
		const hidden = click(FilterChipId.Drafts, 'is:pr state:open');
		const only = click(FilterChipId.Drafts, hidden);
		const all = click(FilterChipId.Drafts, only);

		expect([hidden, only, all]).toEqual([
			'is:pr state:open -is:draft',
			'is:pr state:open is:draft',
			'is:pr state:open',
		]);
	});

	test('should call the drafts chip active when drafts are hidden or the only ones', () => {
		const drafts = chip(FilterChipId.Drafts);

		expect(isChipActive(drafts, tokenizeQuery('is:pr'))).toBe(false);
		expect(isChipActive(drafts, tokenizeQuery('is:pr -is:draft'))).toBe(
			true
		);
		expect(isChipActive(drafts, tokenizeQuery('is:pr is:draft'))).toBe(
			true
		);
	});
});

test.describe('toggleChip', () => {
	test('should add the tokens of an inactive chip', () => {
		expect(click(FilterChipId.NeedsYourReview, 'is:pr state:open')).toBe(
			'is:pr state:open user-review-requested:@me'
		);
	});

	test('should remove the tokens of an active chip', () => {
		expect(
			click(
				FilterChipId.NeedsYourReview,
				'is:pr state:open user-review-requested:@me'
			)
		).toBe('is:pr state:open');
	});

	test('should ask for a team review as review-requested without a personal request', () => {
		expect(click(FilterChipId.NeedsTeamReview, 'is:pr state:open')).toBe(
			'is:pr state:open review-requested:@me -user-review-requested:@me'
		);
	});

	test('should call the team chip active only with both of its tokens', () => {
		const team = chip(FilterChipId.NeedsTeamReview);

		expect(
			isChipActive(team, tokenizeQuery('is:pr review-requested:@me'))
		).toBe(false);
		expect(
			isChipActive(
				team,
				tokenizeQuery(
					'is:pr review-requested:@me -user-review-requested:@me'
				)
			)
		).toBe(true);
	});

	test('should switch between the personal and the team review chips', () => {
		const personal = click(FilterChipId.NeedsYourReview, 'is:pr');

		expect(click(FilterChipId.NeedsTeamReview, personal)).toBe(
			'is:pr review-requested:@me -user-review-requested:@me'
		);
		expect(
			click(
				FilterChipId.NeedsYourReview,
				'is:pr review-requested:@me -user-review-requested:@me'
			)
		).toBe('is:pr user-review-requested:@me');
	});

	test('should replace author:@me when a chip about a review request is turned on', () => {
		expect(
			click(
				FilterChipId.NeedsYourReview,
				'is:open is:pr author:@me archived:false'
			)
		).toBe('is:open is:pr archived:false user-review-requested:@me');
	});

	test('should add author:@me for Created by you and replace a review request', () => {
		expect(
			click(FilterChipId.CreatedByYou, 'is:pr user-review-requested:@me')
		).toBe('is:pr author:@me');
	});

	test('should replace the role and review tokens when one of my Pull Request chips is turned on', () => {
		expect(
			click(
				FilterChipId.MyChanges,
				'is:pr user-review-requested:@me review:required'
			)
		).toBe('is:pr author:@me review:changes_requested');
	});

	test('should replace one CI state with another', () => {
		expect(click(FilterChipId.CiFailing, 'is:pr status:success')).toBe(
			'is:pr status:failure'
		);
	});

	test('should add every token of Ready to merge', () => {
		expect(click(FilterChipId.ReadyToMerge, 'is:pr state:open')).toBe(
			'is:pr state:open author:@me review:approved status:success'
		);
	});

	test('should replace review:required when Approved is turned on', () => {
		expect(click(FilterChipId.Approved, 'is:pr review:required')).toBe(
			'is:pr review:approved'
		);
	});

	test('should call a chip with several tokens active only when all its tokens are there', () => {
		const ready = chip(FilterChipId.ReadyToMerge);

		expect(
			isChipActive(ready, tokenizeQuery('author:@me review:approved'))
		).toBe(false);
		expect(
			isChipActive(
				ready,
				tokenizeQuery('author:@me review:approved status:success')
			)
		).toBe(true);
	});

	test('should match tokens ignoring case', () => {
		expect(
			isChipActive(
				chip(FilterChipId.NeedsYourReview),
				tokenizeQuery('User-Review-Requested:@ME')
			)
		).toBe(true);
	});

	test('should keep free text and unrelated tokens', () => {
		expect(
			click(FilterChipId.CiPassing, 'is:pr label:"good first issue" fix')
		).toBe('is:pr label:"good first issue" fix status:success');
	});

	test('should be undone by a second click', () => {
		const once = click(FilterChipId.NoReviewer, 'is:pr state:open');

		expect(click(FilterChipId.NoReviewer, once)).toBe('is:pr state:open');
	});
});

test.describe('grouped queries', () => {
	test('should only add the tokens of a chip when the query has a group', () => {
		expect(
			click(
				FilterChipId.CiPassing,
				'is:pr (is:draft OR status:failure) status:pending'
			)
		).toBe(
			'is:pr (is:draft OR status:failure) status:pending status:success'
		);
	});

	test('should still remove the tokens of an active chip from a grouped query', () => {
		expect(
			click(FilterChipId.CiPassing, 'is:pr (a OR b) status:success')
		).toBe('is:pr (a OR b)');
	});
});

test.describe('applyRememberedState', () => {
	test('should add the remembered draft state to a query without a draft token', () => {
		expect(
			applyRememberedState(
				tokenizeQuery('is:pr state:open'),
				{ drafts: 'hide' },
				FILTERS
			)
		).toEqual(['is:pr', 'state:open', '-is:draft']);
	});

	test('should add the state "only drafts" too', () => {
		expect(
			applyRememberedState(
				tokenizeQuery('is:pr'),
				{ drafts: 'only' },
				FILTERS
			)
		).toEqual(['is:pr', 'is:draft']);
	});

	test('should leave a query that already has a draft token', () => {
		expect(
			applyRememberedState(
				tokenizeQuery('is:pr is:draft'),
				{ drafts: 'hide' },
				FILTERS
			)
		).toBeNull();
	});

	test('should do nothing when the sticky setting is off', () => {
		expect(
			applyRememberedState(
				tokenizeQuery('is:pr'),
				{ drafts: 'hide' },
				{ ...FILTERS, sticky: { drafts: false } }
			)
		).toBeNull();
	});

	test('should do nothing when the Drafts chip is not shown', () => {
		expect(
			applyRememberedState(
				tokenizeQuery('is:pr'),
				{ drafts: 'hide' },
				{ ...FILTERS, chips: [FilterChipId.CiPassing] }
			)
		).toBeNull();
	});

	test('should do nothing when the remembered state is to show everything', () => {
		expect(
			applyRememberedState(
				tokenizeQuery('is:pr'),
				{ drafts: 'any' },
				FILTERS
			)
		).toBeNull();
	});
});

test.describe('query string', () => {
	test('should read the q parameter', () => {
		expect(readQuery('?q=is%3Apr+state%3Aopen&page=2')).toBe(
			'is:pr state:open'
		);
	});

	test('should return null when the URL has no q', () => {
		expect(readQuery('')).toBeNull();
		expect(readQuery('?page=2')).toBeNull();
	});

	test('should set q, keep other parameters and drop the page', () => {
		expect(
			buildSearch('?q=is%3Apr&page=3&sort=updated', [
				'is:pr',
				'-is:draft',
				'author:@me',
			])
		).toBe('?q=is%3Apr+-is%3Adraft+author%3A%40me&sort=updated');
	});

	test('should add q to a URL without a query string', () => {
		expect(buildSearch('', ['is:pr'])).toBe('?q=is%3Apr');
	});
});
