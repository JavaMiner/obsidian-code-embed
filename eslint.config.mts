import { defineConfig } from "eslint/config";
import obsidian from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidian.configs.recommended,
  { files: ["src/**/*.ts"], languageOptions: { parserOptions: { projectService: true } } },
]);
