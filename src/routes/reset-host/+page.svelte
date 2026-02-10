<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		localStorage.setItem('loto_secret', 'trantrideptrai');
		goto('/');
	});
</script>

<div class="flex h-screen w-full items-center justify-center bg-black text-white">
	<p>Đang khôi phục quyền lực tối cao...</p>
</div>
