<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';

	let { value = 'Daily', onSelect } = $props<{
		value?: string;
		onSelect?: (option: string) => void;
	}>();

	const options = ['Hourly', 'Daily', 'Weekly', 'Monthly'];

	let selectedValue = $state(value);

	$effect(() => {
		selectedValue = value;
	});

	const handleValueChange = (newValue: string) => {
		selectedValue = newValue;
		if (newValue && onSelect) {
			onSelect(newValue);
		}
	};
</script>

<Select.Root value={selectedValue} onValueChange={handleValueChange} type="single">
	<Select.Trigger class="border-border bg-secondary hover:border-muted-foreground">
		{selectedValue}
	</Select.Trigger>
	<Select.Content class="border-border bg-card">
		{#each options as option}
			<Select.Item value={option} label={option} />
		{/each}
	</Select.Content>
</Select.Root>
