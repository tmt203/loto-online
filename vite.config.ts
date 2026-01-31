import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { Server } from 'socket.io';

// State save game (Located outside the connection scope to be shared by everyone)
let usedNumbers = new Set<number>();

// Map to store usernames (socketId -> username)
const players = new Map<string, string>();

// Store ID of host
let hostId: string | null = null;

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

			socket.on('join-game', (name: string) => {
				players.set(socket.id, name);

				broadcastSystemLog(`👋 ${name} vừa bước vào sòng!`, 'info');

				// If there is no host then make this user is host
				if (!hostId) {
					hostId = socket.id;
					socket.emit('role-update', { isHost: true }); // Notify client they are host

					broadcastSystemLog(`👑 ${name} đã được phong làm Nhà Cái!`, 'warning');
				} else {
					socket.emit('role-update', { isHost: false }); // Notify client they are not host
				}

				// (Optional) Notify everyone that a new player has joined
				io.emit('notification', `${name} vừa vào phòng!`);

				// Send updated player list to all clients
				broadcastPlayerList();
			});

			socket.on('disconnect', () => {
				const name = players.get(socket.id);
				players.delete(socket.id); // Remove player on disconnect

				if (name) broadcastSystemLog(`🏃 ${name} đã rời cuộc chơi.`, 'info');

				// If host disconnects -> Choose the next player as Host
				if (socket.id === hostId) {
					hostId = null; // Reset temporarily
					if (players.size > 0) {
						// Get the first player in the Map as the new Host
						const nextHostId = players.keys().next().value;
						if (nextHostId) {
							const nextHostName = players.get(nextHostId);
							hostId = nextHostId;
							io.to(nextHostId).emit('role-update', { isHost: true });
							broadcastSystemLog(`👑 Quyền Nhà Cái được chuyển cho ${nextHostName}`, 'warning');
						}
					}
				}

				// Notify everyone that a player has left
				broadcastPlayerList();
			});

			socket.on('send-chat', (message: string) => {
				const name = players.get(socket.id) || 'Người lạ';
				// Broadcast to ALL players
				io.emit('receive-chat', {
					type: 'user',
					sender: name,
					content: message,
					timestamp: Date.now()
				});
			});

			// Listen for "Call Number" command from Client (only Host can do this)
			socket.on('call-number', () => {
				if (socket.id !== hostId) return; // Ignore if not host
				if (usedNumbers.size >= 90) return; // All numbers have been called

				let num;
				// Random until finding an uncalled number
				do {
					num = Math.floor(Math.random() * 90) + 1;
				} while (usedNumbers.has(num));

				usedNumbers.add(num);

				// Broadcast the new number to ALL players
				io.emit('new-number', num);
				broadcastSystemLog(`🎤 Nhà cái hô số: ${num}`, 'info');
			});

			// "Reset Game" command (only Host can do this)
			socket.on('reset-game', () => {
				if (socket.id !== hostId) return; // Ignore if not host
				usedNumbers.clear();
				io.emit('game-reset');
				broadcastSystemLog(`♻️ Ván mới đã bắt đầu! Chúc may mắn.`, 'success');
			});

			socket.on('request-check-win', (playerSheet: any[][]) => {
				const name = players.get(socket.id) || 'Ai đó';
				broadcastSystemLog(`👀 ${name} đang đòi KINH...`, 'warning');

				let isWinner = false;

				// Iterate through each row in the player's sheet
				for (const row of playerSheet) {
					// Filter out cells with numbers (exclude null)
					const numbersInRow = row.filter((n) => n !== null) as number[];

					// Check if all numbers in this row have been called
					const fullRow = numbersInRow.every((num) => usedNumbers.has(num));

					if (fullRow && numbersInRow.length > 0) {
						isWinner = true;
						break; // Only one full row is needed to win
					}
				}

				if (isWinner) {
					// Get the winner's name
					const winnerName = players.get(socket.id) || 'Người chơi ẩn danh';
                    broadcastSystemLog(`🏆 CHÚC MỪNG ${winnerName} ĐÃ KINH!!!`, 'success');
					// Notify everyone in the room
					io.emit('game-over', { winnerName });
				} else {
					// Notify the player individually (No win)
                    broadcastSystemLog(`❌ ${name} kinh trượt rồi! Phạt đê!`, 'error');
					socket.emit('check-fail');
				}
			});

			// When a new user joins, immediately send the list of called numbers for them to update
			socket.emit('sync-state', Array.from(usedNumbers));
		});
	}
};

export default defineConfig({ plugins: [tailwindcss(), sveltekit(), webSocketServer] });
