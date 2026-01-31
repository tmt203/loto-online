# 🧧 Lô Tô Online - Vui Tết 2026

**Web app chơi Lô Tô truyền thống theo phong cách Real-time hiện đại**. Dự án được xây dựng để phục vụ anh em, bạn bè tụ tập "sát phạt" dịp Tết Nguyên Đán, nơi khoảng cách địa lý không còn là vấn đề! 🎲

## ✨ Tính Năng Nổi Bật

### 1. 🎮 Gameplay Real-time (Thời gian thực)

- Kết nối đa người chơi: Sử dụng Socket.io để đồng bộ trạng thái game tức thì cho tất cả người chơi.
- Cơ chế Host/Player: Người đầu tiên vào phòng sẽ là Nhà Cái (Host) có quyền Hô Số và Reset game. Những người vào sau là Tay Em.
- Hô Số Tự Động: Tích hợp Text-to-Speech (Giọng chị Google 👩‍🏫) để đọc số lô tô tự động. Có cơ chế Fallback về giọng Robot trình duyệt nếu API Google bị chặn.

### 2. 🎫 Vé Số & Logic Game

- **Vé Đại (Sheet 9x9)**: Tạo vé ngẫu nhiên chuẩn luật Lô Tô truyền thống (mỗi hàng 5 số, cột sắp xếp tăng dần).
- **Đánh Dấu Thông Minh**: Click vào ô số để đánh dấu/bỏ đánh dấu.
- **KINH (Check Win) Server-side**: Khi người chơi bấm "KINH", Server sẽ kiểm tra chéo với danh sách số đã gọi để đảm bảo tính công bằng.
- **✅ Thắng**: Pháo hoa (Confetti) nổ tưng bừng + Thông báo toàn server.
- **❌ Thua**: Báo lỗi riêng cho người chơi (đỡ quê) + Log nhắc nhở "phạt 1 ly".

### 3.💬 Tương Tác & UI/UX

- **Sòng Chat & System Log**: Vừa chém gió, vừa theo dõi lịch sử số ra và trạng thái người chơi (Vào/Ra/Kinh).
- **Danh Sách Online**: Hiển thị ai đang có mặt trong sòng.
- **Giao Diện App-like**: Tối ưu hóa layout không cuộn trang (fixed header/footer), hỗ trợ tốt trên cả Mobile & Desktop.
- **Glass Scrollbar**: Thanh cuộn kính tinh tế, chỉ hiện khi hover.

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

Dự án sử dụng các công nghệ Web mới nhất tính đến 2025:

- Frontend:
  - SvelteKit (Svelte 5 với Runes $state, $effect, $props...).
  - TailwindCSS (Styling nhanh, Responsive).
  - TypeScript (Type safety).
- Backend:
  - Node.js (Custom Server).
  - Socket.io (Xử lý kết nối Real-time 2 chiều).
- Tooling:
  - Vite (Tích hợp Socket.io Server trực tiếp vào Vite Dev Server qua plugin).
  - Canvas Confetti (Hiệu ứng pháo hoa).
