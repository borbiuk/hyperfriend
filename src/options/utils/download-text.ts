/**
 * Downloads text as a file through a temporary link (no `downloads` permission needed).
 *
 * @param fileName - Name of the downloaded file.
 * @param text - File content.
 * @param type - MIME type of the file.
 */
export function downloadText(
	fileName: string,
	text: string,
	type = 'application/json'
): void {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	// The download starts asynchronously, so release the URL a bit later.
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
