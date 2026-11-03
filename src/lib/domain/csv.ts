/**
 * Minimal RFC 4180 CSV reader/writer for the bulk product import. The delimiter is detected
 * from the header line: comma, or semicolon (what Excel writes in some locales).
 * Blank lines are skipped; an unterminated quoted field throws.
 */
export function parseCsv(input: string): string[][] {
	const text = input.replace(/^\uFEFF/, '');
	const delimiter = detectDelimiter(text);
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	let i = 0;

	const endRow = () => {
		row.push(field);
		if (row.length > 1 || row[0] !== '') rows.push(row);
		row = [];
		field = '';
	};

	while (i < text.length) {
		const char = text[i];
		if (quoted) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				quoted = false;
			} else {
				field += char;
			}
			i++;
			continue;
		}
		if (char === '"' && field === '') {
			quoted = true;
		} else if (char === delimiter) {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			endRow();
			if (char === '\r' && text[i + 1] === '\n') i++;
		} else {
			field += char;
		}
		i++;
	}
	if (quoted) throw new Error('Unterminated quoted field');
	if (field !== '' || row.length > 0) endRow();
	return rows;
}

/** Counts both candidates outside quotes in the first line; ties go to the comma. */
function detectDelimiter(text: string): ',' | ';' {
	let commas = 0;
	let semicolons = 0;
	let quoted = false;
	for (const char of text) {
		if (char === '"') quoted = !quoted;
		else if (!quoted && (char === '\n' || char === '\r')) break;
		else if (!quoted && char === ',') commas++;
		else if (!quoted && char === ';') semicolons++;
	}
	return semicolons > commas ? ';' : ',';
}

/** Comma-separated output; a field is quoted only when it contains a comma, quote or line break. */
export function toCsv(rows: string[][]): string {
	return rows
		.map((row) =>
			row
				.map((field) => (/[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field))
				.join(',')
		)
		.map((line) => `${line}\n`)
		.join('');
}
