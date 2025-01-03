import { defineConfig } from "vitest/config";

export default defineConfig({
	define: {
		__DEV__: true,
		__TEST__: true,
	},
	test: {
		globals: false,
		includeSource: ["src/**/*.{js,ts}"],
	},
});
