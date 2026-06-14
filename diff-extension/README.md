# Goose Diff Extension

A unified diff display for the goose Desktop application. When goose uses the `edit` tool to modify files, this extension renders a visual diff inline in the chat window — with syntax highlighting and character-level change details.

## Features

- **Unified diff view** — Added lines in green, removed lines in red, context lines unchanged
- **Syntax highlighting** — 17+ languages auto-detected from file extension (TypeScript, JavaScript, Rust, Python, Go, Java, C/C++, CSS, JSON, YAML, HTML, Bash, SQL, TOML, Swift, Objective-C)
- **Character-level diffs** — Within changed lines, individual changed characters get a stronger highlight
- **Dark/light mode** — Automatically follows your system preference with GitHub-style token colors
- **Zero token impact** — Purely a client-side UI change; no additional data sent to the LLM
- **Clean install/uninstall** — Scripts handle everything, with automatic backup and restore

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

## Requirements

- A local clone of the [goose](https://github.com/aaif-goose/goose) repository
- Node.js ^24.10.0 and pnpm >=10.30.0 (same as goose Desktop requirements)
- The goose Desktop `package.json` must include `prismjs` (it does by default)

## Installation

```bash
# Clone this repo
git clone https://github.com/surajitdeyy/goose-tools.git
cd goose-tools/diff-extension

# Run the installer (auto-detects goose repo in common locations)
./scripts/install.sh

# Or specify the goose repo path explicitly
./scripts/install.sh ~/Code/goose
```

The installer:
1. Creates a backup of original files at `ui/desktop/.diff-extension-backup/`
2. Copies the new `DiffViewer.tsx` component and its tests
3. Patches `ToolCallWithResponse.tsx` to render diffs for `edit` tool calls
4. Patches `toolIconMapping.tsx` to use the file-edit icon for the `edit` tool
5. Adds the `diff` npm dependency to `package.json`
6. Runs `pnpm install` to fetch the new dependency

## Uninstallation

```bash
./scripts/uninstall.sh          # auto-detect goose repo
./scripts/uninstall.sh ~/Code/goose  # explicit path
```

The uninstaller:
1. Restores original files from the backup (or from shipped originals)
2. Removes `DiffViewer.tsx` and `DiffViewer.test.tsx`
3. Removes the `diff` dependency from `package.json`
4. Runs `pnpm install` to clean up

## What Gets Changed

| File | Action | Purpose |
|---|---|---|
| `ui/desktop/src/components/DiffViewer.tsx` | **Added** | New component: computes and renders unified diffs |
| `ui/desktop/src/components/__tests__/DiffViewer.test.tsx` | **Added** | 14 test cases for the DiffViewer component |
| `ui/desktop/src/components/ToolCallWithResponse.tsx` | **Modified** | Imports DiffViewer, renders it for `edit` tool calls |
| `ui/desktop/src/utils/toolIconMapping.tsx` | **Modified** | Maps `edit` tool to FileEdit icon |
| `ui/desktop/package.json` | **Modified** | Adds `"diff": "9.0.0"` dependency |

## No Impact on LLM Context

This extension is **purely a UI change**. The `before` and `after` strings are already part of the `edit` tool arguments sent to the LLM. The `DiffViewer` component simply computes the diff client-side in the Electron renderer process and displays it — no additional data is sent to the LLM, no extra tokens are consumed.

## Credits

Based on the [edit-unified-diff-display](https://github.com/aaif-goose/goose/compare/main...monroewilliams:goose:edit-unified-diff-display) PR by [@monroewilliams](https://github.com/monroewilliams).

## License

Apache-2.0 (same as goose)
