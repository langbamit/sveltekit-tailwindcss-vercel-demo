'use strict';

var index = require('./index.js');
var path = require('path');
require('module');
require('url');
var fs = require('fs');
var require$$1 = require('child_process');
require('./standard.js');
var util = require('util');
var create_app = require('./create_app.js');
var utils = require('./utils.js');
var rollup = require('rollup');
var rollupPluginTerser = require('rollup-plugin-terser');
var css_chunks = require('rollup-plugin-css-chunks');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1);
var css_chunks__default = /*#__PURE__*/_interopDefaultLegacy(css_chunks);

const inject_styles = `
export default function(files) {
	return Promise.all(files.map(function(file) { return new Promise(function(fulfil, reject) {
		var href = new URL(file, import.meta.url);
		var baseURI = document.baseURI;
		if (!baseURI) {
			var baseTags = document.getElementsByTagName('base');
			baseURI = baseTags.length ? baseTags[0].href : document.URL;
		}
		var relative = ('' + href).substring(baseURI.length);
		var link = document.querySelector('link[rel=stylesheet][href="' + relative + '"]')
			|| document.querySelector('link[rel=stylesheet][href="' + href + '"]');
		if (!link) {
			link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			document.head.appendChild(link);
		}
		if (link.sheet) {
			fulfil();
		} else {
			link.onload = function() { return fulfil() };
			link.onerror = reject;
		}
	})}));
};`.trim();

const INJECT_STYLES_NAME = 'inject_styles';
const INJECT_STYLES_ID = 'inject_styles.js';

const find_css = (chunk, bundle) => {
	const css_files = new Set();
	const visited = new Set();

	const recurse = (c) => {
		if (visited.has(c)) return;
		visited.add(c);

		if (c.imports) {
			c.imports.forEach((file) => {
				if (file.endsWith('.css')) {
					css_files.add(file);
				} else {
					const imported_chunk = bundle[file];
					if (imported_chunk) {
						recurse(imported_chunk);
					}
				}
			});
		}
	};

	recurse(chunk);
	return Array.from(css_files);
};

const css_injection = {
	name: 'svelte-css-injection',
	buildStart() {
		this.emitFile({
			type: 'chunk',
			id: INJECT_STYLES_ID,
			name: INJECT_STYLES_NAME,
			preserveSignature: 'allow-extension'
		});
	},
	load(id) {
		return id === INJECT_STYLES_ID ? inject_styles : null;
	},
	resolveId(importee) {
		return importee === INJECT_STYLES_ID ? INJECT_STYLES_ID : null;
	},
	renderDynamicImport({ targetModuleId }) {
		if (targetModuleId) {
			const t = Buffer.from(targetModuleId).toString('hex');
			return {
				left: 'Promise.all([import(',
				right: `), ___SVELTE_CSS_INJECTION___${t}___]).then(function(x) { return x[0]; })`
			};
		} else {
			return {
				left: 'import(',
				right: ')'
			};
		}
	},
	async generateBundle(_options, bundle) {
		const inject_styles_file = Object.keys(bundle).find((f) => f.startsWith('inject_styles'));

		let has_css = false;
		for (const name in bundle) {
			const chunk = bundle[name];

			let chunk_has_css = false;

			if (chunk.code) {
				chunk.code = chunk.code.replace(/___SVELTE_CSS_INJECTION___([0-9a-f]+)___/g, (_m, id) => {
					id = Buffer.from(id, 'hex').toString();
					const target = Object.values(bundle).find((c) => c.modules && c.modules[id]);

					if (target) {
						const css_files = find_css(target, bundle);
						if (css_files.length > 0) {
							chunk_has_css = true;
							return `__inject_styles(${JSON.stringify(css_files)})`;
						}
					}

					return '';
				});

				if (chunk_has_css) {
					has_css = true;
					chunk.code += `\nimport __inject_styles from './${inject_styles_file}';`;
				}
			}
		}

		if (!has_css) {
			delete bundle[inject_styles_file];
		}
	}
};

const execFile = util.promisify(require$$1__default['default'].execFile);

const snowpack_main = require.resolve('snowpack');
const snowpack_pkg_file = path__default['default'].join(snowpack_main, '../../package.json');
const snowpack_pkg = require(snowpack_pkg_file); // eslint-disable-line
const snowpack_bin = path__default['default'].resolve(path__default['default'].dirname(snowpack_pkg_file), snowpack_pkg.bin.snowpack);

const ignorable_warnings = new Set(['EMPTY_BUNDLE', 'MISSING_EXPORT']);
const onwarn = (warning, handler) => {
	// TODO would be nice to just eliminate the circular dependencies instead of
	// squelching these warnings (it happens when e.g. the root layout imports
	// from $app/navigation)
	if (ignorable_warnings.has(warning.code)) return;
	handler(warning);
};

const DIR = '.svelte';
const ASSETS = `${DIR}/assets`;
const UNOPTIMIZED = `${DIR}/build/unoptimized`;
const OPTIMIZED = `${DIR}/build/optimized`;

const s = JSON.stringify;

async function build(config) {
	const manifest = create_app.create_manifest_data(config);

	utils.mkdirp(ASSETS);
	await rimraf(UNOPTIMIZED);
	await rimraf(OPTIMIZED);

	create_app.create_app({
		manifest_data: manifest,
		output: '.svelte/assets'
	});

	utils.copy_assets();

	// TODO use import.meta.env.SSR upon resolution of https://github.com/snowpackjs/snowpack/discussions/1889
	// prettier-ignore
	fs.writeFileSync('.svelte/assets/runtime/app/env.js', [
		'export const browser = typeof window !== "undefined";',
		'export const dev = false;',
		`export const amp = ${config.amp};`
	].join('\n'));

	const tick = index.bold(index.green('✔'));
	console.log(index.bold(index.cyan('Transforming...')));

	const mount = [
		`--mount.${config.files.routes}=/${config.appDir}/routes`,
		`--mount.${config.files.setup}=/${config.appDir}/setup`
	];

	const env = { ...process.env, SVELTE_KIT_APP_DIR: config.appDir };

	const promises = {
		transform_client: execFile(
			process.argv[0],
			[snowpack_bin, 'build', ...mount, `--out=${UNOPTIMIZED}/client`],
			{ env }
		),
		transform_server: execFile(
			process.argv[0],
			[snowpack_bin, 'build', ...mount, `--out=${UNOPTIMIZED}/server`, '--ssr'],
			{ env }
		)
	};

	await promises.transform_client;
	console.log(`  ${tick} client`);

	await promises.transform_server;
	console.log(`  ${tick} server`);

	console.log(index.bold(index.cyan('Optimizing...')));

	const client = {
		entry: null,
		deps: {}
	};

	const entry = path__default['default'].resolve(
		`${UNOPTIMIZED}/client/${config.appDir}/assets/runtime/internal/start.js`
	);

	const client_chunks = await rollup.rollup({
		input: {
			entry
		},
		plugins: [
			{
				name: 'deproxy-css',
				async resolveId(importee, importer) {
					if (/\.css\.proxy\.js$/.test(importee)) {
						const deproxied = importee.replace(/\.css\.proxy\.js$/, '.css');
						const resolved = await this.resolve(deproxied, importer);
						return resolved.id;
					}
				}
			},
			css_chunks__default['default']({
				sourcemap: true
			}),
			css_injection,
			{
				name: 'generate-client-manifest',
				generateBundle(_options, bundle) {
					const reverse_lookup = new Map();

					const routes = path__default['default'].resolve(`${UNOPTIMIZED}/client/${config.appDir}/routes`);

					let inject_styles;

					for (const key in bundle) {
						const chunk = bundle[key];

						if (chunk.facadeModuleId === entry) {
							client.entry = key;
						} else if (chunk.facadeModuleId === 'inject_styles.js') {
							inject_styles = key;
						} else if (chunk.modules) {
							for (const id in chunk.modules) {
								if (id.startsWith(routes) && id.endsWith('.js')) {
									const file = id.slice(routes.length + 1);
									reverse_lookup.set(file, key);
								}
							}
						}
					}

					const find_deps = (key, js, css) => {
						if (js.has(key)) return;

						js.add(key);

						const chunk = bundle[key];

						if (chunk) {
							const imports = chunk.imports;

							if (imports) {
								imports.forEach((key) => {
									if (key.endsWith('.css')) {
										js.add(inject_styles);
										css.add(key);
									} else {
										find_deps(key, js, css);
									}
								});
							}
						} else {
							this.error(`'${key}' is imported but could not be bundled`);
						}

						return { js, css };
					};

					const get_deps = (key) => {
						const js = new Set();
						const css = new Set();

						find_deps(key, js, css);

						return {
							js: Array.from(js),
							css: Array.from(css)
						};
					};

					manifest.components.forEach((component) => {
						const file = path__default['default'].normalize(component.file + '.js');
						const key = reverse_lookup.get(file);

						client.deps[component.name] = get_deps(key);
					});
				}
			},
			rollupPluginTerser.terser()
		],

		onwarn,

		// TODO ensure this works with external node modules (on server)
		external: (id) => id[0] !== '.' && !path__default['default'].isAbsolute(id)
	});

	await client_chunks.write({
		dir: `${OPTIMIZED}/client/${config.appDir}`,
		entryFileNames: '[name]-[hash].js',
		chunkFileNames: '[name]-[hash].js',
		assetFileNames: '[name]-[hash].js', // TODO CSS filenames aren't hashed?
		format: 'esm',
		sourcemap: true
	});

	console.log(`  ${tick} client`);

	const setup_file = `${UNOPTIMIZED}/server/${config.appDir}/setup/index.js`;
	if (!fs__default['default'].existsSync(setup_file)) {
		utils.mkdirp(path__default['default'].dirname(setup_file));
		fs__default['default'].writeFileSync(setup_file, '');
	}

	const app_file = `${UNOPTIMIZED}/server/app.js`;

	const component_indexes = new Map();
	manifest.components.forEach((c, i) => {
		component_indexes.set(c.file, i);
	});

	const stringify_component = (c) => `() => import(${s(`.${c.url}`)})`;

	// TODO ideally we wouldn't embed the css_lookup, but this is the easiest
	// way to be able to inline CSS into AMP documents. if we come up with
	// something better, we could use it for non-AMP documents too, as
	// critical CSS below a certain threshold _should_ be inlined
	const css_lookup = {};
	manifest.pages.forEach((data) => {
		data.parts.forEach((c) => {
			const deps = client.deps[c.name];
			deps.css.forEach((dep) => {
				const url = `${config.paths.assets}/${config.appDir}/${dep}`.replace(/^\/\./, '');
				const file = `${OPTIMIZED}/client/${config.appDir}/${dep}`;

				css_lookup[url] = fs.readFileSync(file, 'utf-8');
			});
		});
	});

	// TODO get_stack, below, just returns the stack as-is, without sourcemapping
	const renderer_file = `${UNOPTIMIZED}/server/renderer.js`;
	fs__default['default'].writeFileSync(
		renderer_file,
		fs__default['default'].readFileSync(require.resolve("@sveltejs/kit/dist/renderer1"), 'utf-8')
	);

	// prettier-ignore
	fs__default['default'].writeFileSync(
		app_file,
		`
			import * as renderer from './renderer';
			import root from './${config.appDir}/assets/generated/root.svelte.js';
			import { set_paths } from './${config.appDir}/assets/runtime/internal/singletons.js';
			import * as setup from './${config.appDir}/setup/index.js';

			const template = ({ head, body }) => ${s(fs__default['default'].readFileSync(config.files.template, 'utf-8'))
				.replace('%svelte.head%', '" + head + "')
				.replace('%svelte.body%', '" + body + "')};

			const entry = ${s(client.entry)};

			set_paths(${s(config.paths)});

			// allow paths to be overridden in svelte-kit start
			export function init({ paths }) {
				set_paths(paths);
			}

			init({ paths: ${s(config.paths)} });

			const d = decodeURIComponent;
			const empty = () => ({});

			const components = [
				${manifest.components.map((c) => stringify_component(c)).join(',\n\t\t\t\t')}
			];

			${config.amp ? `
			const css_lookup = ${s(css_lookup)};` : ''}

			const manifest = {
				assets: ${s(manifest.assets)},
				layout: ${stringify_component(manifest.layout)},
				error: ${stringify_component(manifest.error)},
				pages: [
					${manifest.pages
						.map((data) => {
							const params = get_params(data.params);
							const parts = data.parts.map(c => `components[${component_indexes.get(c.file)}]`);

							const path_to_dep = dep => `${config.paths.assets}/${config.appDir}/${dep}`.replace(/^\/\./, '');

							const js_deps = new Set();
							const css_deps = new Set();
							data.parts.forEach(c => {
								const deps = client.deps[c.name];
								deps.js.forEach(dep => js_deps.add(path_to_dep(dep)));
								deps.css.forEach(dep => css_deps.add(path_to_dep(dep)));
							});

							return `{
								pattern: ${data.pattern},
								params: ${params},
								parts: [${parts.join(', ')}],
								css: [${Array.from(css_deps).map(s).join(', ')}],
								js: [${Array.from(js_deps).map(s).join(', ')}]
							}`;
						})
						.join(',\n\t\t\t\t\t')}
				],
				endpoints: [
					${manifest.endpoints
						.map((data) => {
							const params = get_params(data.params);
							const load = `() => import(${s(`.${data.url.replace(/\.\w+$/, '.js')}`)})`;

							return `{ pattern: ${data.pattern}, params: ${params}, load: ${load} }`;
						})
						.join(',\n\t\t\t\t\t')}
				]
			};

			export function render(request, {
				paths = ${s(config.paths)},
				only_prerender = false,
				get_static_file
			} = {}) {
				return renderer.render(request, {
					paths,
					template,
					manifest,
					target: ${s(config.target)},${
						config.startGlobal ? `\n\t\t\t\t\tstart_global: ${s(config.startGlobal)},` : ''
					}
					entry,
					root,
					setup,
					dev: false,
					amp: ${config.amp},
					only_prerender,
					app_dir: ${s(config.appDir)},
					host: ${s(config.host)},
					host_header: ${s(config.hostHeader)},
					get_stack: error => error.stack,
					get_static_file,
					get_amp_css: dep => css_lookup[dep]
				});
			}
		`
			.replace(/^\t{3}/gm, '')
			.trim()
	);

	const server_input = {
		app: `${UNOPTIMIZED}/server/app.js`
	};

	const server_chunks = await rollup.rollup({
		input: server_input,
		plugins: [
			{
				name: 'remove-css',
				load(id) {
					if (/\.css\.proxy\.js$/.test(id)) return '';
				}
			},
			// TODO add server manifest generation so we can prune
			// imports before zipping for cloud functions
			rollupPluginTerser.terser()
		],

		onwarn,

		// TODO ensure this works with external node modules (on server)
		external: (id) => id[0] !== '.' && !path__default['default'].isAbsolute(id)
	});

	await server_chunks.write({
		dir: `${OPTIMIZED}/server`,
		format: 'cjs', // TODO some adapters might want ESM?
		exports: 'named',
		entryFileNames: '[name].js',
		chunkFileNames: 'chunks/[name].js',
		assetFileNames: 'assets/[name].js',
		sourcemap: true
	});

	console.log(`  ${tick} server\n`);
}

async function rimraf(path) {
	return new Promise((resolve) => {
		(fs__default['default'].rm || fs__default['default'].rmdir)(path, { recursive: true, force: true }, () => resolve());
	});
}

// given an array of params like `['x', 'y', 'z']` for
// src/routes/[x]/[y]/[z]/svelte, create a function
// that turns a RexExpMatchArray into ({ x, y, z })
function get_params(array) {
	return array.length
		? '(m) => ({ ' +
				array
					.map((param, i) => {
						return param.startsWith('...')
							? `${param.slice(3)}: d(m[${i + 1}]).split('/')`
							: `${param}: d(m[${i + 1}])`;
					})
					.join(', ') +
				'})'
		: 'empty';
}

exports.build = build;
