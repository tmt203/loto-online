// src/lib/lotoLogic.ts

export type Ticket = (number | null)[][];

const COL_RANGES = [
	[1, 9], // Cột 1: 9 số
	[10, 19], // Cột 2: 10 số
	[20, 29],
	[30, 39],
	[40, 49],
	[50, 59],
	[60, 69],
	[70, 79],
	[80, 90] // Cột 9: 11 số
];

// Function to shuffle array (Fisher-Yates shuffle)
function shuffleArray<T>(array: T[]): T[] {
	const newArr = [...array];
	for (let i = newArr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[newArr[i], newArr[j]] = [newArr[j], newArr[i]];
	}
	return newArr;
}

// Function to create a number pool from min to max
function createNumberPool(min: number, max: number): number[] {
	const pool = [];
	for (let i = min; i <= max; i++) {
		pool.push(i);
	}
	return pool; // Trả về mảng [min, ..., max]
}

export function generateSheet(): Ticket {
	// 1. Tạo Kho Số (Global Pool) cho từng cột
	// pools[0] sẽ chứa [1, 2, ..., 9] đã được xáo trộn
	// pools[1] sẽ chứa [10, 11, ..., 19] đã được xáo trộn...
	const pools = COL_RANGES.map(([min, max]) => shuffleArray(createNumberPool(min, max)));

	// 2. Khởi tạo cấu trúc rỗng cho 9 dòng (3 vé x 3 dòng)
	// Ta sẽ xử lý từng vé (block 3 dòng) một
	const fullSheet: Ticket = [];

	for (let ticketIdx = 0; ticketIdx < 3; ticketIdx++) {
		// Tạo cấu trúc cho 1 vé con (3 dòng)
		const ticketRows: Ticket = Array(3)
			.fill(null)
			.map(() => Array(9).fill(null));
		const structure = Array(3)
			.fill(null)
			.map(() => Array(9).fill(false));

		// A. Xác định vị trí điền số (mỗi dòng 5 số)
		for (let r = 0; r < 3; r++) {
			const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
			// Shuffle để chọn cột ngẫu nhiên
			const shuffledCols = shuffleArray(cols);

			// Lấy 5 cột đầu tiên
			// LƯU Ý QUAN TRỌNG: Cần kiểm tra xem Pool của cột đó còn số không?
			// (Dù xác suất hết số là rất thấp với quy tắc 5 số/dòng, nhưng check cho an toàn)
			const selectedCols = [];
			for (const colIndex of shuffledCols) {
				if (selectedCols.length === 5) break;
				// Kiểm tra kho số của cột này còn hàng không
				if (pools[colIndex].length > 0) {
					selectedCols.push(colIndex);
				}
			}

			// Đánh dấu vị trí
			for (const c of selectedCols) {
				structure[r][c] = true;
			}
		}

		// B. Điền số từ Kho Số vào Vé
		for (let c = 0; c < 9; c++) {
			// Tìm các dòng trong vé này cần điền số ở cột c
			const rowsToFill = [];
			for (let r = 0; r < 3; r++) {
				if (structure[r][c]) rowsToFill.push(r);
			}

			if (rowsToFill.length > 0) {
				// Lấy đúng số lượng cần thiết từ Kho Số chung
				// Vì pool đã shuffle, ta chỉ cần cắt (splice) ra là được số ngẫu nhiên duy nhất
				const numbersForThisTicket = pools[c].splice(0, rowsToFill.length);

				// Sắp xếp tăng dần (Quy tắc Lô tô: trong 1 vé con, cột phải tăng dần)
				numbersForThisTicket.sort((a, b) => a - b);

				// Gán vào vé
				rowsToFill.forEach((rowIndex, i) => {
					ticketRows[rowIndex][c] = numbersForThisTicket[i];
				});
			}
		}

		// Đẩy 3 dòng của vé này vào sheet tổng
		fullSheet.push(...ticketRows);
	}

	return fullSheet;
}

// Giữ lại hàm generateTicket cũ nếu bạn muốn dùng tạo vé đơn lẻ (tuy nhiên vé đơn lẻ sẽ không đảm bảo tính duy nhất so với các vé khác nếu tạo nhiều lần)
// Nhưng logic tốt nhất là dùng generateSheet rồi cắt ra nếu cần.
export function generateTicket(): Ticket {
	// Generate 1 sheet and take the first 3 rows
	return generateSheet().slice(0, 3);
}
