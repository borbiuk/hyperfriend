import { TEMPLATE_PLACEHOLDERS } from '@shared/constants';
import { LinkType } from '@shared/models';
import { toSingleLineTemplate } from '@shared/services';
import {
	Ref,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
} from 'react';

import '../styles/templates.css';
import {
	findLinkRange,
	findTokenRanges,
	splitTemplateTokens,
	ZERO_WIDTH_SPACE,
} from '../utils/template-tokens';

const ZERO_WIDTH_SPACE_REGEX = new RegExp(ZERO_WIDTH_SPACE, 'g');
const TOKEN_ATTRIBUTE = 'data-token';

/** Selected part of the template text, in characters (a chip counts as its `{{name}}` text). */
interface SelectionOffsets {
	start: number;
	end: number;
}

/** What the parent can ask the editor to do. */
export interface TokenEditorHandle {
	/** Puts the text at the caret (or in place of the selection) and focuses the editor. */
	insert: (text: string) => void;
}

interface TokenEditorProps {
	type: LinkType;
	/** The template text. */
	value: string;
	maxLength: number;
	/** Id of the element that names the editor. */
	labelId: string;
	describedBy?: string;
	invalid?: boolean;
	/** Shown while the editor is empty. */
	placeholder: string;
	onChange: (value: string) => void;
	onBlur: () => void;
	ref?: Ref<TokenEditorHandle>;
}

/** The template text of the editor: chips count as their `{{name}}`, guards as nothing. */
function readTemplate(root: HTMLElement): string {
	return (root.textContent ?? '').replace(ZERO_WIDTH_SPACE_REGEX, '');
}

/** Returns true for a placeholder chip. */
function isChip(node: Node | undefined): boolean {
	return node instanceof HTMLElement && node.hasAttribute(TOKEN_ATTRIBUTE);
}

/** One placeholder as a chip that cannot be edited inside, only removed as a whole. */
function createChip(name: string): HTMLElement {
	const chip = document.createElement('span');
	chip.className = 'hyperfriend-token';
	chip.contentEditable = 'false';
	chip.setAttribute(TOKEN_ATTRIBUTE, name);
	chip.setAttribute('role', 'img');
	chip.setAttribute('aria-label', `placeholder ${name}`);
	chip.textContent = `{{${name}}}`;
	return chip;
}

/**
 * The DOM for a template: text nodes and chips. A guard (zero-width space) stands before a
 * first chip, between two chips and after a last chip, so the caret can be placed there.
 */
function buildNodes(template: string, known: readonly string[]): Node[] {
	const nodes: Node[] = [];
	const segments = splitTemplateTokens(template, known);

	segments.forEach((segment, index) => {
		if (segment.kind === 'text') {
			nodes.push(document.createTextNode(segment.value));
			return;
		}

		const previous = segments[index - 1];
		if (!previous || previous.kind === 'token') {
			nodes.push(document.createTextNode(ZERO_WIDTH_SPACE));
		}
		nodes.push(createChip(segment.value));
		if (index === segments.length - 1) {
			nodes.push(document.createTextNode(ZERO_WIDTH_SPACE));
		}
	});

	return nodes;
}

/**
 * Returns true when the editor's DOM is exactly what `buildNodes` would build for its text:
 * only text nodes and chips, guards in place and no typed `{{name}}` left as plain text.
 */
function isCanonical(root: HTMLElement, known: readonly string[]): boolean {
	root.normalize();
	const nodes = Array.from(root.childNodes);

	return nodes.every((node, index) => {
		const previous = nodes[index - 1];
		const next = nodes[index + 1];

		if (node instanceof HTMLElement) {
			return (
				isChip(node) &&
				node.textContent ===
					`{{${node.getAttribute(TOKEN_ATTRIBUTE)}}}` &&
				previous !== undefined &&
				!isChip(previous) &&
				next !== undefined &&
				!isChip(next)
			);
		}

		if (!(node instanceof Text)) {
			return false;
		}

		if (node.data === ZERO_WIDTH_SPACE) {
			return isChip(previous) || isChip(next);
		}

		return (
			!node.data.includes(ZERO_WIDTH_SPACE) &&
			!splitTemplateTokens(node.data, known).some(
				(segment) => segment.kind === 'token'
			)
		);
	});
}

/** Character offset of a DOM position; a position inside a chip counts as after the chip. */
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
	const range = document.createRange();
	range.selectNodeContents(root);

	const element = node instanceof Element ? node : node.parentElement;
	const chip = element?.closest(`[${TOKEN_ATTRIBUTE}]`);
	if (chip && root.contains(chip)) {
		range.setEndAfter(chip);
	} else {
		range.setEnd(node, offset);
	}

	return range.toString().replace(ZERO_WIDTH_SPACE_REGEX, '').length;
}

/** The selection as character offsets, or `null` when it is not inside the editor. */
function readSelection(root: HTMLElement): SelectionOffsets | null {
	const selection = document.getSelection();
	if (
		!selection?.anchorNode ||
		!selection.focusNode ||
		!root.contains(selection.anchorNode) ||
		!root.contains(selection.focusNode)
	) {
		return null;
	}

	const anchor = offsetOf(root, selection.anchorNode, selection.anchorOffset);
	const focus = offsetOf(root, selection.focusNode, selection.focusOffset);
	return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
}

/** DOM position of a character offset; never inside a chip. */
function positionOf(
	root: HTMLElement,
	offset: number
): { node: Node; offset: number } {
	let consumed = 0;
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text;
		const length = text.data.replace(ZERO_WIDTH_SPACE_REGEX, '').length;
		if (offset > consumed + length) {
			consumed += length;
			continue;
		}

		const chip = text.parentElement?.closest(`[${TOKEN_ATTRIBUTE}]`);
		if (chip?.parentNode) {
			return {
				node: chip.parentNode,
				offset:
					Array.prototype.indexOf.call(
						chip.parentNode.childNodes,
						chip
					) + 1,
			};
		}

		if (text.data === ZERO_WIDTH_SPACE) {
			return { node: text, offset: 0 };
		}

		return { node: text, offset: offset - consumed };
	}

	return { node: root, offset: root.childNodes.length };
}

/** Puts the selection at the given character offsets. */
function writeSelection(root: HTMLElement, offsets: SelectionOffsets): void {
	const selection = document.getSelection();
	if (!selection) {
		return;
	}

	const start = positionOf(root, offsets.start);
	const end = positionOf(root, offsets.end);
	const range = document.createRange();
	range.setStart(start.node, start.offset);
	range.setEnd(end.node, end.offset);
	selection.removeAllRanges();
	selection.addRange(range);
}

/** Marks the link part of the template (`[...]`) with a CSS highlight. */
function updateHighlight(
	root: HTMLElement,
	template: string,
	name: string
): void {
	if (typeof CSS === 'undefined' || !('highlights' in CSS)) {
		return;
	}

	const link = findLinkRange(template);
	if (!link) {
		CSS.highlights.delete(name);
		return;
	}

	const start = positionOf(root, link.start);
	const end = positionOf(root, link.end);
	const range = document.createRange();
	range.setStart(start.node, start.offset);
	range.setEnd(end.node, end.offset);
	CSS.highlights.set(name, new Highlight(range));
}

/**
 * Single-line editor for a link template: `{{placeholder}}` shows as a chip and the link part
 * in `[square brackets]` is highlighted. It is a `contenteditable` text box whose children
 * React never renders; the DOM is rebuilt from the text whenever its shape is not canonical.
 */
export function TokenEditor({
	type,
	value,
	maxLength,
	labelId,
	describedBy,
	invalid,
	placeholder,
	onChange,
	onBlur,
	ref,
}: TokenEditorProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const composing = useRef(false);
	/** Last selection seen inside the editor, kept for an insert from outside it. */
	const lastSelection = useRef<SelectionOffsets | null>(null);
	/** Last text this editor reported or was given. */
	const lastValue = useRef(value);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const known = TEMPLATE_PLACEHOLDERS[type];
	const highlightName = `hyperfriend-link-${type}`;

	/** Rebuilds the DOM from the text and puts the caret back. */
	const show = useCallback(
		(root: HTMLElement, template: string, caret?: SelectionOffsets) => {
			root.replaceChildren(...buildNodes(template, known));
			if (caret) {
				writeSelection(root, {
					start: Math.min(caret.start, template.length),
					end: Math.min(caret.end, template.length),
				});
			}
			updateHighlight(root, template, highlightName);
		},
		[known, highlightName]
	);

	/** Takes the text the user produced: single line, within the limit, chips in place. */
	const commit = useCallback(
		(root: HTMLElement, raw: string, caret: SelectionOffsets | null) => {
			const next = toSingleLineTemplate(raw).slice(0, maxLength);
			if (next !== raw || !isCanonical(root, known)) {
				show(root, next, caret ?? undefined);
			} else {
				updateHighlight(root, next, highlightName);
			}

			if (next !== lastValue.current) {
				lastValue.current = next;
				onChangeRef.current(next);
			}
		},
		[known, maxLength, show, highlightName]
	);

	const handleInput = useCallback(() => {
		const root = rootRef.current;
		if (!root || composing.current) {
			return;
		}

		commit(root, readTemplate(root), readSelection(root));
	}, [commit]);

	/** Shows a new text with the caret at an offset and reports it. */
	const apply = useCallback(
		(root: HTMLElement, next: string, caretOffset: number) => {
			const caret = Math.min(caretOffset, next.length);
			root.focus();
			show(root, next, { start: caret, end: caret });
			lastSelection.current = { start: caret, end: caret };
			if (next !== lastValue.current) {
				lastValue.current = next;
				onChangeRef.current(next);
			}
		},
		[show]
	);

	/** Replaces the selection (or the last known one) with a text. */
	const replaceSelection = useCallback(
		(text: string) => {
			const root = rootRef.current;
			if (!root) {
				return;
			}

			const current = readTemplate(root);
			const selection = readSelection(root) ??
				lastSelection.current ?? {
					start: current.length,
					end: current.length,
				};
			const start = Math.min(selection.start, current.length);
			const end = Math.min(selection.end, current.length);
			const next = (
				current.slice(0, start) +
				text +
				current.slice(end)
			).slice(0, maxLength);

			apply(root, next, start + text.length);
		},
		[maxLength, apply]
	);

	/** Deletes one character, or one whole chip, next to the caret. */
	const deleteNextToCaret = useCallback(
		(root: HTMLElement, caret: number, backward: boolean) => {
			const current = readTemplate(root);
			const tokens = findTokenRanges(current, known);
			let start = caret;
			let end = caret;

			if (backward) {
				const token = tokens.find((range) => range.end === caret);
				start = token ? token.start : caret - 1;
			} else {
				const token = tokens.find((range) => range.start === caret);
				end = token ? token.end : caret + 1;
			}

			if (start < 0 || end > current.length) {
				return;
			}

			apply(root, current.slice(0, start) + current.slice(end), start);
		},
		[known, apply]
	);

	useImperativeHandle(ref, () => ({ insert: replaceSelection }), [
		replaceSelection,
	]);

	// Show the text again when it was changed from outside (reset, import, another tab).
	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) {
			return;
		}

		lastValue.current = value;
		if (readTemplate(root) !== value || !isCanonical(root, known)) {
			show(root, value);
		} else {
			updateHighlight(root, value, highlightName);
		}
	}, [value, known, show, highlightName]);

	useEffect(() => {
		const root = rootRef.current;
		if (!root) {
			return;
		}

		const handleBeforeInput = (event: InputEvent): void => {
			// Backspace and Delete work on the text, so one press removes a whole chip and
			// never only an invisible guard character
			if (
				event.inputType === 'deleteContentBackward' ||
				event.inputType === 'deleteContentForward'
			) {
				const selection = readSelection(root);
				if (selection && selection.start === selection.end) {
					event.preventDefault();
					deleteNextToCaret(
						root,
						selection.start,
						event.inputType === 'deleteContentBackward'
					);
					return;
				}
			}

			// One line of plain text: no Enter, no bold or italic, no dropped content
			if (
				event.inputType === 'insertParagraph' ||
				event.inputType === 'insertLineBreak' ||
				event.inputType === 'insertFromDrop' ||
				event.inputType.startsWith('format')
			) {
				event.preventDefault();
			}
		};
		const handlePaste = (event: ClipboardEvent): void => {
			event.preventDefault();
			replaceSelection(
				toSingleLineTemplate(
					event.clipboardData?.getData('text/plain') ?? ''
				)
			);
		};
		const handleDrop = (event: DragEvent): void => {
			event.preventDefault();
		};
		const handleCompositionStart = (): void => {
			composing.current = true;
		};
		const handleCompositionEnd = (): void => {
			composing.current = false;
			handleInput();
		};
		const handleSelectionChange = (): void => {
			const selection = readSelection(root);
			if (selection) {
				lastSelection.current = selection;
			}
		};

		root.addEventListener('beforeinput', handleBeforeInput);
		root.addEventListener('paste', handlePaste);
		root.addEventListener('drop', handleDrop);
		root.addEventListener('compositionstart', handleCompositionStart);
		root.addEventListener('compositionend', handleCompositionEnd);
		document.addEventListener('selectionchange', handleSelectionChange);

		return () => {
			root.removeEventListener('beforeinput', handleBeforeInput);
			root.removeEventListener('paste', handlePaste);
			root.removeEventListener('drop', handleDrop);
			root.removeEventListener(
				'compositionstart',
				handleCompositionStart
			);
			root.removeEventListener('compositionend', handleCompositionEnd);
			document.removeEventListener(
				'selectionchange',
				handleSelectionChange
			);
		};
	}, [handleInput, replaceSelection, deleteNextToCaret]);

	useEffect(() => {
		return () => {
			if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
				CSS.highlights.delete(highlightName);
			}
		};
	}, [highlightName]);

	return (
		<div
			ref={rootRef}
			className="hyperfriend-editor"
			contentEditable
			suppressContentEditableWarning
			role="textbox"
			aria-multiline="false"
			aria-labelledby={labelId}
			aria-describedby={describedBy}
			aria-invalid={invalid ? true : undefined}
			data-placeholder={placeholder}
			data-value={value}
			spellCheck={false}
			onInput={handleInput}
			onBlur={onBlur}
		/>
	);
}
