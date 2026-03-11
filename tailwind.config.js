const {
  themeColors,
  themeSpacing,
  themeRadii,
  themeTypography,
} = require("./theme.config");
const plugin = require("tailwindcss/plugin");

const tailwindColors = Object.fromEntries(
  Object.entries(themeColors).map(([name, swatch]) => [
    name,
    {
      DEFAULT: `var(--color-${name})`,
      light: swatch.light,
      dark: swatch.dark,
    },
  ]),
);

const tailwindSpacing = Object.fromEntries(
  Object.entries(themeSpacing).map(([name, value]) => [name, `${value}px`]),
);

const tailwindBorderRadius = Object.fromEntries(
  Object.entries(themeRadii).map(([name, value]) => [name, `${value}px`]),
);

const tailwindFontSize = Object.fromEntries(
  Object.entries(themeTypography.fontSize).map(([name, value]) => [
    name,
    [
      `${value}px`,
      {
        lineHeight: `${themeTypography.lineHeight[name]}px`,
        fontWeight: themeTypography.fontWeight.regular,
      },
    ],
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  // Scan all component and app files for Tailwind classes
  content: ["./app/**/*.{js,ts,tsx}", "./components/**/*.{js,ts,tsx}", "./lib/**/*.{js,ts,tsx}", "./hooks/**/*.{js,ts,tsx}"],

  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: tailwindColors,
      spacing: tailwindSpacing,
      borderRadius: tailwindBorderRadius,
      fontSize: tailwindFontSize,
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("light", ':root:not([data-theme="dark"]) &');
      addVariant("dark", ':root[data-theme="dark"] &');
    }),
  ],
};
