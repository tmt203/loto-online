<script lang="ts">
	import { generateSheet, type Ticket } from '$lib/lotoLogic';
	import TicketBoard from '$lib/components/Ticket.svelte';
	import { onMount } from 'svelte';
	import { io } from 'socket.io-client';
	import confetti from 'canvas-confetti';

	type ChatMessage = {
		type: 'system' | 'user';
		subType?: 'info' | 'success' | 'warning' | 'error';
		sender?: string;
		content: string;
		timestamp: number;
	};

	const prefixes = [
		'Số gì đây, số gì đây...',
		'Cờ ra con mấy, con mấy gì đây...',
		'Lẳng lặng mà nghe, tôi kêu con cờ...',
		'Con số...',
		'Xin mời con số...'
	];

	let mySheet: Ticket | null = $state(null);
	let currentNumber: number | null = $state(null); // Current called number
	let history: number[] = $state([]); // History of called numbers
	let socket: any;
	let playerName = $state('');
	let isJoined = $state(false);
	let isHost = $state(false);
	let onlinePlayers: string[] = $state([]);
	let isSoundOn = $state(true);
	let currentAudio: HTMLAudioElement | null = null;

	// --- STATE CHO CHAT ---
	let messages: ChatMessage[] = $state([]);
	let chatInput = $state('');
	let chatBoxRef: HTMLDivElement | null = $state(null);

	function createNewSheet() {
		mySheet = generateSheet();
	}

	function callNextNumber() {
		socket?.emit('call-number');
	}

	function resetGame() {
		if (confirm('Bạn chắc chắn muốn xoá hết làm ván mới?')) {
			socket?.emit('reset-game');
		}
	}

	function checkWin() {
		if (!mySheet) return;
		// Send ticket to server for win checking
		socket?.emit('request-check-win', mySheet);
	}

	function fireConfetti() {
		const duration = 3000;
		const end = Date.now() + duration;

		(function frame() {
			confetti({
				particleCount: 5,
				angle: 60,
				spread: 55,
				origin: { x: 0 }
			});
			confetti({
				particleCount: 5,
				angle: 120,
				spread: 55,
				origin: { x: 1 }
			});

			if (Date.now() < end) {
				requestAnimationFrame(frame);
			}
		})();
	}

	function joinGame() {
		if (!playerName.trim()) return alert('Nhập cái tên cho vui nhà vui cửa đi bạn!');

		isJoined = true;
		// Send name to server
		socket.emit('join-game', playerName);

		// Create ticket immediately
		createNewSheet();
	}

	function sendChat() {
		if (!chatInput.trim()) return;
		socket?.emit('send-chat', chatInput);
		chatInput = ''; // Clear input
	}

	// Auto scroll to bottom when new message arrives
	$effect(() => {
		if (messages.length && chatBoxRef) {
			chatBoxRef.scrollTop = chatBoxRef.scrollHeight;
		}
	});

	onMount(() => {
		socket = io();

		// Receive new number from Server
		socket.on('new-number', (num: number) => {
			currentNumber = num;
			history = [...history, num]; // Update history
		});

		// Synchronize state on joining
		socket.on('sync-state', (existingNumbers: number[]) => {
			history = existingNumbers;
			if (existingNumbers.length > 0) {
				currentNumber = existingNumbers[existingNumbers.length - 1];
			}
		});

		// Update online players list
		socket.on('update-players', (names: string[]) => {
			onlinePlayers = names;
		});

		// Handle incoming chat messages and system logs
		socket.on('receive-chat', (msg: ChatMessage) => {
			messages = [...messages, msg];
		});

		// Handle game reset
		socket.on('game-reset', () => {
			currentNumber = null;
			history = [];
			alert('Ván mới bắt đầu! 🏁');
		});

		// Handle when someone wins
		socket.on('game-over', (data: { winnerName: string }) => {
			fireConfetti();
			alert(`🏆 CHÚC MỪNG!!!\n${data.winnerName} đã KINH rồi! (Chuẩn bị lì xì nhé)`);
		});

		// Handle check-fail event
		socket.on('check-fail', () => {
			alert('❌ Kinh trượt rồi bạn ơi! Kiểm tra lại đi (Phạt 1 ly 🍺)');
		});

		// Handle role assignment
		socket.on('role-update', (data: { isHost: boolean }) => {
			isHost = data.isHost;
			if (isHost) {
				alert('👑 Bạn là NHÀ CÁI! Bạn có quyền Hô Số.');
			}
		});

		createNewSheet(); // Generate my ticket

		return () => socket.disconnect();
	});
</script>

<div class="flex h-[calc(100%-70px)] w-full flex-col overflow-hidden bg-red-800 text-center">
	{#if !isJoined}
		<div class="flex h-full w-full items-center justify-center p-4">
			<div
				class="w-full max-w-md rounded-xl border-2 border-yellow-500 bg-red-900/80 p-8 shadow-2xl backdrop-blur-md"
			>
				<h2 class="mb-6 text-3xl font-bold text-yellow-400 uppercase">🧧 Ghi Danh 🧧</h2>
				<input
					type="text"
					bind:value={playerName}
					placeholder="Nhập tên của bạn..."
					class="mb-6 w-full rounded border border-red-700 bg-red-950 px-4 py-3 text-center text-lg text-yellow-100 placeholder-red-400 focus:border-yellow-500 focus:outline-none"
					onkeydown={(e) => e.key === 'Enter' && joinGame()}
				/>
				<button
					onclick={joinGame}
					class="w-full transform rounded bg-linear-to-r from-yellow-500 to-yellow-600 py-3 text-xl font-black text-red-900 shadow-lg transition hover:from-yellow-400 hover:to-yellow-500 active:scale-95"
				>
					VÀO SÒNG NGAY 🎲
				</button>
			</div>
		</div>
	{:else}
		<div class="relative z-50 w-full flex-none border-b-2 border-yellow-600 bg-red-900 shadow-lg">
			<div class="flex items-center justify-between gap-2 px-3 py-2 md:gap-4">
				<div class="flex shrink-0 items-center gap-2 md:gap-4">
					{#if currentNumber}
						<div
							class="flex h-14 w-14 animate-bounce items-center justify-center rounded-full border-2 border-white bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)] md:h-16 md:w-16"
						>
							<span class="text-3xl font-black text-red-900 md:text-4xl">{currentNumber}</span>
						</div>
					{:else}
						<div
							class="flex h-14 w-14 items-center justify-center rounded-full border-2 border-yellow-600 bg-red-950 text-xs text-yellow-500 italic"
						>
							Chờ...
						</div>
					{/if}

					<div class="hidden text-left md:block">
						<div class="text-xs text-yellow-200/60">Người chơi</div>
						<div class="max-w-25 truncate font-bold text-yellow-400">{playerName}</div>
					</div>
				</div>

				<div class="flex-1 overflow-hidden px-2">
					<div class="glass-scrollbar mask-gradient flex gap-1 overflow-x-auto">
						{#each [...history].reverse() as num}
							<span
								class="inline-block shrink-0 rounded border border-yellow-500/30 bg-black/30 px-2 py-1 text-sm font-bold text-yellow-100"
							>
								{num}
							</span>
						{/each}
					</div>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<button
						onclick={() => (isSoundOn = !isSoundOn)}
						class="rounded-full border border-yellow-600/30 bg-black/30 p-2 text-yellow-400 transition hover:bg-black/50"
						title={isSoundOn ? 'Tắt giọng đọc' : 'Bật giọng đọc'}
					>
						{#if isSoundOn}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="h-5 w-5 md:h-6 md:w-6"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
								/>
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="h-5 w-5 text-red-400 md:h-6 md:w-6"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
								/>
							</svg>
						{/if}
					</button>

					{#if isHost}
						<button
							onclick={callNextNumber}
							class="rounded bg-green-600 px-3 py-2 text-sm font-bold whitespace-nowrap text-white shadow hover:bg-green-500"
						>
							🎤 Hô
						</button>
					{/if}

					<button
						onclick={checkWin}
						class="animate-pulse rounded-full border-2 border-yellow-400 bg-red-600 px-4 py-2 text-lg font-black text-yellow-300 shadow-lg hover:animate-none hover:bg-red-500"
					>
						KINH!
					</button>

					{#if isHost}
						<button
							onclick={resetGame}
							class="hidden rounded bg-gray-600 px-3 py-2 text-xs text-white shadow hover:bg-gray-500 md:block"
						>
							🗑️
						</button>
					{/if}
				</div>
			</div>

			<div class="h-1 w-full bg-linear-to-r from-red-800 via-yellow-500 to-red-800"></div>
		</div>

		<div
			class="glass-scrollbar flex w-full flex-1 justify-center overflow-y-auto bg-red-800 p-2 pb-40 md:px-0 md:pb-10"
		>
			<div
				class="mt-4 w-full max-w-3xl origin-top scale-95 transition-transform md:mt-8 md:scale-100"
			>
				{#if mySheet}
					<TicketBoard sheet={mySheet} />
				{/if}
			</div>
		</div>

		<div
			class="fixed bottom-4 left-4 z-40 hidden w-48 rounded-lg border border-yellow-600 bg-black/80 p-3 shadow-lg backdrop-blur-md transition-all md:block"
		>
			<h3
				class="mb-2 flex items-center gap-2 border-b border-yellow-600/50 pb-1 text-xs font-bold text-yellow-400 uppercase"
			>
				<span class="relative flex h-2 w-2">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
					></span>
					<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
				</span>
				Online ({onlinePlayers.length})
			</h3>
			<ul class="glass-scrollbar max-h-40 overflow-y-auto text-left text-sm">
				{#each onlinePlayers as player}
					<li class="truncate py-0.5 text-yellow-100/90">
						👾 {player}
						{player === playerName ? '(Bạn)' : ''}
					</li>
				{/each}
			</ul>
		</div>

		<div
			class="fixed right-2 bottom-2 z-40 flex h-48 w-[calc(100%-1rem)] flex-col rounded-lg border border-yellow-600 bg-red-950/95 shadow-2xl backdrop-blur-md md:right-4 md:bottom-4 md:h-80 md:w-80"
		>
			<div
				class="flex cursor-pointer justify-between rounded-t border-b border-yellow-800 bg-red-900/80 p-1.5 px-3 text-xs font-bold text-yellow-400 uppercase"
			>
				<span>💬 Sòng Chat</span>
				<span class="text-[10px] opacity-70">Kéo để xem Log</span>
			</div>

			<div
				bind:this={chatBoxRef}
				class="glass-scrollbar flex-1 space-y-1.5 overflow-y-auto scroll-smooth bg-black/20 p-2 text-left"
			>
				{#each messages as msg}
					{#if msg.type === 'system'}
						<div
							class="rounded border-l-2 bg-black/10 px-2 py-0.5 text-[10px] italic md:text-xs
							{msg.subType === 'success'
								? 'border-green-500 text-green-200'
								: msg.subType === 'error'
									? 'border-red-500 text-red-200'
									: msg.subType === 'warning'
										? 'border-orange-500 text-orange-200'
										: 'border-blue-500 text-blue-200'}"
						>
							{msg.content}
						</div>
					{:else}
						<div class="text-xs md:text-sm">
							<span class="font-bold text-yellow-400">{msg.sender}:</span>
							<span class="wrap-break-word text-white">{msg.content}</span>
						</div>
					{/if}
				{/each}
			</div>

			<div class="border-t border-yellow-600/30 bg-red-900/50 p-1.5 md:p-2">
				<input
					type="text"
					bind:value={chatInput}
					placeholder="Chat ở đây..."
					class="w-full rounded border border-red-700 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-yellow-500 focus:outline-none md:text-sm"
					onkeydown={(e) => e.key === 'Enter' && sendChat()}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	/* GLASS SCROLLBAR STYLE */
	.glass-scrollbar {
		/* Firefox */
		scrollbar-width: thin;
		scrollbar-color: rgba(250, 204, 21, 0.2) transparent; /* Màu vàng mờ */
		transition: scrollbar-color 0.3s ease;
	}

	/* Webkit (Chrome, Edge, Safari) */
	.glass-scrollbar::-webkit-scrollbar {
		width: 8px; /* Chiều rộng cho thanh dọc */
		height: 8px; /* Chiều cao cho thanh ngang */
	}

	.glass-scrollbar::-webkit-scrollbar-track {
		background: transparent; /* Nền trong suốt */
	}

	.glass-scrollbar::-webkit-scrollbar-thumb {
		background-color: rgba(250, 204, 21, 0.2); /* Thanh cuộn mờ (trạng thái nghỉ) */
		border-radius: 20px; /* Bo tròn viên thuốc */
		border: 2px solid transparent; /* Tạo khoảng hở (padding) giả */
		background-clip: content-box;
	}

	/* TRẠNG THÁI HOVER: Khi chuột vào vùng chứa -> Hiện rõ thanh cuộn */
	.glass-scrollbar:hover {
		scrollbar-color: rgba(250, 204, 21, 0.8) transparent;
	}

	.glass-scrollbar:hover::-webkit-scrollbar-thumb {
		background-color: rgba(250, 204, 21, 0.8); /* Hiện rõ màu vàng */
	}
</style>
