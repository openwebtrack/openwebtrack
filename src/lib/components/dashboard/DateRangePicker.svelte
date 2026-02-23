<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';

	let { value = 'Last 7 days', onSelect } = $props<{
		value?: string;
		onSelect?: (range: { start: string; end: string }, value: string) => void;
	}>();

	const options = ['Today', 'Yesterday', 'Last 24 hours', 'Last 7 days', 'Last 30 days', 'Last 12 months', 'Week to date', 'Month to date', 'Year to date', 'All time'];

	const getDateRange = (option: string): { start: string; end: string } => {
		const now = new Date();
		const end = new Date(now);
		let start = new Date(now);

		switch (option) {
			case 'Today':
				start.setHours(0, 0, 0, 0);
				break;
			case 'Yesterday':
				start.setDate(start.getDate() - 1);
				start.setHours(0, 0, 0, 0);
				end.setDate(end.getDate() - 1);
				end.setHours(23, 59, 59, 999);
				break;
			case 'Last 24 hours':
				start.setHours(start.getHours() - 24);
				break;
			case 'Last 7 days':
				start.setDate(start.getDate() - 7);
				break;
			case 'Last 30 days':
				start.setDate(start.getDate() - 30);
				break;
			case 'Last 12 months':
				start.setMonth(start.getMonth() - 12);
				break;
			case 'Week to date':
				start.setDate(start.getDate() - start.getDay());
				start.setHours(0, 0, 0, 0);
				break;
			case 'Month to date':
				start.setDate(1);
				start.setHours(0, 0, 0, 0);
				break;
			case 'Year to date':
				start.setMonth(0, 1);
				start.setHours(0, 0, 0, 0);
				break;
			case 'All time':
				start = new Date('2020-01-01');
				break;
			default:
				start.setDate(start.getDate() - 7);
		}

		return {
			start: start.toISOString(),
			end: end.toISOString()
		};
	};

	let selectedValue = $state(value);

	$effect(() => {
		selectedValue = value;
	});

	const handleValueChange = (newValue: string) => {
		selectedValue = newValue;
		if (newValue && onSelect) {
			onSelect(getDateRange(newValue), newValue);
		}
	};
</script>

<Select.Root value={selectedValue} onValueChange={handleValueChange} type="single">
	<Select.Trigger class="h-[34px] border-border bg-secondary hover:border-muted-foreground">
		{selectedValue}
	</Select.Trigger>
	<Select.Content class="border-border bg-card">
		{#each options as option}
			<Select.Item value={option} label={option} />
		{/each}
	</Select.Content>
</Select.Root>
