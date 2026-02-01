import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { Server } from 'socket.io';

interface PlayerData {
	name: string;
	balance: number;
	hasTicket: boolean;
}

// Map to store usernames (socketId -> username)
const players = new Map<string, PlayerData>();

// Money settings
const INITIAL_BALANCE = 500; // 500k (Đơn vị k)

// State save game (Located outside the connection scope to be shared by everyone)
let usedNumbers = new Set<number>();

// Store ID of host
let hostId: string | null = null;

// Store the current pot amount
let currentPot = 0;

// Ticket price
let currentTicketPrice = 0;

let gameState: 'IDLE' | 'BETTING' | 'PLAYING' = 'IDLE';

// Create a simple Vite plugin to run Socket.io
const webSocketServer = {
	name: 'webSocketServer',
	configureServer(server: any) {
		if (!server.httpServer) return;

		// Create a Socket.io server attached to Vite's HTTP server
		const io = new Server(server.httpServer);

		io.on('connection', (socket) => {
			// Function to broadcast the player list to ALL clients
			const broadcastPlayerList = () => {
				const names = Array.from(players.values());
				io.emit('update-players', names);
			};

			// Function to broadcast system log messages
			const broadcastSystemLog = (
				message: string,
				type: 'info' | 'success' | 'warning' | 'error' = 'info'
			) => {
				io.emit('receive-chat', {
					type: 'system',
					subType: type,
					content: message,
					timestamp: Date.now()
				});
			};

			// Function to broadcast money info to players
			const broadcastGameState = () => {
				const playerList = Array.from(players.entries()).map(([id, data]) => ({
					id,
					name: data.name,
					balance: data.balance,
					hasTicket: data.hasTicket,
					isHost: id === hostId
				}));

				// Send to client all necessary info
				io.emit('update-game-state', {
					players: playerList,
					pot: currentPot,
					ticketPrice: currentTicketPrice,
					gameState: gameState
				});
			};

			socket.on('join-game', (name: string) => {
				// By default, player has no ticket
				players.set(socket.id, { name, balance: INITIAL_BALANCE, hasTicket: false });
				broadcastSystemLog(`👋 ${name} vào sòng!`, 'info');

				if (!hostId) {
					hostId = socket.id;
					socket.emit('role-update', { isHost: true });
					broadcastSystemLog(`👑 ${name} làm Nhà Cái!`, 'warning');
				} else {
					socket.emit('role-update', { isHost: false });
				}
				broadcastGameState();
				// Send the current used numbers to the newly connected player
				socket.emit('sync-numbers', Array.from(usedNumbers));
			});

			socket.on('disconnect', () => {
				const player = players.get(socket.id);
				players.delete(socket.id);
				if (player) broadcastSystemLog(`🏃 ${player.name} rời sòng.`, 'info');

				if (socket.id === hostId) {
					hostId = null;
					if (players.size > 0) {
						const nextHostId = players.keys().next().value;
						if (!nextHostId) return;
						const nextHost = players.get(nextHostId);
						if (!nextHost) return;
						hostId = nextHostId;
						io.to(nextHostId).emit('role-update', { isHost: true });
						broadcastSystemLog(`👑 ${nextHost.name} lên chức Nhà Cái`, 'warning');
					}
				}
				broadcastGameState();
			});

			socket.on('send-chat', (message: string) => {
				const player = players.get(socket.id);
				// Broadcast to ALL players
				io.emit('receive-chat', {
					type: 'user',
					sender: player?.name || 'Người lạ',
					content: message,
					timestamp: Date.now()
				});
			});

			socket.on('host-open-betting', (price: number) => {
				if (socket.id !== hostId) return;

				currentTicketPrice = price;
				currentPot = 0;
				usedNumbers.clear(); // Clear called numbers
				gameState = 'BETTING';

				// Reset ticket status for all players
				for (let [_, p] of players) {
					p.hasTicket = false;
				}

				io.emit('game-reset'); // Clear numbers on client
				broadcastGameState();
				broadcastSystemLog(`📢 MỞ BÁN VÉ: ${price}k/vé. Mại dô mại dô!`, 'warning');
			});

			socket.on('buy-ticket', () => {
				if (gameState !== 'BETTING') return;
				const p = players.get(socket.id);
				if (!p || p.hasTicket) return;

				if (p.balance >= currentTicketPrice) {
					p.balance -= currentTicketPrice;
					p.hasTicket = true;
					currentPot += currentTicketPrice; // Add money to pot

					broadcastGameState();
					// Chỉ báo log nếu là vé lớn, vé nhỏ quá thì thôi cho đỡ spam
					if (currentTicketPrice >= 10) broadcastSystemLog(`🎫 ${p.name} đã mua vé!`, 'info');
				} else {
					// Cho phép nợ (âm tiền) để chơi cho vui
					p.balance -= currentTicketPrice;
					p.hasTicket = true;
					currentPot += currentTicketPrice;
					broadcastGameState();
					broadcastSystemLog(`💸 ${p.name} "báo" quá, âm tiền vẫn mua vé!`, 'error');
				}
			});

			socket.on('host-start-game', () => {
				if (socket.id !== hostId) return;
				if (currentPot === 0) return; // Cannot start game with empty pot

				gameState = 'PLAYING';
				broadcastGameState();
				broadcastSystemLog(`🔒 ĐÓNG SỔ! Tổng hũ: ${currentPot}k. Bắt đầu quay!`, 'success');
			});

			// Listen for "Call Number" command from Client (only Host can do this)
			socket.on('call-number', () => {
				if (socket.id !== hostId) return;
				if (gameState !== 'PLAYING') return; // Cannot call number if game not started
				if (usedNumbers.size >= 90) return;

				let num;
				do {
					num = Math.floor(Math.random() * 90) + 1;
				} while (usedNumbers.has(num));

				usedNumbers.add(num);
				io.emit('new-number', num);
			});

			socket.on('request-check-win', (playerSheet: any[][]) => {
				const player = players.get(socket.id);
				if (!player) return;

				// Check if player has a ticket
				if (!player.hasTicket) {
					socket.emit('check-fail');
					broadcastSystemLog(`⛔ ${player.name} chưa mua vé mà đòi KINH! Gian lận!`, 'error');
					return;
				}

				broadcastSystemLog(`👀 ${player.name} đang đòi KINH...`, 'warning');

				let isWinner = false;
				for (const row of playerSheet) {
					const numbersInRow = row.filter((n) => n !== null) as number[];
					const fullRow = numbersInRow.every((num) => usedNumbers.has(num));
					if (fullRow && numbersInRow.length > 0) {
						isWinner = true;
						break;
					}
				}

				if (isWinner) {
					player.balance += currentPot;
					const winAmount = currentPot;

					// Reset game state về IDLE
					currentPot = 0;
					gameState = 'IDLE';

					broadcastGameState();
					broadcastSystemLog(`🏆 ${player.name} HỐT TRỌN HŨ ${winAmount}k!!!`, 'success');
					io.emit('game-over', { winnerName: player.name, winAmount });
				} else {
					broadcastSystemLog(`❌ ${player.name} kinh trượt! Phạt 1 ly 🍺!`, 'error');
					socket.emit('check-fail');
				}
			});

			// "Reset Game" command (only Host can do this)
			socket.on('reset-game', () => {
				if (socket.id !== hostId) return;

				// Reset all state variables
				usedNumbers.clear();
				currentPot = 0; // Hũ về 0 (Tiền ván trước ai thắng đã nhận, hoặc huỷ thì mất)
				gameState = 'IDLE'; // Đưa về trạng thái chờ để Host set giá vé mới

				// Collect all ticket of players
				for (const [_, player] of players) {
					player.hasTicket = false;
				}

				io.emit('game-reset'); // Client xoá lịch sử số trên màn hình

				broadcastGameState();

				broadcastSystemLog('🔄 Nhà cái đã làm mới bàn chơi. Mời set kèo mới!', 'warning');
			});
		});
	}
};

export default defineConfig({ plugins: [tailwindcss(), sveltekit(), webSocketServer] });
