<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { io } from 'socket.io-client';

	let { children } = $props();

	onMount(() => {
		// Connect to the current server
		const socket = io();

		// Listen for messages from the server
		socket.on('server-message', (data) => {
			console.log('Server nhắn:', data);
			alert(data);
		});

		// Clear up when the component is destroyed (user closes tab/navigates away)
		return () => {
			socket.disconnect();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Lô Tô Online - Tết 2026</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-red-800 font-sans text-yellow-400">
	<header class="border-b-2 border-yellow-500 bg-red-900 p-4 text-center shadow-md">
		<h1 class="text-3xl font-bold tracking-widest uppercase drop-shadow-md">
			🧧 Lô Tô Truyền Thống 🧧
		</h1>
	</header>

	<main class="container mx-auto flex flex-1 flex-col items-center justify-center p-4">
		{@render children()}
	</main>

	<footer class="p-2 text-center text-xs text-red-300 opacity-60">
		Chúc Mừng Năm Mới {new Date().getFullYear()}
	</footer>
</div>
