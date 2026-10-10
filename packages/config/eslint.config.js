import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const ignores = {
  ignores: ["**/.next/**", "**/dist/**", "**/node_modules/**", "**/migrations/**", "**/next-env.d.ts"],
};

/** Base config for TypeScript libraries and Node apps. */
export const base = tseslint.config(ignores, js.configs.recommended, ...tseslint.configs.recommended, {
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
  },
});

/** Config for React / Next.js apps and packages. */
export const react = tseslint.config(...base, {
  plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
  rules: {
    ...reactHooks.configs.recommended.rules,
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
    // App Router only; this rule looks for a pages/ directory.
    "@next/next/no-html-link-for-pages": "off",
  },
});

export default base;
