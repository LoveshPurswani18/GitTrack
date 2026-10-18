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
  ]),
  // Metrics run in the browser and must stay pure: no server code, no framework.
  {
    files: ["src/lib/metrics/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom", "next", "server-only"],
          patterns: [
            "next/*",
            "@/lib/github",
            "@/lib/github/*",
            "**/lib/github",
            "**/lib/github/*",
            "../github",
            "../github/*",
          ],
        },
      ],
    },
  },
  // "Now" is passed in as an argument so results are deterministic. Tests may build dates.
  {
    files: ["src/lib/metrics/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Pass `now` in as an argument instead of calling Date.now().",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Pass `now` in as an argument instead of calling new Date().",
        },
      ],
    },
  },
]);

export default eslintConfig;
