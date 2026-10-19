/*
	Octicons by GitHub (MIT License): https://github.com/primer/octicons
	Path data of the 16px icons, rendered with DOM APIs so the content script needs neither React nor innerHTML.
*/

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * A 16x16 Octicon.
 */
export interface Octicon {
	/** Octicon name, e.g. 'copy' */
	name: string;

	/** SVG path data (`d` attributes) */
	paths: string[];
}

/** Octicon `copy` (16) */
export const COPY_ICON: Octicon = {
	name: 'copy',
	paths: [
		'M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z',
		'M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z',
	],
};

/** Octicon `check` (16) */
export const CHECK_ICON: Octicon = {
	name: 'check',
	paths: [
		'M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z',
	],
};

/** Octicon `x` (16) */
export const X_ICON: Octicon = {
	name: 'x',
	paths: [
		'M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z',
	],
};

/**
 * Creates a decorative (aria-hidden) 16x16 SVG element for the icon.
 *
 * @param icon - Icon to render.
 * @returns The SVG element.
 */
export function createOcticon(icon: Octicon): SVGSVGElement {
	const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
	svg.setAttribute('class', `hyperfriend-icon hyperfriend-icon-${icon.name}`);
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('width', '16');
	svg.setAttribute('height', '16');
	svg.setAttribute('fill', 'currentColor');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('focusable', 'false');

	for (const d of icon.paths) {
		const path = document.createElementNS(SVG_NAMESPACE, 'path');
		path.setAttribute('d', d);
		svg.appendChild(path);
	}

	return svg;
}
