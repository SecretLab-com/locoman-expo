// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

import designSystemPlugin from "./eslint/design-system-plugin.js";
import { designSystemStyleExceptions } from "./eslint/design-system-exceptions.js";

export default defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["app/**/*.tsx", "components/**/*.tsx", "features/**/*.tsx"],
    ignores: designSystemStyleExceptions,
    plugins: {
      "design-system": designSystemPlugin,
    },
    rules: {
      "design-system/no-raw-design-values": "error",
    },
  },
]);
