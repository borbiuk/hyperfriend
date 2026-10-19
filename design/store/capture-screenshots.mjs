/*
	Captures the Chrome Web Store screenshots (1280 x 800 JPEG) into design/store/screenshots/.

	How it works: starts headless Google Chrome with the DevTools protocol, opens real
	github.com pages of this repository, injects the built content script (dist/content.js,
	exactly what the extension runs) and drives hover/click to show the tooltip states.
	The popup is rendered from dist/options.html and composited onto a page screenshot.

	Requirements: `npm run build` first, Google Chrome, ImageMagick (`magick`), network access.
	Usage: node design/store/capture-screenshots.mjs
*/

import { execFileSync, spawn } from 'node:child_process';
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(STORE_DIR, '../..');
const OUT_DIR = join(STORE_DIR, 'screenshots');
const CHROME =
	process.env.CHROME ||
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;
const REPO = 'https://github.com/borbiuk/hyperfriend';
const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Minimal Chrome DevTools Protocol client over the built-in WebSocket. */
async function connect() {
	const response = await fetch(
		`http://127.0.0.1:${PORT}/json/new?about:blank`,
		{ method: 'PUT' }
	);
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

/** Places the popup screenshot under the top-right corner, like an open toolbar popup. */
function composite(page, popup, border, target) {
	execFileSync('magick', [
		page,
		'-resize',
		`${WIDTH}x${HEIGHT}!`,
		'(',
		popup,
		'-resize',
		'50%',
		'-bordercolor',
		border,
		'-border',
		'1',
		'(',
		'+clone',
		'-background',
		'black',
		'-shadow',
		'40x12+0+6',
		')',
		'+swap',
		'-background',
		'none',
		'-layers',
		'merge',
		'+repage',
		')',
		'-gravity',
		'northeast',
		'-geometry',
		'+8+8',
		'-composite',
		'-strip',
		'-quality',
		'92',
		target,
	]);
	console.log(`'${target}' was created.`);
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
		await sleep(1500);
		const cdp = await connect();
		await cdp.send('Page.enable');
		await cdp.send('Network.setUserAgentOverride', {
			userAgent: USER_AGENT,
		});

		// 1. Pull request list (light): avatars + copy buttons, tooltip on hover.
		await open(cdp, `${REPO}/pulls`, 'light');
		await injectExtension(cdp);
		await hover(
			cdp,
			await center(cdp, '[data-hyperfriend="copy-button"]', 1)
		);
		await capture(cdp, join(tmp, '1.png'));
		toJpeg(
			join(tmp, '1.png'),
			join(OUT_DIR, '1-pull-request-list-light.jpg')
		);

		// 2. Pull request page (dark): "Copied!" after a click on the title button.
		await open(cdp, `${REPO}/pull/2`, 'dark');
		await injectExtension(cdp);
		await click(cdp, await center(cdp, '[data-hyperfriend="copy-button"]'));
		await capture(cdp, join(tmp, '2.png'));
		toJpeg(
			join(tmp, '2.png'),
			join(OUT_DIR, '2-pull-request-page-dark.jpg')
		);

		// 3-4. Popup over the pull request list (light and dark).
		for (const [index, scheme] of [
			[3, 'light'],
			[4, 'dark'],
		]) {
			await open(cdp, `${REPO}/pulls`, scheme);
			await injectExtension(cdp);
			await evaluate(cdp, 'window.scrollTo(0, 0)');
			await capture(cdp, join(tmp, `page-${index}.png`));

			await open(
				cdp,
				`file://${join(ROOT_DIR, 'dist/options.html')}`,
				scheme
			);
			const size = await evaluate(
				cdp,
				`(() => {
					const root = document.getElementById('root') || document.body;
					const panel = [...root.querySelectorAll('*')].find((el) => Math.round(el.getBoundingClientRect().width) === 400) || root;
					const r = panel.getBoundingClientRect();
					return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.ceil(r.height) };
				})()`
			);
			const { data } = await cdp.send('Page.captureScreenshot', {
				format: 'png',
				clip: {
					x: size.x,
					y: size.y,
					width: size.w,
					height: size.h,
					scale: 1,
				},
			});
			writeFileSync(
				join(tmp, `popup-${index}.png`),
				Buffer.from(data, 'base64')
			);
			composite(
				join(tmp, `page-${index}.png`),
				join(tmp, `popup-${index}.png`),
				scheme === 'dark' ? '#3d444d' : '#d1d9e0',
				join(OUT_DIR, `${index}-settings-popup-${scheme}.jpg`)
			);
		}

		cdp.close();
	} finally {
		chrome.kill();
		await sleep(500);
		rmSync(tmp, { recursive: true, force: true });
	}
}

await main();
