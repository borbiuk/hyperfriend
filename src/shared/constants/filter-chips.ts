import { ChipColour, FilterChipId, FilterChipModel } from '@shared/models';

/**
 * Token keys that say which user a Pull Request belongs to or is waiting for. A chip about "me"
 * replaces them.
 */
export const ROLE_FACETS = [
	'author',
	'review-requested',
	'user-review-requested',
	'-user-review-requested',
	'reviewed-by',
	'-reviewed-by',
	'involves',
	'mentions',
];

/**
 * Catalog of the quick filter chips, in display order. The names of the first four follow the
 * groups of the Reviews page of Linear.
 */
export const FILTER_CHIPS: readonly FilterChipModel[] = [
	{
		id: FilterChipId.NeedsYourReview,
		kind: 'tokens',
		label: 'Needs your review',
		description: 'Review requested from you personally',
		icon: 'eye',
		colour: 'default',
		tokens: ['user-review-requested:@me'],
		facets: ROLE_FACETS,
		facetTokens: [],
	},
	{
		id: FilterChipId.NeedsTeamReview,
		kind: 'tokens',
		label: 'Needs review from your GitHub team',
		description: 'Review requested from a team of yours, not from you',
		icon: 'people',
		colour: 'default',
		tokens: ['review-requested:@me', '-user-review-requested:@me'],
		facets: ROLE_FACETS,
		facetTokens: [],
	},
	{
		id: FilterChipId.CreatedByYou,
		kind: 'tokens',
		label: 'Created by you',
		description: 'Pull Requests you opened',
		icon: 'person',
		colour: 'default',
		tokens: ['author:@me'],
		facets: ROLE_FACETS,
		facetTokens: [],
	},
	{
		id: FilterChipId.ReadyToMerge,
		kind: 'tokens',
		label: 'Ready to merge',
		description: 'Your approved Pull Requests with passing checks',
		icon: 'git-merge',
		colour: 'default',
		tokens: ['author:@me', 'review:approved', 'status:success'],
		facets: [...ROLE_FACETS, 'review', 'status'],
		facetTokens: [],
	},
	{
		id: FilterChipId.Drafts,
		kind: 'drafts',
		label: 'Drafts',
		description: 'Switches between all, without drafts and only drafts',
		icon: 'git-pull-request-draft',
		colour: 'default',
		tokens: [],
		facets: [],
		facetTokens: [],
	},
	{
		id: FilterChipId.Approved,
		kind: 'tokens',
		label: 'Approved',
		description: 'Approved Pull Requests',
		icon: 'thumbsup',
		colour: 'default',
		tokens: ['review:approved'],
		facets: ['review'],
		facetTokens: [],
	},
	{
		id: FilterChipId.CiPassing,
		kind: 'tokens',
		label: 'CI passing',
		description: 'All checks passed',
		icon: 'check-circle',
		colour: 'green',
		tokens: ['status:success'],
		facets: ['status'],
		facetTokens: [],
	},
	{
		id: FilterChipId.CiFailing,
		kind: 'tokens',
		label: 'CI failing',
		description: 'At least one check failed',
		icon: 'x-circle',
		colour: 'red',
		tokens: ['status:failure'],
		facets: ['status'],
		facetTokens: [],
	},
	{
		id: FilterChipId.CiRunning,
		kind: 'tokens',
		label: 'CI running',
		description: 'Checks are still running',
		icon: 'clock',
		colour: 'yellow',
		tokens: ['status:pending'],
		facets: ['status'],
		facetTokens: [],
	},
	{
		id: FilterChipId.MyWaiting,
		kind: 'tokens',
		label: 'Mine, waiting for review',
		description: 'Your Pull Requests that wait for a review',
		icon: 'hourglass',
		colour: 'default',
		tokens: ['author:@me', 'review:required'],
		facets: [...ROLE_FACETS, 'review'],
		facetTokens: [],
	},
	{
		id: FilterChipId.MyChanges,
		kind: 'tokens',
		label: 'Mine, changes requested',
		description: 'Your Pull Requests with requested changes',
		icon: 'diff',
		colour: 'default',
		tokens: ['author:@me', 'review:changes_requested'],
		facets: [...ROLE_FACETS, 'review'],
		facetTokens: [],
	},
	{
		id: FilterChipId.NoReviewer,
		kind: 'tokens',
		label: 'No reviewer',
		description: 'Nobody was asked to review',
		icon: 'person-add',
		colour: 'default',
		tokens: ['review:none'],
		facets: ['review'],
		facetTokens: [],
	},
	{
		id: FilterChipId.Involves,
		kind: 'tokens',
		label: 'Involves me',
		description: 'You are the author, a reviewer or took part',
		icon: 'comment-discussion',
		colour: 'default',
		tokens: ['involves:@me'],
		facets: ROLE_FACETS,
		facetTokens: [],
	},
	{
		id: FilterChipId.Mentions,
		kind: 'tokens',
		label: 'Mentions me',
		description: 'You are mentioned',
		icon: 'mention',
		colour: 'default',
		tokens: ['mentions:@me'],
		facets: ROLE_FACETS,
		facetTokens: [],
	},
	{
		id: FilterChipId.ReviewedByMe,
		kind: 'tokens',
		label: 'Reviewed by me',
		description: 'You already reviewed them',
		icon: 'check',
		colour: 'default',
		tokens: ['reviewed-by:@me'],
		facets: ROLE_FACETS,
		facetTokens: [],
	},
	{
		id: FilterChipId.NotReviewedByMe,
		kind: 'tokens',
		label: 'Not reviewed by me',
		description: 'You did not review them yet',
		icon: 'eye-closed',
		colour: 'default',
		tokens: ['-reviewed-by:@me'],
		facets: ROLE_FACETS,
		facetTokens: [],
	},
];

/**
 * Chips shown by default: the main ones. The rest can be turned on in the popup.
 */
export const DEFAULT_FILTER_CHIPS: readonly FilterChipId[] = [
	FilterChipId.NeedsYourReview,
	FilterChipId.NeedsTeamReview,
	FilterChipId.CreatedByYou,
	FilterChipId.ReadyToMerge,
	FilterChipId.Drafts,
	FilterChipId.CiPassing,
	FilterChipId.CiFailing,
	FilterChipId.CiRunning,
	FilterChipId.MyWaiting,
	FilterChipId.MyChanges,
];

/**
 * The colours a chip can have, in the order the popup shows them.
 */
export const CHIP_COLOURS: readonly ChipColour[] = [
	'default',
	'green',
	'red',
	'yellow',
	'blue',
	'purple',
	'orange',
	'gray',
];

/**
 * The icons a custom chip can have (Octicon names, 16 px). The content script has their path data
 * (`FILTER_ICONS`) and the popup their components (`FILTER_CHIP_ICONS`).
 */
export const CUSTOM_CHIP_ICONS: readonly string[] = [
	'filter',
	'tag',
	'bug',
	'flame',
	'star',
	'bell',
	'alert',
	'shield',
	'zap',
	'rocket',
	'lock',
	'package',
	'code',
	'beaker',
	'book',
	'gear',
	'tools',
	'milestone',
	'git-branch',
	'git-pull-request',
	'git-pull-request-draft',
	'git-merge',
	'eye',
	'eye-closed',
	'people',
	'person',
	'person-add',
	'mention',
	'comment-discussion',
	'thumbsup',
	'check',
	'check-circle',
	'x-circle',
	'clock',
	'hourglass',
	'diff',
];

/** Most custom chips a user can make. */
export const MAX_CUSTOM_CHIPS = 10;

/** Longest custom chip name in characters. */
export const MAX_CUSTOM_LABEL_LENGTH = 30;

/** Longest custom chip filter in characters. */
export const MAX_CUSTOM_QUERY_LENGTH = 200;

/**
 * Longest custom chip filter in UTF-8 bytes, and longest custom chip name. `chrome.storage.sync`
 * allows 8,192 bytes per item and the whole config is one item, so the sizes are limited in bytes
 * too (a letter outside the English alphabet takes more than one).
 */
export const MAX_CUSTOM_QUERY_BYTES = 200;
export const MAX_CUSTOM_LABEL_BYTES = 48;

/** Most search words in a custom chip filter. */
export const MAX_CUSTOM_QUERY_TOKENS = 10;

/** The shape of the id of a custom chip. */
export const CUSTOM_CHIP_ID_REGEX = /^custom-[a-z0-9]{8}$/;
