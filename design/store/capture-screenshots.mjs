/*
	Captures the Chrome Web Store screenshots (1280 x 800 JPEG) into design/store/screenshots/.

	How it works: starts headless Google Chrome with the DevTools protocol.
	- Pages (1-2): opens real github.com pages of this repository, injects the built content
	  script (dist/content.js, exactly what the extension runs) and drives hover/click to show
	  the tooltip states. They need open Pull Requests #1 to #3.
	- Popup (3-5): serves the repository over a local http server and opens
	  design/store/popup-screenshot.html, which shows the built dist/options.html on a branded
	  background, one popup tab per screenshot.

	Requirements: `npm run build` first, Google Chrome, ImageMagick (`magick`), network access.
	Usage: node design/store/capture-screenshots.mjs [pages|popup]   (both when omitted)
*/

import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(STORE_DIR, '../..');
const OUT_DIR = join(STORE_DIR, 'screenshots');
const CHROME =
	process.env.CHROME ||
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const HTTP_PORT = 9334;
const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;
const REPO = 'https://github.com/borbiuk/hyperfriend';
const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Opens a new tab over the DevTools HTTP endpoint, retrying while Chrome is still starting. */
async function waitForDevTools() {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await fetch(
				`http://127.0.0.1:${PORT}/json/new?about:blank`,
				{
					method: 'PUT',
				}
			);
		} catch (error) {
			if (attempt >= 50) {
				throw error;
			}
			await sleep(300);
		}
	}
}

/** Minimal Chrome DevTools Protocol client over the built-in WebSocket. */
async function connect() {
	const response = await waitForDevTools();
	const { webSocketDebuggerUrl } = await response.json();
	const socket = new WebSocket(webSocketDebuggerUrl);
	await new Promise((done) => socket.addEventListener('open', done));

	let nextId = 0;
	const pending = new Map();
	const waiters = [];
	socket.addEventListener('message', (event) => {
		const message = JSON.parse(event.data);
		if (message.id) {
			const call = pending.get(message.id);
			pending.delete(message.id);
			if (message.error) {
				call.reject(new Error(message.error.message));
				return;
			}
			call.resolve(message.result);
			return;
		}
		for (const waiter of waiters.filter(
			(w) => w.method === message.method
		)) {
			waiters.splice(waiters.indexOf(waiter), 1);
			waiter.resolve(message.params);
		}
	});

	const send = (method, params = {}) =>
		new Promise((done, reject) => {
			nextId += 1;
			pending.set(nextId, { resolve: done, reject });
			socket.send(JSON.stringify({ id: nextId, method, params }));
		});
	const once = (method) =>
		new Promise((done) => waiters.push({ method, resolve: done }));

	return { send, once, close: () => socket.close() };
}

async function evaluate(cdp, expression) {
	const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
		expression,
		awaitPromise: true,
		returnByValue: true,
	});
	if (exceptionDetails) {
		throw new Error(exceptionDetails.text);
	}
	return result.value;
}

async function open(cdp, url, scheme) {
	await cdp.send('Emulation.setEmulatedMedia', {
		features: [
			{ name: 'prefers-color-scheme', value: scheme },
			// The tooltip fades in with a CSS animation that headless capture may not advance
			{ name: 'prefers-reduced-motion', value: 'reduce' },
		],
	});
	const loaded = cdp.once('Page.loadEventFired');
	await cdp.send('Page.navigate', { url });
	await loaded;
	await sleep(2500);
}

/** Injects the built content script; the clipboard is stubbed because headless Chrome has no clipboard access. */
async function injectExtension(cdp) {
	const contentScript = readFileSync(
		join(ROOT_DIR, 'dist/content.js'),
		'utf8'
	);
	await evaluate(
		cdp,
		'navigator.clipboard.write = () => Promise.resolve(); undefined'
	);
	await evaluate(cdp, `${contentScript}\nundefined`);
	await sleep(1200);
}

async function center(cdp, selector, index = 0) {
	return evaluate(
		cdp,
		`(() => {
			const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
			const r = el.getBoundingClientRect();
			return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		})()`
	);
}

async function hover(cdp, point) {
	await cdp.send('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		x: point.x,
		y: point.y,
	});
	await sleep(400);
}

async function click(cdp, point) {
	await hover(cdp, point);
	for (const type of ['mousePressed', 'mouseReleased']) {
		await cdp.send('Input.dispatchMouseEvent', {
			type,
			x: point.x,
			y: point.y,
			button: 'left',
			clickCount: 1,
		});
	}
	await sleep(250);
}

async function capture(cdp, file) {
	const { data } = await cdp.send('Page.captureScreenshot', {
		format: 'png',
	});
	writeFileSync(file, Buffer.from(data, 'base64'));
}

function toJpeg(source, target) {
	execFileSync('magick', [
		source,
		'-resize',
		`${WIDTH}x${HEIGHT}!`,
		'-strip',
		'-quality',
		'92',
		target,
	]);
	console.log(`'${target}' was created.`);
}

const CONTENT_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.json': 'application/json',
};

/** Serves the repository read-only, so the screenshot page and the popup iframe share an origin. */
function serveRepository() {
	const server = createServer((request, response) => {
		const path = normalize(
			decodeURIComponent(new URL(request.url, 'http://x').pathname)
		);
		const file = join(ROOT_DIR, path);
		if (!file.startsWith(ROOT_DIR)) {
			response.writeHead(403).end();
			return;
		}
		try {
			const body = readFileSync(file);
			response.writeHead(200, {
				'Content-Type':
					CONTENT_TYPES[extname(file)] || 'application/octet-stream',
			});
			response.end(body);
		} catch {
			response.writeHead(404).end();
		}
	});
	return new Promise((done) =>
		server.listen(HTTP_PORT, '127.0.0.1', () => done(server))
	);
}

/** Popup screenshots: one popup tab per image. */
const POPUP_SHOTS = [
	{ file: '3-popup-templates-light.jpg', tab: 'templates', scheme: 'light' },
	{ file: '4-popup-shortcuts-dark.jpg', tab: 'shortcuts', scheme: 'dark' },
	{ file: '5-popup-general-light.jpg', tab: 'general', scheme: 'light' },
];

async function capturePopup(cdp, tmp) {
	const server = await serveRepository();
	try {
		for (const { file, tab, scheme } of POPUP_SHOTS) {
			await open(
				cdp,
				`http://127.0.0.1:${HTTP_PORT}/design/store/popup-screenshot.html?tab=${tab}&theme=${scheme}`,
				scheme
			);
			await evaluate(cdp, 'window.fitPopup()');
			await sleep(300);
			await capture(cdp, join(tmp, `${tab}.png`));
			toJpeg(join(tmp, `${tab}.png`), join(OUT_DIR, file));
		}
	} finally {
		server.close();
	}
}

async function main() {
	mkdirSync(OUT_DIR, { recursive: true });
	const tmp = mkdtempSync(join(tmpdir(), 'hyperfriend-shots-'));
	const chrome = spawn(
		CHROME,
		[
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars',
			// Scale set at launch: a device-metrics override makes captureScreenshot fire `mouseleave`,
			// which hides the hover tooltip
			`--force-device-scale-factor=${SCALE}`,
			`--remote-debugging-port=${PORT}`,
			`--user-data-dir=${join(tmp, 'profile')}`,
			'--allow-file-access-from-files',
			`--window-size=${WIDTH},${HEIGHT}`,
			'about:blank',
		],
		{ stdio: 'ignore' }
	);

	try {
		const cdp = await connect();
		await cdp.send('Page.enable');
		await cdp.send('Network.setUserAgentOverride', {
			userAgent: USER_AGENT,
		});

		const mode = process.argv[2];
		if (mode !== 'popup') {
			await capturePages(cdp, tmp);
		}
		if (mode !== 'pages') {
			await capturePopup(cdp, tmp);
		}

		cdp.close();
	} finally {
		chrome.kill();
		await sleep(500);
		rmSync(tmp, { recursive: true, force: true });
	}
}

/** Pull Request screenshots: they need open demo Pull Requests #1 to #3. */
async function capturePages(cdp, tmp) {
	// 1. Pull request list (light): avatars + copy buttons, tooltip on hover.
	await open(cdp, `${REPO}/pulls`, 'light');
	await injectExtension(cdp);
	await hover(cdp, await center(cdp, '[data-hyperfriend="copy-button"]', 1));
	await capture(cdp, join(tmp, '1.png'));
	toJpeg(join(tmp, '1.png'), join(OUT_DIR, '1-pull-request-list-light.jpg'));

	// 2. Pull request page (dark): "Copied!" after a click on the title button.
	await open(cdp, `${REPO}/pull/2`, 'dark');
	await injectExtension(cdp);
	await click(cdp, await center(cdp, '[data-hyperfriend="copy-button"]'));
	await capture(cdp, join(tmp, '2.png'));
	toJpeg(join(tmp, '2.png'), join(OUT_DIR, '2-pull-request-page-dark.jpg'));
}

await main();
