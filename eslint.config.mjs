import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["node_modules/", "main.js", "tests/", "vitest.config.ts"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			sourceType: "module",
			globals: { node: true },
		},
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
		},
	},
);
