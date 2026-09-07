<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
</script>

<div class="glass-card flex h-[500px] flex-col overflow-hidden rounded-2xl">
	<div class="flex items-center justify-between border-b border-border px-4 py-2.5">
		<div class="flex items-center gap-1">
			<Skeleton class="h-6 w-16 rounded-full" />
			<Skeleton class="h-6 w-16 rounded-full" />
		</div>
		<Skeleton class="h-7 w-48 rounded-full" />
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		<div class="mb-2 flex items-center px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
			<div class="flex-1">Visitor</div>
			<div class="hidden w-48 sm:block">Source</div>
			<div class="hidden w-40 text-right sm:block">Last seen</div>
		</div>

		<div class="flex flex-col">
			{#each Array(8) as _}
				<div class="flex items-center rounded-lg px-2 py-2.5">
					<div class="flex flex-1 items-start gap-3 overflow-hidden">
						<Skeleton class="h-8 w-8 shrink-0 rounded-full" />

						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<Skeleton class="h-3.5 w-32" />
							<div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
								<Skeleton class="h-2.5 w-16 rounded-sm" />
								<Skeleton class="h-2.5 w-16 rounded-sm" />
								<Skeleton class="h-2.5 w-16 rounded-sm" />
							</div>
						</div>
					</div>

					<div class="hidden w-48 items-center justify-start gap-2 sm:flex">
						<Skeleton class="h-3.5 w-3.5 rounded-full" />
						<Skeleton class="h-3 w-24" />
					</div>

					<div class="hidden w-40 items-center justify-end sm:flex">
						<Skeleton class="h-3 w-20" />
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
