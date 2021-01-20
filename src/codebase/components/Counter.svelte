<script>
	let count = 0;

	const increment = () => {
		count += 1;
	};
</script>

<button class="text-red-400 border border-transparent focus:border-red-400" on:click={increment}>
	Clicks: {count}
</button>

<style>
	button {
		font-family: inherit;
		font-size: inherit;
		padding: 1em 2em;
		background-color: rgba(255, 62, 0, 0.1);
		border-radius: 2em;
		outline: none;
		width: 200px;
		font-variant-numeric: tabular-nums;
	}


	button:active {
		background-color: rgba(255, 62, 0, 0.2);
	}
</style>