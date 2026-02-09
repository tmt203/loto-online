// src/lib/server/socketHandler.ts
import { Server, type Socket } from 'socket.io';
import type { HttpServer } from 'vite';

type GameState = 'IDLE' | 'BETTING' | 'PLAYING';

interface PlayerData {
	name: string;
	balance: number;
	hasTicket: boolean;
	isApproved: boolean;
}

// State Global
const players = new Map<string, PlayerData>();
const INITIAL_BALANCE: number = 500;
let usedNumbers = new Set<number>();
let hostId: string | null = null;
let currentPot: number = 0;
let currentTicketPrice: number = 0;
let gameState: GameState = 'IDLE';

export default function injectSocketIO(server: HttpServer) {
	const io = new Server(server as any, {
		cors: {
			origin: '*',
			methods: ['GET', 'POST']
		}
	});

	io.on('connection', (socket: Socket) => {
		// --- HELPER FUNCTIONS ---
		const broadcastGameState = () => {
			const playerList = Array.from(players.entries()).map(([id, data]) => ({
				id,
				name: data.name,
				balance: data.balance,
				hasTicket: data.hasTicket,
				isApproved: data.isApproved,
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

		// --- EVENTS ---
		socket.on('join-game', (data: { name: string; secretKey?: string }) => {
			const { name, secretKey } = data;

			// By default, player has no ticket
			players.set(socket.id, {
				name,
				balance: INITIAL_BALANCE,
				hasTicket: false,
				isApproved: false
			});
			broadcastSystemLog(`👋 ${name} vào sòng!`, 'info');

			if (secretKey === 'trantrideptrai') {
				// Nếu có Host cũ -> Demote
				if (hostId && hostId !== socket.id) {
					io.to(hostId).emit('role-update', { isHost: false });
					const oldHost = players.get(hostId);
					if (oldHost)
						broadcastSystemLog(
							`⚠️ ${oldHost.name} bị tước quyền Nhà Cái do Chính Chủ đã xuất hiện!`,
							'warning'
						);
				}

				hostId = socket.id;
				socket.emit('role-update', { isHost: true });
				broadcastSystemLog(`👑 ${name} đã đăng nhập quyền Nhà Cái!`, 'success');
			} else {
				socket.emit('role-update', { isHost: false });
			}

			// if (!hostId) {
			// 	hostId = socket.id;
			// 	socket.emit('role-update', { isHost: true });
			// 	broadcastSystemLog(`👑 ${name} làm Nhà Cái!`, 'warning');
			// } else {
			// 	socket.emit('role-update', { isHost: false });
			// }
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
				broadcastSystemLog(`⚠️ Nhà Cái đã rời đi. Cần người có Key để tiếp quản!`, 'error');
				// if (players.size > 0) {
				// 	const nextHostId = players.keys().next().value;
				// 	if (!nextHostId) return;
				// 	const nextHost = players.get(nextHostId);
				// 	if (!nextHost) return;
				// 	hostId = nextHostId;
				// 	io.to(nextHostId).emit('role-update', { isHost: true });
				// 	broadcastSystemLog(`👑 ${nextHost.name} lên chức Nhà Cái`, 'warning');
				// }
			}
			broadcastGameState();
		});

		// --------------------------- CHAT MESSAGE ---------------------------
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

		// --------------------------- GAME ACTIONS ---------------------------
		socket.on('host-open-betting', (price: number) => {
			if (socket.id !== hostId) return;

			currentTicketPrice = price;
			currentPot = 0;
			usedNumbers.clear(); // Clear called numbers
			gameState = 'BETTING';

			// Reset ticket status for all players
			for (let [_, p] of players) {
				p.hasTicket = false;
				p.isApproved = false;
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
				p.isApproved = false; // Mặc định chưa được duyệt
				currentPot += currentTicketPrice; // Add money to pot

				broadcastGameState();
				// Chỉ báo log nếu là vé lớn, vé nhỏ quá thì thôi cho đỡ spam
				if (currentTicketPrice >= 10) broadcastSystemLog(`🎫 ${p.name} đã mua vé!`, 'info');
			} else {
				// Cho phép nợ (âm tiền) để chơi cho vui
				p.balance -= currentTicketPrice;
				p.hasTicket = true;
				p.isApproved = false; // Mặc định chưa được duyệt
				currentPot += currentTicketPrice;
				broadcastGameState();
				broadcastSystemLog(`💸 ${p.name} "báo" quá, âm tiền vẫn mua vé!`, 'error');
			}
		});

		socket.on('host-approve-player', (playerId: string) => {
			if (socket.id !== hostId) return;
			const player = players.get(playerId);
			if (player && player.hasTicket && !player.isApproved) {
				player.isApproved = true;
				broadcastGameState();
				// broadcastSystemLog(`✅ ${player.name} đã được duyệt vào chơi!`, 'success');
			}
		});

		socket.on('host-revoke-player', (playerId: string) => {
			if (socket.id !== hostId) return;
			const player = players.get(playerId);
			if (player && player.hasTicket) {
				if (player.isApproved) {
					// Nếu đang được duyệt -> Chuyển về trạng thái chờ duyệt (không hoàn tiền yet)
					player.isApproved = false;
					broadcastGameState();
					// broadcastSystemLog(`⚠️ ${player.name} bị hạ cấp xuống hàng chờ.`, 'warning');
				} else {
					// Nếu đang ở hàng chờ -> Hoàn tiền và kick
					player.balance += currentTicketPrice;
					currentPot -= currentTicketPrice;
					player.hasTicket = false;
					player.isApproved = false;

					broadcastGameState();
					broadcastSystemLog(
						`❌ ${player.name} bị từ chối/kicked và được hoàn tiền vé.`,
						'warning'
					);
				}
			}
		});

		socket.on('host-start-game', () => {
			if (socket.id !== hostId) return;
			if (currentPot === 0) return; // Cannot start game with empty pot

			gameState = 'PLAYING';
			broadcastGameState();
			broadcastSystemLog(`🔒 ĐÓNG SỔ! Tổng hũ: ${currentPot}k. Bắt đầu quay!`, 'success');
		});

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
			if (!player.hasTicket || !player.isApproved) {
				socket.emit('check-fail');
				broadcastSystemLog(`⛔ ${player.name} chưa được duyệt/mua vé mà đòi KINH!`, 'error');
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

		socket.on('reset-game', () => {
			if (socket.id !== hostId) return;

			// Reset all state variables
			usedNumbers.clear();
			currentPot = 0; // Hũ về 0 (Tiền ván trước ai thắng đã nhận, hoặc huỷ thì mất)
			gameState = 'IDLE'; // Đưa về trạng thái chờ để Host set giá vé mới

			// Collect all ticket of players
			for (const [_, player] of players) {
				player.hasTicket = false;
				player.isApproved = false;
			}

			io.emit('game-reset'); // Client xoá lịch sử số trên màn hình

			broadcastGameState();

			broadcastSystemLog('🔄 Nhà cái đã làm mới bàn chơi. Mời set kèo mới!', 'warning');
		});
	});

	console.log('✅ Socket.io injected!');
}
