<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
</script>

<div class="flex h-[339px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
	<div class="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
		<div class="flex items-center gap-2">
			<!-- Tabs -->
			<div class="flex items-center gap-2">
				<Skeleton class="h-8 w-20 rounded-lg" />
				<Skeleton class="h-8 w-20 rounded-lg" />
			</div>
		</div>
	</div>

	<div class="flex-1 p-4">
		<!-- List Items -->
		<div class="flex flex-col gap-2">
			{#each Array(8) as _}
				<div class="relative flex h-8 items-center overflow-hidden rounded">
					<!-- Progress bar background skeleton -->
					<div class="absolute inset-y-0 left-0 w-3/4 bg-primary/5"></div>

					<div class="relative z-10 flex w-full items-center justify-between px-3">
						<div class="flex items-center gap-2">
							<!-- Icon (optional) -->
							<Skeleton class="h-4 w-4 rounded-sm" />
							<!-- Label -->
							<Skeleton class="h-4 w-32" />
						</div>
						<!-- Value -->
						<Skeleton class="h-4 w-8" />
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Details footer -->
	<div class="flex items-center justify-center border-t border-border bg-muted/30 px-4 py-3">
		<Skeleton class="h-4 w-16" />
	</div>
</div>
