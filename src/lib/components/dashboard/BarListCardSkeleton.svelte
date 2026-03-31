<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
</script>

<div class="flex h-[400px] max-h-[400px] min-h-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
	<div class="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
		<div class="flex items-center gap-2">
			<Skeleton class="h-8 w-20 rounded-lg" />
			<Skeleton class="h-8 w-20 rounded-lg" />
		</div>
		<Skeleton class="h-7 w-7 rounded-md" />
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		<div class="flex flex-col gap-2">
			{#each Array(6) as _}
				<div class="group relative flex h-8 items-center overflow-hidden rounded">
					<div class="absolute inset-y-0 left-0 bg-primary/10"></div>

					<div class="relative z-10 flex w-full items-center justify-between px-3">
						<div class="flex items-center gap-2">
							<Skeleton class="h-4 w-4 rounded-sm" />
							<Skeleton class="h-4 w-32" />
						</div>
						<Skeleton class="h-4 w-8" />
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
