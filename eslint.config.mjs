import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// 功能模組（docs/modules-plan.md）：模組可以 import 核心，核心不 import 模組，
// 模組之間也不互相 import。核心頁面真的要嵌模組元件時，針對那個檔案開例外，
// 並寫進 docs/architecture.md「權限與模組」。
const MODULE_FOLDERS = {
  curriculum: [
    "src/app/**/curriculum/**",
    "src/features/curriculum/**",
    "src/service/curriculum/**",
    "src/domains/curriculum/**",
    "src/store/slices/curriculum.ts",
  ],
  finance: [
    "src/app/**/finance/**",
    "src/features/finance/**",
    "src/service/finance/**",
    "src/domains/finance/**",
    "src/store/slices/finance.ts",
  ],
};
const moduleImports = (module) => ({
  group: [
    `@/features/${module}`,
    `@/features/${module}/*`,
    `@/service/${module}/*`,
    `@/domains/${module}/*`,
    `@/store/slices/${module}`,
  ],
  message: `核心（或別的模組）不 import ${module} 模組，見 docs/modules-plan.md「共通架構規則」。`,
});
const restrict = (...modules) => ({
  "no-restricted-imports": ["error", { patterns: modules.map(moduleImports) }],
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
    files: ["src/**/*.{ts,tsx}"],
    ignores: [...MODULE_FOLDERS.curriculum, ...MODULE_FOLDERS.finance],
    rules: restrict("curriculum", "finance"),
  },
  { files: MODULE_FOLDERS.curriculum, rules: restrict("finance") },
  { files: MODULE_FOLDERS.finance, rules: restrict("curriculum") },
];

export default eslintConfig;
