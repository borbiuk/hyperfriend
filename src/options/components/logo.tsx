/** Colors of the 3x3 grid, row by row (same as design/icon/hyperfriend-icon.svg). */
const CELL_COLORS = [
	'#0FBF3E',
	'#D2D9D4',
	'#5FED83',
	'#08872B',
	'#0FBF3E',
	'#08872B',
	'#5FED83',
	'#D2D9D4',
	'#0FBF3E',
];

interface LogoProps {
	size?: number;
}

/**
 * The extension icon as an inline SVG (crisp at any size). Decorative.
 */
export function Logo({ size = 24 }: LogoProps) {
	return (
		<svg
			viewBox="0 0 128 128"
			width={size}
			height={size}
			aria-hidden="true"
			focusable="false"
		>
			{CELL_COLORS.map((color, index) => (
				<rect
					key={index}
					x={16 + (index % 3) * 34}
					y={16 + Math.floor(index / 3) * 34}
					width={28}
					height={28}
					rx={7}
					fill={color}
				/>
			))}
		</svg>
	);
}
