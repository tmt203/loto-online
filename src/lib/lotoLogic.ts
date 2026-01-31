// src/lib/lotoLogic.ts

export type Ticket = (number | null)[][];

const COL_RANGES = [
	[1, 9], // Column 1
	[10, 19], // Column 2
	[20, 29],
	[30, 39],
	[40, 49],
	[50, 59],
	[60, 69],
	[70, 79],
	[80, 90] // Column 9 (up to 90)
];

export function generateTicket(): Ticket {
	// Initialize an empty ticket with 3 rows and 9 columns
	const ticket: Ticket = Array(3)
		.fill(null)
		.map(() => Array(9).fill(null));

	// Array to mark positions that will have numbers (boolean[3][9])
	const structure = Array(3)
		.fill(null)
		.map(() => Array(9).fill(false));

	// Step 1: Determine positions of numbers (Each row randomly selects 5 columns)
	for (let r = 0; r < 3; r++) {
		const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
		// Shuffle the columns to pick random ones
		for (let i = cols.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[cols[i], cols[j]] = [cols[j], cols[i]];
		}
		// Pick first 5 columns
		const pickedCols = cols.slice(0, 5);
		for (const c of pickedCols) {
			structure[r][c] = true;
		}
	}

	// Step 2: Fill in numbers at the selected positions
	for (let c = 0; c < 9; c++) {
		// Find which rows in this column need numbers
		const rowsToFill = [];
		for (let r = 0; r < 3; r++) {
			if (structure[r][c]) rowsToFill.push(r);
		}

		if (rowsToFill.length > 0) {
			const [min, max] = COL_RANGES[c];
			const count = rowsToFill.length;

			// Random pick 'count' unique numbers in the range min-max
			const numbers = new Set<number>();
			while (numbers.size < count) {
				const num = Math.floor(Math.random() * (max - min + 1)) + min;
				numbers.add(num);
			}

			// Sort numbers in ascending order
			const sortedNumbers = Array.from(numbers).sort((a, b) => a - b);

			// Assign to ticket
			rowsToFill.forEach((rowIndex, i) => {
				ticket[rowIndex][c] = sortedNumbers[i];
			});
		}
	}

	return ticket;
}

export function generateSheet(): Ticket {
    const ticket1 = generateTicket();
    const ticket2 = generateTicket();
    const ticket3 = generateTicket();

    return [...ticket1, ...ticket2, ...ticket3];
}