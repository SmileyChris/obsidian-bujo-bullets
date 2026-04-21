# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Obsidian community plugin that renders Bullet Journal styled checkboxes (`- [ ]`, `- [x]`, `- [-]`, `- [>]`, `- [<]`, `- [o]`) and highlights user-configured signifier prefixes (default `!`, `?`).

## Commands

- `npm run dev` — esbuild watch mode, rebuilds `main.js` on change. Runs indefinitely.
- `npm run build` — `tsc -noEmit -skipLibCheck` typecheck, then production bundle to `main.js`.
- `npx eslint src` — lint (no npm script; eslint config at `.eslintrc`).
- `npm version patch|minor|major` — bumps `package.json`, then `version-bump.mjs` syncs `manifest.json` + `versions.json` and stages them. Pushing the resulting tag triggers `.github/workflows/release.yml` which builds and drafts a GitHub release with `main.js`, `manifest.json`, `styles.css`.

No test framework configured.

## Architecture

Entry `src/index.ts` exports default `BuJoPlugin extends Plugin`. `esbuild.config.mjs` bundles it to `main.js` (CJS, ES2018) with Obsidian/CodeMirror/electron as externals. `tsconfig.json` sets `baseUrl: "."` so imports use bare `src` / `src/core/...` paths.

Three execution paths, all rooted in `onload()`:

1. **Reading-mode render** — `registerMarkdownPostProcessor` scans `ul > li` + `.task-list-item`. For each item: (a) wraps any leading signifier string in `<span class="bujo-bullet-signifier">` (sanitized via `isomorphic-dompurify`); (b) for checkboxes, reads `data-task` attribute, matches against `AVAILABLE_BULLETS_TYPES`, assigns `data-bullet-id` index, and attaches a `contextmenu` listener that rewrites the source file via `vault.process`. File edits locate the bullet by counting `isBulletText` matches up to the stored id — rendered-order index must match source-order index.
2. **Editor commands** — `CommandHandler` (`src/handlers/command-handler.ts`) registers one command per bullet type (`change-bullet-to-<char>`) using `editorCheckCallback` so commands only appear when the current line passes `isBulletText`. No default hotkeys (per Obsidian guidance).
3. **Settings** — `src/settings.ts` defines `BuJoPluginSettings` (only `signifiers: {name, value}[]`), persisted via `plugin.loadData`/`saveData`. `BuJoPluginSettingTab.display()` rebuilds DOM on every mutation.

Shared helpers in `src/core/bullet-utils.ts`: `isBulletText` (trimmed-starts-with `- [`) and `updateBulletType` (regex replace `- \[.\]`). Both the context-menu flow and commands route through these — keep bullet detection consistent.

Styling lives in top-level `styles.css` (shipped alongside `main.js`).

## Constraints

- `*` cannot be a signifier — Obsidian's markdown renderer produces a double bullet. Documented in the settings UI.
- Known issues (README): copy-from-reading-mode loses bullet char; undo after context-menu change is unreliable.
- `isDesktopOnly: false` in manifest — no Node-only APIs.
