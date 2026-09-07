<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
</script>

<div class="glass-card flex h-[400px] max-h-[400px] min-h-[400px] flex-col overflow-hidden rounded-2xl">
	<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
		<div class="flex items-center gap-1">
			<Skeleton class="h-6 w-16 rounded-full" />
			<Skeleton class="h-6 w-16 rounded-full" />
		</div>
		<Skeleton class="h-7 w-7 rounded-full" />
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		<div class="flex flex-col gap-0.5">
			{#each Array(6) as _}
				<div class="group relative flex h-8 items-center overflow-hidden rounded-lg">
					<div class="absolute inset-y-0 left-0 bg-primary/10"></div>

					<div class="relative z-10 flex w-full items-center justify-between px-3">
						<div class="flex items-center gap-2">
							<Skeleton class="h-3.5 w-3.5 rounded-sm" />
							<Skeleton class="h-3 w-32" />
						</div>
						<Skeleton class="h-3 w-8" />
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
