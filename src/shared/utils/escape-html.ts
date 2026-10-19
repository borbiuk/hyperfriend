const HTML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

/**
 * Escapes `& < > " '` so the value is safe to embed in HTML text and attribute values.
 *
 * @param value - Raw text.
 * @returns The HTML-escaped text.
 */
export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
