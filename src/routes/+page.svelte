<script lang="ts">
	import { generateSheet, type Ticket } from '$lib/lotoLogic';
	import TicketBoard from '$lib/components/Ticket.svelte';
	import { onMount } from 'svelte';
	import { io } from 'socket.io-client';
	import confetti from 'canvas-confetti';
	import { isEnterGame } from '$lib/store/globalStorage';

	type PlayerInfo = {
		id: string;
		name: string;
		balance: number;
		isHost: boolean;
		hasTicket: boolean;
	};

	type GameState = 'IDLE' | 'BETTING' | 'PLAYING';

	type ModalType = 'info' | 'error' | 'success' | 'confirm' | 'win';

	// --- STATE ---
	let socket: any = $state(null);
	let isJoined = $state(false);
	let playerName = $state('');
	let modal = $state({
		isOpen: false,
		type: 'info' as ModalType,
		title: '',
		message: '',
		onConfirm: () => {} // Callback cho nút Đồng ý
	});

	// Game Data
	let mySheet: Ticket | null = $state(null);
	let currentNumber: number | null = $state(null);
	let history: number[] = $state([]);
	let onlinePlayers: PlayerInfo[] = $state([]);
	let currentPot = $state(0);
	let currentTicketPrice = $state(0);
	let gameState: GameState = $state('IDLE');

	// Derived State
	let isHost = $derived(onlinePlayers.find((p) => p.name === playerName)?.isHost || false);
	let myInfo = $derived(onlinePlayers.find((p) => p.name === playerName));
	let sortedPlayers = $derived([...onlinePlayers].sort((a, b) => b.balance - a.balance));

	// Host Input
	let inputPrice = $state(20); // Giá mặc định 20k
	let showRanking = $state(false);

	// Chat
	let messages: any[] = $state([]);
	let chatInput = $state('');
	let chatBoxRef: HTMLDivElement | null = $state(null);

	// --- ACTIONS ---
	// -------------------- Start: MODAL ACTIONS --------------------
	function closeModal() {
		modal.isOpen = false;
	}

	function showToast(title: string, message: string, type: ModalType = 'info') {
		modal.type = type;
		modal.title = title;
		modal.message = message;
		modal.isOpen = true;
	}

	function showConfirmModal(title: string, message: string, onConfirmAction: () => void) {
		modal.type = 'confirm';
		modal.title = title;
		modal.message = message;
		modal.onConfirm = () => {
			onConfirmAction();
			closeModal();
		};
		modal.isOpen = true;
	}

	function showWinModal(winnerName: string, amount: number) {
		modal.type = 'win';
		modal.title = '🏆 KINH RỒI !!!';
		modal.message = `Chúc mừng đại gia <strong>${winnerName}</strong> đã hốt trọn hũ <span class="text-yellow-300 text-3xl font-black">${amount}k</span>`;
		modal.isOpen = true;
		fireConfetti();
	}
	// -------------------- End: MODAL ACTIONS --------------------

	function createNewSheet() {
		mySheet = generateSheet();
	}

	function joinGame() {
		if (!playerName.trim())
			return showToast('⚠️ Lỗi Tên', 'Nhập cái tên cho vui nhà vui cửa đi bạn!', 'error');
		isJoined = true;
		$isEnterGame = true;
		socket.emit('join-game', playerName);
	}

	function hostOpenBetting() {
		if (inputPrice <= 0) return showToast('⚠️ Lỗi Giá', 'Giá vé phải lớn hơn 0k chứ!', 'error');
		socket.emit('host-open-betting', inputPrice);
	}

	function buyTicket() {
		createNewSheet();
		socket.emit('buy-ticket');
	}

	function hostStartGame() {
		socket.emit('host-start-game');
	}

	function callNextNumber() {
		socket?.emit('call-number');
	}

	function resetGame() {
		showConfirmModal('⚠️ Huỷ Ván?', 'Bạn có chắc muốn huỷ ván này và làm lại từ đầu?', () => {
			socket?.emit('reset-game');
		});
	}

	function checkWin() {
		if (!mySheet) return;
		socket?.emit('request-check-win', mySheet);
	}

	function sendChat() {
		if (!chatInput.trim()) return;
		socket?.emit('send-chat', chatInput);
		chatInput = '';
	}

	function fireConfetti() {
		confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
	}

	$effect(() => {
		if (messages.length && chatBoxRef) chatBoxRef.scrollTop = chatBoxRef.scrollHeight;
	});

	onMount(() => {
		socket = io();

		socket.on('update-game-state', (data: any) => {
			onlinePlayers = data.players;
			currentPot = data.pot;
			currentTicketPrice = data.ticketPrice;
			gameState = data.gameState;
		});

		socket.on('new-number', (num: number) => {
			currentNumber = num;
			history = [...history, num];
		});

		socket.on('sync-numbers', (nums: number[]) => {
			history = nums;
			if (nums.length) currentNumber = nums[nums.length - 1];
		});

		socket.on('game-reset', () => {
			currentNumber = null;
			history = [];
		});

		socket.on('receive-chat', (msg: any) => (messages = [...messages, msg]));

		socket.on('game-over', (data: any) => {
			showWinModal(data.winnerName, data.winAmount);
		});

		socket.on('check-fail', () => {
			showToast('❌ KINH HỤT', 'Kiểm tra lại đi bạn ơi! Phạt 1 ly bia nha 🍺!', 'error');
		});

		socket.on('role-update', (data: any) => {
			if (data.isHost) showToast('👑 Thăng Chức', 'Bạn đã trở thành NHÀ CÁI!', 'success');
		});

		return () => socket.disconnect();
	});
</script>

<div
	class="flex w-full flex-col overflow-hidden bg-red-800 {isJoined
		? 'h-screen'
		: 'h-[calc(100%-70px)]'}"
>
	{#if !isJoined}
		<div class="flex h-full w-full items-center justify-center p-4">
			<div
				class="w-full max-w-md rounded-xl border-2 border-yellow-500 bg-red-900/80 p-8 shadow-2xl backdrop-blur-md"
			>
				<input
					type="text"
					bind:value={playerName}
					placeholder="Cho xin cái tên đi bạn ei..."
					class="mb-6 w-full rounded border border-red-700 bg-red-950 px-4 py-3 text-center text-lg text-yellow-100 placeholder-red-400 focus:border-yellow-500 focus:outline-none"
					onkeydown={(e) => e.key === 'Enter' && joinGame()}
				/>
				<button
					onclick={joinGame}
					disabled={playerName.trim() === ''}
					class="w-full rounded bg-linear-to-r from-yellow-500 to-yellow-600 py-3 text-xl font-black text-red-900 shadow-lg hover:from-yellow-400 hover:to-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
					>VÀO SÒNG 🎲</button
				>
			</div>
		</div>
	{:else}
		<div class="flex h-full w-full flex-col overflow-hidden text-center lg:flex-row">
			<div
				class="z-30 flex w-full flex-none flex-col border-b-2 border-yellow-600 bg-red-900 shadow-xl lg:h-full lg:w-1/4 lg:border-r-2 lg:border-b-0"
			>
				<div class="flex items-center justify-between gap-2 p-2 lg:flex-col lg:gap-6 lg:p-6">
					<div
						class="flex min-w-20 flex-col items-center justify-center rounded-lg border border-yellow-500/50 bg-black/40 px-3 py-1 lg:w-full lg:py-2"
					>
						<span class="text-[10px] tracking-widest text-yellow-200 uppercase lg:text-xs"
							>Hũ Vàng</span
						>
						<span
							class="text-lg font-black text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)] lg:text-4xl"
						>
							💰 {currentPot}k
						</span>
					</div>

					<div class="relative">
						{#if currentNumber}
							<div
								class="flex h-12 w-12 animate-bounce items-center justify-center rounded-full border-2 border-white bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] lg:h-32 lg:w-32 lg:border-4"
							>
								<span class="text-2xl font-black text-red-900 lg:text-7xl">{currentNumber}</span>
							</div>
						{:else}
							<div
								class="flex h-12 w-12 items-center justify-center rounded-full border-2 border-yellow-600 bg-red-950 text-[10px] text-yellow-500 italic lg:h-32 lg:w-32 lg:text-sm"
							>
								Chờ...
							</div>
						{/if}
					</div>

					<div class="flex-1 overflow-hidden px-2 lg:hidden">
						<div class="glass-scrollbar mask-gradient flex gap-1 overflow-x-auto pb-1">
							{#each [...history].reverse() as num}
								<span
									class="inline-block shrink-0 rounded border border-yellow-500/30 bg-black/30 px-2 py-1 text-sm font-bold text-yellow-100"
									>{num}</span
								>
							{/each}
						</div>
					</div>

					<div class="flex shrink-0 items-center gap-2 lg:w-full lg:flex-col lg:gap-3">
						<button
							onclick={() => (showRanking = true)}
							class="rounded-full bg-yellow-500 p-2 text-red-900 hover:bg-yellow-400 lg:hidden"
							>🏆</button
						>

						{#if isHost && gameState === 'IDLE'}
							<div
								class="flex items-center gap-1 rounded bg-black/30 p-1 lg:w-full lg:justify-center lg:p-3"
							>
								<input
									type="number"
									bind:value={inputPrice}
									class="w-10 rounded bg-white px-1 py-1 text-center text-sm font-bold text-black lg:w-20 lg:text-lg"
									min="1"
								/>
								<span class="text-xs text-yellow-500 lg:text-base">k</span>
								<button
									onclick={hostOpenBetting}
									class="ml-1 rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-500 lg:ml-2 lg:px-4 lg:py-2 lg:text-base"
									>Mở</button
								>
							</div>
						{/if}

						{#if gameState === 'PLAYING'}
							{#if isHost}
								<button
									onclick={callNextNumber}
									class="rounded bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-500 lg:w-full lg:py-3 lg:text-xl lg:shadow-lg"
									>🎤 Hô</button
								>
							{/if}
							<button
								onclick={checkWin}
								class="animate-pulse rounded-full border-2 border-yellow-400 bg-red-600 px-4 py-2 text-lg font-black text-yellow-300 shadow-lg hover:animate-none hover:bg-red-500 lg:w-full lg:rounded-xl lg:py-4 lg:text-2xl"
								>KINH!</button
							>
						{/if}

						{#if isHost}
							<button
								onclick={resetGame}
								class="rounded bg-gray-600 px-2 py-2 text-xs font-bold text-white shadow hover:bg-gray-500 lg:mt-4 lg:w-full lg:py-2 lg:text-sm"
							>
								🔄 <span class="hidden lg:inline">Huỷ Ván / Reset</span>
							</button>
						{/if}
					</div>
				</div>

				<div class="hidden flex-1 flex-col overflow-hidden bg-black/20 p-4 lg:flex">
					<h3 class="mb-2 text-xs font-bold text-yellow-500 uppercase">
						Lịch sử số gọi ({history.length})
					</h3>
					<div class="glass-scrollbar flex flex-1 flex-wrap content-start gap-1 overflow-y-auto">
						{#each [...history].reverse() as num}
							<span
								class="flex h-8 w-8 items-center justify-center rounded border border-yellow-500/30 bg-black/40 text-sm font-bold text-yellow-100"
								>{num}</span
							>
						{/each}
					</div>
				</div>
			</div>

			<div
				class="glass-scrollbar relative flex flex-1 flex-col items-center overflow-y-auto bg-red-800 p-2 lg:p-6"
			>
				{#if gameState === 'BETTING'}
					<div
						class="animate-fade-in mt-4 w-full max-w-2xl rounded-xl border-2 border-yellow-500 bg-red-900/90 p-4 shadow-2xl backdrop-blur-md lg:mt-20 lg:p-6"
					>
						<h3 class="mb-2 text-2xl font-bold text-yellow-400 uppercase lg:text-3xl">
							🎟️ Sàn Giao Dịch
						</h3>
						<div class="mb-4 flex items-baseline justify-center gap-2 lg:mb-6">
							<span class="text-white">Giá vé:</span>
							<span class="text-3xl font-black text-yellow-300 drop-shadow-md lg:text-4xl"
								>{currentTicketPrice}k</span
							>
						</div>

						<div class="mb-4 border-b border-white/10 pb-4 lg:mb-8 lg:pb-6">
							{#if myInfo?.hasTicket}
								<div
									class="mx-auto max-w-md rounded-lg border border-green-500 bg-green-900/40 p-3 text-green-300 shadow-inner lg:p-4"
								>
									<p class="flex items-center justify-center gap-2 text-lg font-bold lg:text-xl">
										<span>✅</span> Đã vào việc!
									</p>
								</div>
							{:else}
								<div class="mx-auto max-w-xs">
									<div class="mb-2 text-sm text-gray-300">
										Ví: <span class="font-bold text-yellow-400">{myInfo?.balance}k</span>
									</div>
									<button
										onclick={buyTicket}
										class="w-full transform rounded-lg bg-linear-to-b from-green-500 to-green-700 py-3 text-xl font-black text-white shadow-lg transition hover:scale-105 active:scale-95"
									>
										MUA VÉ NGAY 💸
									</button>
								</div>
							{/if}
						</div>

						<div class="grid grid-cols-1 gap-3 text-sm lg:grid-cols-2 lg:gap-4">
							<div class="rounded-lg bg-black/20 p-3 lg:p-4">
								<h4
									class="mb-2 border-b border-green-500/50 pb-1 font-bold text-green-400 uppercase"
								>
									🚀 Đã Mua ({onlinePlayers.filter((p) => p.hasTicket).length})
								</h4>
								<ul class="glass-scrollbar max-h-32 overflow-y-auto text-left lg:max-h-40">
									{#each onlinePlayers.filter((p) => p.hasTicket) as p}
										<li
											class="mb-1 flex items-center gap-2 rounded bg-green-900/30 px-2 py-1 text-green-100"
										>
											<span>🎫</span>
											{p.name}
										</li>
									{/each}
								</ul>
							</div>
							<div class="rounded-lg bg-black/20 p-3 lg:p-4">
								<h4 class="mb-2 border-b border-red-500/50 pb-1 font-bold text-red-400 uppercase">
									🐌 Đang Lề Mề ({onlinePlayers.filter((p) => !p.hasTicket).length})
								</h4>
								<ul class="glass-scrollbar max-h-32 overflow-y-auto text-left lg:max-h-40">
									{#each onlinePlayers.filter((p) => !p.hasTicket) as p}
										<li
											class="mb-1 flex items-center gap-2 rounded bg-red-900/30 px-2 py-1 text-red-100"
										>
											⏳ {p.name}
										</li>
									{/each}
								</ul>
							</div>
						</div>

						{#if isHost}
							<div class="mt-4 border-t border-white/20 pt-4 lg:mt-6 lg:pt-6">
								<button
									onclick={hostStartGame}
									class="mx-auto w-full max-w-md transform rounded-lg bg-linear-to-r from-yellow-500 to-orange-500 py-3 text-xl font-black text-red-900 shadow-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 lg:py-4 lg:text-2xl"
									disabled={onlinePlayers.filter((p) => p.hasTicket).length === 0}
								>
									{onlinePlayers.filter((p) => p.hasTicket).length === 0
										? 'Chờ người mua vé...'
										: '▶️ BẮT ĐẦU QUAY SỐ'}
								</button>
							</div>
						{/if}
					</div>
				{:else if myInfo?.hasTicket && mySheet}
					<div
						class="mt-2 w-full max-w-3xl origin-top scale-95 transition-transform lg:mt-20 lg:scale-100"
					>
						<TicketBoard sheet={mySheet} />
					</div>
				{:else if !myInfo?.hasTicket && gameState === 'PLAYING'}
					<div class="mt-10 flex flex-col items-center justify-center p-4 text-yellow-200 lg:mt-20">
						<div class="mb-4 animate-bounce text-6xl">🍿</div>
						<h3 class="text-2xl font-bold text-yellow-400 uppercase">Ván Đang Diễn Ra</h3>
						<p class="mt-2 text-sm text-white/80">Bạn vui lòng ngồi xem mọi người chơi nhé.</p>
					</div>
				{:else if gameState === 'IDLE'}
					<div class="mt-20 flex flex-col items-center justify-center opacity-60">
						<div class="text-8xl">🧧</div>
						<p class="mt-4 text-xl font-bold text-yellow-200">Chờ Nhà Cái lên kèo...</p>
					</div>
				{/if}
			</div>

			<div
				class="z-40 flex h-48 w-full flex-none flex-col border-t-2 border-yellow-600 bg-red-950 shadow-[0_-5px_15px_rgba(0,0,0,0.3)] lg:h-full lg:w-1/4 lg:border-t-0 lg:border-l-2 lg:shadow-none"
			>
				<div
					class="flex items-center justify-between border-b border-yellow-800 bg-red-900/80 px-3 py-1.5 text-xs font-bold text-yellow-400 uppercase lg:p-2"
				>
					<span class="flex items-center gap-2">
						💬 Sòng Chat
						<span class="rounded bg-green-600 px-1.5 py-0.5 text-[10px] text-white lg:hidden"
							>{onlinePlayers.length} Online</span
						>
					</span>
					<span class="hidden text-[10px] text-yellow-200/50 lg:block"
						>Ví bạn: {myInfo?.balance}k</span
					>
				</div>

				<div class="hidden h-1/3 flex-col border-b border-yellow-600/50 bg-black/20 p-2 lg:flex">
					<ul class="glass-scrollbar flex-1 overflow-y-auto pr-1">
						{#each sortedPlayers as p, i}
							<li
								class="mb-1 flex items-center justify-between rounded bg-white/5 p-2 text-sm hover:bg-white/10"
							>
								<div class="flex items-center gap-2">
									<span class="text-xs font-bold text-yellow-600">#{i + 1}</span>
									<span
										class="max-w-25 truncate font-bold {p.id === socket.id
											? 'text-yellow-300'
											: 'text-gray-200'}">{p.name}</span
									>
									{#if p.isHost}<span class="text-[10px]">👑</span>{/if}
								</div>
								<span
									class="font-mono font-bold {p.balance >= 0 ? 'text-green-400' : 'text-red-400'}"
									>{p.balance}k</span
								>
							</li>
						{/each}
					</ul>
				</div>

				<div class="flex flex-1 flex-col bg-black/20 lg:bg-red-900/30">
					<div
						bind:this={chatBoxRef}
						class="glass-scrollbar flex-1 space-y-1 overflow-y-auto p-2 text-left lg:space-y-2 lg:p-3"
					>
						{#each messages as msg}
							{#if msg.type === 'system'}
								<div
									class="rounded border-l-2 bg-black/10 px-2 py-0.5 text-[10px] italic {msg.subType ===
									'success'
										? 'border-green-500 text-green-200'
										: msg.subType === 'error'
											? 'border-red-500 text-red-200'
											: 'border-blue-500 text-blue-200'}"
								>
									{msg.content}
								</div>
							{:else}
								<div class="text-xs lg:text-sm">
									<span class="font-bold text-yellow-400">{msg.sender}:</span>
									<span class="wrap-break-word text-white">{msg.content}</span>
								</div>
							{/if}
						{/each}
					</div>

					<div class="border-t border-yellow-600/30 bg-red-900/50 p-1.5 lg:p-2">
						<input
							type="text"
							bind:value={chatInput}
							placeholder="Chém gió..."
							class="w-full rounded border border-red-700 bg-black/30 px-2 py-1.5 text-xs text-white focus:border-yellow-500 focus:outline-none lg:px-3 lg:py-2 lg:text-sm"
							onkeydown={(e) => e.key === 'Enter' && sendChat()}
						/>
					</div>
				</div>
			</div>
		</div>

		{#if showRanking}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
				onclick={() => (showRanking = false)}
			>
				<div
					class="m-4 w-full max-w-sm rounded-xl border border-yellow-600 bg-red-950 p-6 shadow-2xl"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="mb-4 flex items-center justify-between border-b border-yellow-600 pb-2">
						<h3 class="text-xl font-bold text-yellow-400 uppercase">🏆 Bảng Phong Thần</h3>
						<button onclick={() => (showRanking = false)} class="text-yellow-500 hover:text-white"
							>✕</button
						>
					</div>
					<ul class="glass-scrollbar max-h-[50vh] space-y-2 overflow-y-auto">
						{#each sortedPlayers as p, i}
							<li
								class="flex items-center justify-between rounded bg-black/30 p-3 {p.id === socket.id
									? 'border border-yellow-500'
									: ''}"
							>
								<div class="flex items-center gap-3">
									<span
										class="flex h-8 w-8 items-center justify-center rounded-full bg-red-800 font-bold text-yellow-200"
										>#{i + 1}</span
									>
									<div class="text-left">
										<div class="font-bold text-white {p.id === socket.id ? 'text-yellow-300' : ''}">
											{p.name}
										</div>
										{#if p.isHost}
											<span class="rounded bg-black/50 px-1 text-[10px] text-yellow-500">HOST</span>
										{/if}
									</div>
								</div>
								<span
									class="font-mono text-lg font-bold {p.balance >= 0
										? 'text-green-400'
										: 'text-red-400'}">{p.balance}k</span
								>
							</li>
						{/each}
					</ul>
					<div class="mt-4 text-right text-xs text-gray-400">Ví của bạn: {myInfo?.balance}k</div>
				</div>
			</div>
		{/if}

		{#if modal.isOpen}
			<div
				class="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300"
			>
				<div
					class="mx-4 w-full max-w-md scale-100 transform overflow-hidden rounded-2xl border-2 border-yellow-600 bg-red-900 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all"
				>
					<div
						class="flex items-center justify-between border-b border-yellow-600/50 bg-red-950/50 px-6 py-4"
					>
						<h3 class="text-xl font-black tracking-widest text-yellow-400 uppercase">
							{#if modal.type === 'error'}⛔ Lỗi
							{:else if modal.type === 'success'}✅ Thành Công
							{:else if modal.type === 'confirm'}🤔 Xác Nhận
							{:else if modal.type === 'win'}🏆 Chiến Thắng
							{:else}ℹ️ Thông Báo{/if}
						</h3>
						<button
							onclick={closeModal}
							class="text-2xl leading-none text-yellow-500 hover:text-white">&times;</button
						>
					</div>

					<div class="p-6 text-center">
						<h4 class="mb-2 text-lg font-bold text-white">{modal.title}</h4>
						<div class="text-yellow-100/80">{@html modal.message}</div>
					</div>

					<div class="flex gap-3 border-t border-yellow-600/30 bg-black/20 p-4">
						{#if modal.type === 'confirm'}
							<button
								onclick={closeModal}
								class="flex-1 rounded-lg bg-gray-600 py-3 font-bold text-white hover:bg-gray-500"
								>Huỷ</button
							>
							<button
								onclick={modal.onConfirm}
								class="flex-1 rounded-lg bg-yellow-600 py-3 font-bold text-white hover:bg-yellow-500"
								>Đồng Ý</button
							>
						{:else if modal.type === 'win'}
							<button
								onclick={closeModal}
								class="w-full animate-pulse rounded-lg bg-linear-to-r from-yellow-400 via-orange-500 to-red-500 py-3 text-xl font-black text-white shadow-lg"
								>ĂN MỪNG THÔI! 🎉</button
							>
						{:else}
							<button
								onclick={closeModal}
								class="w-full rounded-lg bg-yellow-600 py-3 font-bold text-white hover:bg-yellow-500"
								>Đã Hiểu</button
							>
						{/if}
					</div>
				</div>
			</div>
		{/if}
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
