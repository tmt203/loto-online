<script lang="ts">
	import type { Ticket } from '$lib/lotoLogic';

	let { sheet } = $props<{ sheet: Ticket }>();

	// Use Set to store marked positions (as strings "rowIndex-colIndex")
	let markedCells = $state(new Set<string>());

	function toggleCell(r: number, c: number, value: number | null) {
		// Prevent clicking on empty cells
		if (value === null) return;

		// Generate a unique key for this cell
		const key = `${r}-${c}`;

		// Clone the set to trigger reactivity
		const newSet = new Set(markedCells);

		if (newSet.has(key)) {
			newSet.delete(key); // Remove mark
		} else {
			newSet.add(key); // Mark
		}

		markedCells = newSet;
	}
</script>

<div
	class="mx-auto max-w-full rounded-lg border-4 border-yellow-600 bg-yellow-600 p-1 shadow-2xl select-none"
>
	<div class="grid grid-cols-9 gap-0.5 bg-yellow-600">
		{#each sheet as row, rowIndex}
			{#each row as cell, colIndex}
				{@const isMarked = markedCells.has(`${rowIndex}-${colIndex}`)}

				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="
						/* Màu nền cơ bản */ relative flex h-12 cursor-pointer
						items-center justify-center overflow-hidden rounded-sm
						
						text-lg font-bold transition-all duration-150 sm:h-14 sm:text-xl
						{cell ? 'bg-white text-red-600' : 'bg-yellow-100/50'}

						/* Hiệu ứng phân cách giữa các vé con */
						{(rowIndex + 1) % 3 === 0 && colIndex === 0 ? 'mb-1' : ''} 
                        {(rowIndex + 1) % 3 === 0 ? 'mb-2' : ''}
					"
					onclick={() => toggleCell(rowIndex, colIndex, cell)}
				>
					<span class="z-10 {isMarked ? 'text-white' : ''}">{cell || ''}</span>

					{#if isMarked}
						<div
							class="animate-in zoom-in absolute inset-1 rounded-full bg-red-600 shadow-inner duration-200"
						></div>
					{/if}
				</div>
			{/each}
		{/each}
	</div>
</div>
