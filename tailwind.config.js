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
      //  (content) => {
      //   let classes = tailwindExtractor(content);
      //   // (content.match(/(?<=class:)[^=>\/\s]*/g) || []).forEach(value => {
      //   //   classes = [...classes, ...value.split(',').map(s => s.trim()).filter(Boolean)]
      //   // })
      //   // console.log(classes)
      //   return [...classes, ...[...content.matchAll(/(?:class:)*([\w\d-/:%.]+)/gm)].map(([_match, group, ..._rest]) => group)];
      // }
    }
  },
  theme: {
    extend: {
    },
  },
  variants: {
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};
