/**
 * Identifiers of the quick filter chips shown above Pull Request lists.
 * The string values are stable and used in the stored config and in settings files.
 */
export enum FilterChipId {
	/** Pull Requests that ask the user for a review personally */
	NeedsYourReview = 'needs-your-review',

	/** Pull Requests that ask a GitHub team of the user, and not the user personally, for a review */
	NeedsTeamReview = 'needs-team-review',

	/** Pull Requests opened by the user */
	CreatedByYou = 'created-by-you',

	/** Approved Pull Requests of the user with passing checks */
	ReadyToMerge = 'ready-to-merge',

	/** Three states: all Pull Requests, without drafts, only drafts */
	Drafts = 'drafts',

	/** Approved Pull Requests */
	Approved = 'approved',

	/** The checks of the Pull Request passed */
	CiPassing = 'ci-passing',

	/** The checks of the Pull Request failed */
	CiFailing = 'ci-failing',

	/** The checks of the Pull Request are still running */
	CiRunning = 'ci-running',

	/** Pull Requests of the user that wait for a review */
	MyWaiting = 'my-waiting',

	/** Pull Requests of the user with requested changes */
	MyChanges = 'my-changes',

	/** Pull Requests nobody was asked to review */
	NoReviewer = 'no-reviewer',

	/** Pull Requests the user is involved in */
	Involves = 'involves',

	/** Pull Requests that mention the user */
	Mentions = 'mentions',

	/** Pull Requests the user already reviewed */
	ReviewedByMe = 'reviewed-by-me',

	/** Pull Requests the user did not review yet */
	NotReviewedByMe = 'not-reviewed-by-me',
}

/**
 * State of the drafts chip.
 */
export type DraftState = 'any' | 'hide' | 'only';

/**
 * Which chips remember their state across Pull Request lists.
 */
export interface FiltersStickyModel {
	/** Apply the last chosen drafts state to every list */
	drafts: boolean;
}

/**
 * Names of the colours a chip can have. They map to the theme colours of GitHub (and of the popup),
 * so a chip stays readable in the light, dark and high-contrast themes.
 */
export type ChipColour =
	| 'default'
	| 'green'
	| 'red'
	| 'yellow'
	| 'blue'
	| 'purple'
	| 'orange'
	| 'gray';

/**
 * A chip made by the user.
 */
export interface CustomChipModel {
	/** `custom-` and 8 lower case letters or digits; generated once, never reused */
	id: string;

	/** Text of the chip, one line */
	label: string;

	/** Octicon name from CUSTOM_CHIP_ICONS */
	icon: string;

	/** Colour of the icon and of the chip while it is on */
	colour: ChipColour;

	/** GitHub search words the chip adds, for example `label:bug -label:wip` */
	query: string;
}

/**
 * Settings of the quick filter bar.
 */
export interface FiltersModel {
	/** Ids of the chips shown in the bar (catalog ids and custom ids), in display order */
	chips: string[];

	/** Chips that remember their state */
	sticky: FiltersStickyModel;

	/** Chips made by the user, shown or not */
	custom: CustomChipModel[];
}

/**
 * How a chip changes the search query.
 * `tokens` chips add fixed tokens, the `drafts` chip has three states.
 */
export type FilterChipKind = 'tokens' | 'drafts';

/**
 * Definition of one chip of the catalog.
 */
export interface FilterChipModel {
	/** A FilterChipId value, or the id of a custom chip */
	id: string;
	kind: FilterChipKind;

	/** Short text of the chip */
	label: string;

	/** One line for the popup */
	description: string;

	/** Octicon name shown before the label (16 px) */
	icon: string;

	/** Colour of the icon and of the chip while it is on */
	colour: ChipColour;

	/** Search tokens the chip adds (empty for `drafts`) */
	tokens: string[];

	/**
	 * Keys of the tokens the chip replaces when it turns on (see getTokenKey in filter-query.ts),
	 * so conflicting chips replace each other.
	 */
	facets: string[];

	/** Exact tokens (ignoring case) the chip replaces when it turns on, next to the `facets` */
	facetTokens: string[];
}

/**
 * Part of the filter settings to write or import: any of the parts, and the sticky settings one by one.
 */
export type FiltersUpdate = Partial<Omit<FiltersModel, 'sticky'>> & {
	sticky?: Partial<FiltersStickyModel>;
};
