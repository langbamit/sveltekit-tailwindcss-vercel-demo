
const svelte = require("@sveltejs/snowpack-config")

// Consult https://www.snowpack.dev to learn about these options
module.exports = {
	extends: '@sveltejs/snowpack-config',
	plugins: [
		...svelte.plugins,
		[
		  "@snowpack/plugin-build-script",
		  { cmd: "postcss", input: [".css", ".pcss"], output: [".css"] },
		],
	],
	mount: {
		...svelte.mount,
		'src/codebase': '/_codebase'
	},
	alias: {
		...svelte.alias,
		$: './src/codebase',
	}
};
