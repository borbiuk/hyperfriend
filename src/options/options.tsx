import { BaseStyles, ThemeProvider } from '@primer/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@primer/primitives/dist/css/functional/themes/light.css';
import '@primer/primitives/dist/css/functional/themes/dark.css';
import '@primer/primitives/dist/css/primitives.css';
import { OptionsApp } from './components/options-app';

const container = document.getElementById('root');

if (container) {
	createRoot(container).render(
		<StrictMode>
			<ThemeProvider colorMode="auto">
				<BaseStyles>
					<OptionsApp />
				</BaseStyles>
			</ThemeProvider>
		</StrictMode>
	);
}
