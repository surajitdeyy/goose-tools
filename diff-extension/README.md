# Goose Diff Extension

A unified diff display for the goose Desktop application. When goose uses the `edit` tool to modify files, this extension renders a visual diff inline in the chat window — with syntax highlighting and character-level change details.

> **Note:** This is a **source-code patch** for goose Desktop, not a goose MCP extension. It modifies goose's internal React components to change how `edit` tool calls are rendered. This is because goose's extension system (MCP, plugins, hooks) can add new tools and behaviors, but cannot modify goose's own UI rendering pipeline. If/when the [upstream PR](https://github.com/aaif-goose/goose/compare/main...monroewilliams:goose:edit-unified-diff-display) is merged, this feature will ship natively in a future goose release.

## Features

- **Unified diff view** — Added lines in green, removed lines in red, context lines unchanged
- **Syntax highlighting** — 17+ languages auto-detected from file extension (TypeScript, JavaScript, Rust, Python, Go, Java, C/C++, CSS, JSON, YAML, HTML, Bash, SQL, TOML, Swift, Objective-C)
- **Character-level diffs** — Within changed lines, individual changed characters get a stronger highlight
- **Dark/light mode** — Automatically follows your system preference with GitHub-style token colors
- **Zero token impact** — Purely a client-side UI change; no additional data sent to the LLM
- **Clean install/uninstall** — Scripts handle everything, with automatic backup and restore
- **No pnpm required** — The installer works even if pnpm is not available (falls back to direct npm pack)

## Quick Start

```bash
# Clone this repo
git clone https://github.com/surajitdeyy/goose-tools.git
cd goose-tools

# Install the diff extension (auto-detects goose repo)
./goose-tools diff install

# Or specify the goose repo path
./goose-tools diff install ~/Code/goose

# Check installation status
./goose-tools diff status

# Uninstall when needed
./goose-tools diff uninstall
```

## CLI Reference

```
goose-tools <command> [options]

Commands:
  diff install [path]    Install the unified diff display extension
  diff uninstall [path]  Uninstall the unified diff display extension
  diff status [path]     Check if the diff extension is installed
  list                   List available extensions
  help                   Show help message
```

## How It Looks

When goose runs an `edit` tool call, expanding it shows:

```
┌─────────────────────────────────────────┐
│ src/components/Foo.tsx                  │  ← file name header
├─────────────────────────────────────────┤
│   const x = 5;                         │  ← context (unchanged)
│ - const y = calculate(x);              │  ← removed line (red bg)
│ + const y = computeValue(x, opts);     │  ← added line (green bg)
│   return <Bar value={y} />;            │  ← context
└─────────────────────────────────────────┘
```

With syntax highlighting: keywords in blue, strings in orange, functions in yellow, etc.

## What Gets Changed

| File | Action | Purpose |
|---|---|---|
| `ui/desktop/src/components/DiffViewer.tsx` | **Added** | New component: computes and renders unified diffs |
| `ui/desktop/src/components/__tests__/DiffViewer.test.tsx` | **Added** | 14 test cases for the DiffViewer component |
| `ui/desktop/src/components/ToolCallWithResponse.tsx` | **Modified** | Imports DiffViewer, renders it for `edit` tool calls |
| `ui/desktop/src/utils/toolIconMapping.tsx` | **Modified** | Maps `edit` tool to FileEdit icon |
| `ui/desktop/package.json` | **Modified** | Adds `"diff": "9.0.0"` dependency |
| `ui/desktop/node_modules/diff/` | **Added** | The `diff` npm package (installed directly if pnpm unavailable) |

## How Installation Works

The installer handles the `diff` npm dependency intelligently:

1. **Tries `pnpm install` first** — the proper way if pnpm is available
2. **Falls back to direct install** — downloads `diff@9.0.0` via `npm pack` and extracts it directly into `node_modules/`, bypassing pnpm entirely

This means the install works even if:
- `pnpm` is not installed globally
- The goose repo has pre-existing `pnpm install` issues (like `@electron/node-gyp`)
- You're on a fresh system with only Node.js

## Reinstalling Goose

If you uninstall goose and later install it again, the diff extension will work out of the box when you re-run the installer. The installer:

- Detects the goose repo automatically (or you can specify the path)
- Creates a fresh backup of the new goose files
- Applies all patches
- Installs the `diff` package (with pnpm fallback)

There's no persistent state outside the goose repo — everything lives in `ui/desktop/`.

## No Impact on LLM Context

This extension is **purely a UI change**. The `before` and `after` strings are already part of the `edit` tool arguments sent to the LLM. The `DiffViewer` component simply computes the diff client-side in the Electron renderer process and displays it — no additional data is sent to the LLM, no extra tokens are consumed.

## Requirements

- A local clone of the [goose](https://github.com/aaif-goose/goose) repository
- Node.js (any recent version — used only to download the `diff` package)
- The goose Desktop `package.json` must include `prismjs` (it does by default)

## Credits

Based on the [edit-unified-diff-display](https://github.com/aaif-goose/goose/compare/main...monroewilliams:goose:edit-unified-diff-display) PR by [@monroewilliams](https://github.com/monroewilliams).

## License

Apache-2.0 (same as goose)
