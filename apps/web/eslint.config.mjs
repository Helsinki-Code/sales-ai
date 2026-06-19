import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  { ignores: [".next/**", "next-env.d.ts", "node_modules/**", "dist/**"], linterOptions: { reportUnusedDisableDirectives: "off" } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    languageOptions: {
      parserOptions: { project: false },
      globals: {
        React: "readonly",
        console: "readonly",
        fetch: "readonly",
        crypto: "readonly",
        window: "readonly",
        document: "readonly",
        alert: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "no-undef": "off",
      "@next/next/no-img-element": "off"
    }
  }
];
