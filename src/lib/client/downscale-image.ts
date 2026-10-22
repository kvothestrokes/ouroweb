import type { Attachment } from 'svelte/attachments';

/**
 * Shrinks a picked PNG in the browser before upload: serverless requests are capped at
 * ~4.5 MB and the server keeps designs at most `maxWidth` wide anyway. PNG keeps transparency.
 */
export async function downscalePng(file: File, maxWidth: number): Promise<File> {
	if (file.type !== 'image/png') return file;
	const bitmap = await createImageBitmap(file);
	if (bitmap.width <= maxWidth) {
		bitmap.close();
		return file;
	}

	const width = maxWidth;
	const height = Math.round((bitmap.height * maxWidth) / bitmap.width);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) return file;
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	return blob ? new File([blob], file.name, { type: 'image/png' }) : file;
}

/** Attachment for `<input type="file">`: swaps the picked PNG for its downscaled copy. */
export function downscaleOnPick(maxWidth: number): Attachment<HTMLInputElement> {
	return (input) => {
		async function onChange() {
			const file = input.files?.[0];
			if (!file) return;
			const smaller = await downscalePng(file, maxWidth);
			if (smaller === file) return;
			const transfer = new DataTransfer();
			transfer.items.add(smaller);
			input.files = transfer.files;
		}
		input.addEventListener('change', onChange);
		return () => input.removeEventListener('change', onChange);
	};
}
