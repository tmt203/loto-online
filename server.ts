// server.ts
import express from 'express';
import { createServer } from 'http';
import injectSocketIO from './src/lib/server/socketHandler';

// @ts-ignore - File 'handler.js' trong thư mục build sẽ được SvelteKit tạo ra SAU KHI chạy lệnh build.
// Do đó lúc code TS sẽ báo lỗi không tìm thấy file, ta dùng @ts-ignore để bỏ qua.
import { handler } from './build/handler.js';

const app = express();
const server = createServer(app);

// 1. Gắn Socket.io vào server (quan trọng là gắn trước handler của SvelteKit)
injectSocketIO(server);

// 2. Gắn SvelteKit handler vào làm middleware cho Express
// Nó sẽ xử lý tất cả các request page, api, static files...
app.use(handler);

// 3. Chạy server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`🚀 Production Server đang chạy tại http://localhost:${PORT}`);
});
