// Documentation checks that need no network: every relative link in the Markdown files points to an
// existing file, and RELEASE_NOTES.md has one `## x.y.z` heading per release, unique and newest first,
// starting with the version in package.json (scripts/tag-releases.sh reads these headings).
// Anchors inside a file are checked by markdownlint (MD051). Run: npm run lint:docs

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

// Tracked and new Markdown files, except the page snapshots and generated reports
const files = execFileSync(
	'git',
	['ls-files', '--cached', '--others', '--exclude-standard', '*.md'],
	{ cwd: ROOT, encoding: 'utf8' }
)
	.split('\n')
	.filter((file) => file !== '' && !file.startsWith('tests/'))
	.filter((file) => existsSync(path.join(ROOT, file)));

/** Removes fenced code blocks and inline code, which may contain link-like text */
function stripCode(text) {
	return text
		.replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, '')
		.replace(/`[^`\n]*`/g, '');
}

for (const file of files) {
	const text = stripCode(readFileSync(path.join(ROOT, file), 'utf8'));
	for (const match of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
		const target = match[1].replace(/^<|>$/g, '');
		if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) {
			continue;
		}
		const relative = decodeURIComponent(target.split('#')[0].split('?')[0]);
		if (relative === '') {
			continue;
		}
		const resolved = path.resolve(ROOT, path.dirname(file), relative);
		if (!existsSync(resolved)) {
			errors.push(`${file}: broken link to ${target}`);
		}
	}
}

const version = JSON.parse(
	readFileSync(path.join(ROOT, 'package.json'), 'utf8')
).version;
const headings = readFileSync(path.join(ROOT, 'RELEASE_NOTES.md'), 'utf8')
	.split('\n')
	.filter((line) => line.startsWith('## '))
	.map((line) => line.slice(3).trim());

/** Compares two x.y.z strings: positive when a is newer than b */
function compareVersions(a, b) {
	const left = a.split('.').map(Number);
	const right = b.split('.').map(Number);
	for (let index = 0; index < 3; index++) {
		if (left[index] !== right[index]) {
			return left[index] - right[index];
		}
	}
	return 0;
}

for (const heading of headings) {
	if (!/^\d+\.\d+\.\d+$/.test(heading)) {
		errors.push(
			`RELEASE_NOTES.md: "## ${heading}" is not a version heading`
		);
	}
}
if (headings[0] !== version) {
	errors.push(
		`RELEASE_NOTES.md: the first heading is "${headings[0]}", package.json has ${version}`
	);
}
for (let index = 1; index < headings.length; index++) {
	if (compareVersions(headings[index - 1], headings[index]) <= 0) {
		errors.push(
			`RELEASE_NOTES.md: "${headings[index]}" must come after "${headings[index - 1]}" (newest first, no duplicates)`
		);
	}
}

if (errors.length > 0) {
	console.error(errors.join('\n'));
	process.exit(1);
}
console.log(
	`Checked ${files.length} Markdown files and ${headings.length} release headings.`
);
