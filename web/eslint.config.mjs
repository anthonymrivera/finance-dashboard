import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Output of `npm run build:check`, which writes outside .next so a
    // verification build cannot disturb a running dev server. Linting compiled
    // bundles produces hundreds of meaningless errors and hides real ones.
    ".next-check/**",
  ]),
]);

export default eslintConfig;
