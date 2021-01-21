const plugin = require("tailwindcss/plugin");
const PurgeSvelte = require("purgecss-from-svelte");
const { tailwindExtractor } = require("tailwindcss/lib/lib/purgeUnusedStyles");
const isProduction = process.env.NODE_ENV === "production";

/**
 * @type {import("tailwindcss/defaultConfig") }
 * */
module.exports = {
  darkMode: "class",
  purge: {
    enabled: isProduction,
    content: ["./src/**/*.svelte", "./src/app.html"],
    options: {
      defaultExtractor: (content) => PurgeSvelte.extract(content)
    }
  },
  theme: {
    extend: {
    },
  },
  variants: {
  },
  plugins: [
  ],
};
