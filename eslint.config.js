import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Allow empty catch blocks (common in optional file reads)
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Allow require() in test files and server code
      "@typescript-eslint/no-require-imports": "off",
      // Allow explicit any in a few places (API responses, event handlers)
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Allow multiple exports from a file (components + helpers)
      "react-refresh/only-export-components": "off",
    },
  },
]);
