import { BaseStyles, ThemeProvider } from '@primer/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@primer/primitives/dist/css/functional/themes/light.css';
import '@primer/primitives/dist/css/functional/themes/dark.css';
import '@primer/primitives/dist/css/primitives.css';
import { OptionsApp } from './components/options-app';

const container = document.getElementById('root');

/** Shown instead of a blank popup when rendering failed. */
const RENDER_ERROR_TEXT =
	'The settings could not be shown. Close the popup and open it again.';

if (container) {
	createRoot(container, {
		// React removes the whole tree after an uncaught render error: say so instead of a blank page
		onUncaughtError: (error) => {
			console.error(
				'[Hyperfriend] The settings page failed to render.',
				error
			);
			const message = document.createElement('p');
			message.setAttribute('role', 'alert');
			message.style.margin = '16px';
			message.textContent = RENDER_ERROR_TEXT;
			container.replaceChildren(message);
		},
	}).render(
		<StrictMode>
			<ThemeProvider colorMode="auto">
				<BaseStyles>
					<OptionsApp />
				</BaseStyles>
			</ThemeProvider>
		</StrictMode>
	);
}
