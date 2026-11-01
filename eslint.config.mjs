import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // The Expo App lints itself (mobile/eslint.config.js).
  { ignores: ["mobile/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // 下拉選單一律用 `@/components/Select`（docs/design-system.md「下拉選單」）。
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "用 @/components/Select，不用原生 <select>（docs/design-system.md「下拉選單」）。",
        },
      ],
    },
  },
];

export default eslintConfig;
