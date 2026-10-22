import type { Attachment } from 'svelte/attachments';

const DOWNSCALABLE = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Shrinks a picked image in the browser before upload: serverless requests are capped at
 * ~4.5 MB and the server keeps images at most `maxWidth` wide anyway. PNG stays PNG to keep
 * transparency; photos become JPEG.
 */
export async function downscaleImage(
	file: File,
	maxWidth: number,
	{ keepPng = true }: { keepPng?: boolean } = {}
): Promise<File> {
	if (!DOWNSCALABLE.has(file.type)) return file;
	const bitmap = await createImageBitmap(file);
	const convert = file.type === 'image/png' && !keepPng;
	if (bitmap.width <= maxWidth && !convert) {
		bitmap.close();
		return file;
	}

	const width = Math.min(maxWidth, bitmap.width);
	const height = Math.round((bitmap.height * width) / bitmap.width);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) return file;
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const type = file.type === 'image/png' && keepPng ? 'image/png' : 'image/jpeg';
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
	return blob ? new File([blob], file.name, { type }) : file;
}

/** Attachment for `<input type="file">`: swaps the picked image for its downscaled copy. */
export function downscaleOnPick(
	maxWidth: number,
	options: { keepPng?: boolean } = {}
): Attachment<HTMLInputElement> {
	return (input) => {
		async function onChange() {
			const file = input.files?.[0];
			if (!file) return;
			const smaller = await downscaleImage(file, maxWidth, options);
			if (smaller === file) return;
			const transfer = new DataTransfer();
			transfer.items.add(smaller);
			input.files = transfer.files;
		}
		input.addEventListener('change', onChange);
		return () => input.removeEventListener('change', onChange);
	};
}
