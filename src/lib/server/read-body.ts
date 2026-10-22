/**
 * Reads a request body as text, giving up as soon as it passes `maxBytes` (a chunked
 * request has no content-length to check up front). Null when it is too large.
 */
export async function readBodyLimited(request: Request, maxBytes: number): Promise<string | null> {
	if (!request.body) return '';
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	return new TextDecoder().decode(Buffer.concat(chunks));
}
