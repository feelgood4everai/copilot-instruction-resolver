# Copilot Instruction Resolver

A VS Code extension that solves GitHub issue #11027 — Copilot only looks for `copilot-instructions.md` in the workspace root, ignoring parent directories.

## The Problem

In monorepos and nested project structures, you often want to share Copilot instructions across multiple projects:

```
~/company/
├── copilot-instructions.md      ← Company-wide coding standards
├── frontend/
│   └── copilot-instructions.md  ← Frontend-specific rules
├── backend/
│   └── copilot-instructions.md  ← Backend-specific rules
└── mobile/
    └── copilot-instructions.md  ← Mobile-specific rules
```

**Without this extension:** Each workspace only sees its local `copilot-instructions.md`, missing the company-wide standards.

**With this extension:** Instructions are discovered and merged from all parent directories, giving Copilot the full context.

## Features

- 🔍 **Automatic Discovery**: Walks up the directory tree to find all instruction files
- 🌳 **Tree View**: See all discovered instructions in the Explorer sidebar
- 📊 **Hierarchy Visualizer**: Understand the inheritance chain
- 🔗 **Smart Merging**: Concatenates instructions from root (base) to workspace (specific)
- ⚡ **Live Updates**: Watches for file changes and refreshes automatically

## Installation

1. Install from VS Code marketplace (coming soon)
2. Or install from VSIX: Download the latest release and run `code --install-extension copilot-instruction-resolver-0.1.0.vsix`

## Usage

1. Open a workspace in VS Code
2. Look for the "Copilot Instructions" view in the Explorer sidebar
3. Click the tree icon to see the full hierarchy visualization
4. Click any instruction file to open it

### Merge Strategies

Configure in VS Code settings:

- **Concatenate** (default): Merges all instructions, root first
- **Override**: Uses only the deepest (most specific) instruction file

## How It Works

1. Starts from your workspace root
2. Checks for `copilot-instructions.md`
3. Walks up to parent directories
4. Repeats until filesystem root
5. Merges all found instructions in order

## Example

Given this structure:

```
/home/user/company/copilot-instructions.md     # "Use TypeScript"
/home/user/company/project/copilot-instructions.md  # "Use React"
```

The merged instructions sent to Copilot would be:

```markdown
# Base Instructions (../copilot-instructions.md)

Use TypeScript

---

# Override from copilot-instructions.md

Use React
```

## Requirements

- VS Code 1.85.0 or higher
- GitHub Copilot extension (this complements, not replaces it)

## Contributing

This is an MVP focused on solving the core problem. PRs welcome!

## License

MIT

## Related

- GitHub Issue #11027: copilot-instructions.md lookup in parent directories
- GitHub Copilot documentation: https://docs.github.com/en/copilot