# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Obsidian community plugin that renders Bullet Journal styled checkboxes (`- [ ]`, `- [x]`, `- [-]`, `- [>]`, `- [<]`, `- [o]`) and highlights user-configured signifier prefixes (default `!`, `?`).

## Commands

- `npm run dev` — esbuild watch mode, rebuilds `main.js` on change. Runs indefinitely.
- `npm run build` — `tsc -noEmit -skipLibCheck` typecheck, then production bundle to `main.js`.
- `npm test` / `npm run test:watch` — vitest (jsdom env). Tests live in `tests/` and import from `src/...` via the alias in `vitest.config.ts`; `tests/mocks/obsidian.ts` stubs the `obsidian` module for pure-helper tests.
- `npx eslint src` — lint (no npm script; eslint config at `.eslintrc`).
- `npm version patch|minor|major` — bumps `package.json`, then `version-bump.mjs` syncs `manifest.json` + `versions.json` and stages them. Pushing the resulting tag triggers `.github/workflows/release.yml` which builds and drafts a GitHub release with `main.js`, `manifest.json`, `styles.css`.

## Architecture

Entry `src/index.ts` exports default `BuJoPlugin extends Plugin`. `esbuild.config.mjs` bundles it to `main.js` (CJS, ES2018) with Obsidian/CodeMirror/electron as externals. `tsconfig.json` sets `baseUrl: "."` so imports use bare `src` / `src/core/...` paths; `vitest.config.ts` mirrors that alias. Bullet definitions live in `src/core/bullet-types.ts` (the `Bullet` type + `AVAILABLE_BULLETS_TYPES` list) so both the plugin entry and tests can import them without loading the Obsidian `Plugin` class.

Four execution paths, all rooted in `onload()`:

1. **Reading-mode render** — `registerMarkdownPostProcessor` calls `wrapSignifiers(element, settings.signifiers)` (from `src/core/signifier.ts`), which walks the first meaningful text node of each `ul > li` and DOM-splits it around any matching leading signifier, wrapping the character in `<span class="bujo-bullet-signifier">`. Using `textContent` assignment makes the wrap injection-safe without needing a sanitizer. Then, for `.task-list-item` elements only (no selector overlap), it reads `data-task`, matches against `AVAILABLE_BULLETS_TYPES`, assigns `data-bullet-id` by index, and attaches a `contextmenu` listener that rewrites the source file via `vault.process`. File edits locate the bullet by counting `isBulletText` matches up to the stored id — rendered-order index must match source-order index.
2. **Live Preview render** — `registerEditorExtension(signifierExtension(() => settings.signifiers))` (from `src/editor/signifier-extension.ts`) installs a CodeMirror 6 `ViewPlugin` that scans `view.visibleRanges` and applies `Decoration.mark({ class: "bujo-bullet-signifier" })` over any leading signifier. The provider closure picks up settings changes; `plugin.refreshEditors()` triggers re-decoration via an empty `cm.dispatch({})` after each settings mutation. The ViewPlugin rebuilds on every `ViewUpdate` — the visible-range bound makes this cheap.
3. **Editor commands** — `CommandHandler` (`src/handlers/command-handler.ts`) registers one command per bullet type (`change-bullet-to-<char>`) using `editorCheckCallback` so commands only appear when the current line passes `isBulletText`. No default hotkeys (per Obsidian guidance).
4. **Settings** — `src/settings.ts` defines `BuJoPluginSettings` (only `signifiers: {name, value}[]`), persisted via `plugin.loadData`/`saveData`. `BuJoPluginSettingTab.display()` rebuilds DOM on every mutation; every save site also calls `plugin.refreshEditors()` so Live Preview picks up the change immediately.

Shared helpers in `src/core/bullet-utils.ts`: `isBulletText` (trimmed-starts-with `- [`) and `updateBulletType` (regex replace `- \[.\]`). Both the context-menu flow and commands route through these — keep bullet detection consistent.

Styling lives in top-level `styles.css` (shipped alongside `main.js`).

## Constraints

- `*` cannot be a signifier — Obsidian's markdown renderer produces a double bullet. Documented in the settings UI.
- Known issues (README): copy-from-reading-mode loses bullet char; undo after context-menu change is unreliable.
- `isDesktopOnly: false` in manifest — no Node-only APIs.
