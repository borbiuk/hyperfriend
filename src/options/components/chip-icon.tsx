import { ChipColour } from '@shared/models';

import { FILTER_CHIP_ICONS } from '../constants/filter-chip-icons';

interface ChipIconProps {
	/** Octicon name (see CUSTOM_CHIP_ICONS) */
	name: string;

	/** Colour name; `default` keeps the text colour */
	colour?: ChipColour;
}

/**
 * The icon of a chip, 16 px, drawn with the text colour or with the colour of the chip.
 */
export function ChipIcon({ name, colour = 'default' }: ChipIconProps) {
	const Icon = FILTER_CHIP_ICONS[name];
	if (!Icon) {
		return null;
	}

	return (
		<span
			className="hyperfriend-chip-icon"
			data-colour={colour === 'default' ? undefined : colour}
			aria-hidden="true"
		>
			<Icon size={16} />
		</span>
	);
}
