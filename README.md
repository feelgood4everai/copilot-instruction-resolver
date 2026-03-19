# Copilot Instruction Resolver

A VS Code extension that solves the limitation where GitHub Copilot only looks for `copilot-instructions.md` in the workspace root.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/feelgood4everai/copilot-instruction-resolver)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## The Problem

GitHub Copilot currently has a significant limitation (tracked in [GitHub issue #11027](https://github.com/microsoft/vscode-copilot-release/issues/11027)): it only looks for `copilot-instructions.md` in the workspace root directory.

This creates serious problems for:

### 🏢 Monorepos

In a monorepo structure like:
```
my-monorepo/
├── copilot-instructions.md          (generic root instructions)
├── packages/
│   ├── frontend/
│   │   ├── copilot-instructions.md  (React-specific instructions)
│   │   └── src/
│   ├── backend/
│   │   ├── copilot-instructions.md  (Node.js API instructions)
│   │   └── src/
│   └── shared/
│       └── src/
└── .github/
    └── copilot-instructions.md      (org-wide instructions)
```

When you're working on `packages/frontend/src/components/Button.tsx`, Copilot only sees the root instructions - it misses the React-specific instructions in `packages/frontend/copilot-instructions.md`.

### 📁 Nested Projects

Similar issues occur with:
- Microservices in subdirectories
- Client/server projects in the same repo
- Packages with different tech stacks
- Documentation sites alongside code

### 🔄 Multi-Level Inheritance

Ideally, Copilot should be able to:
1. Read instructions from the **closest** directory to the current file
2. Merge with parent-level instructions
3. Build a complete context from root → project → specific file

## The Solution

This extension solves the problem by:

1. **Walking up parent directories** to find all `copilot-instructions.md` files
2. **Merging instructions** from multiple levels (project → parent → root)
3. **Supporting `.github/` folders** commonly used in monorepos
4. **Providing a tree view** of all discovered instruction files
5. **Visualizing instruction hierarchy** for the current file
6. **Supporting workspace-specific overrides** for customization

## Features

### 🌳 Tree View of All Instructions

The Explorer sidebar shows a dedicated "Copilot Instructions" panel displaying:
- All instruction files in your workspace
- Hierarchical organization by directory
- Which instructions are active for the current file

### 📊 Instruction Hierarchy Visualization

Open the hierarchy view to see:
- Full inheritance chain for the current file
- Preview of each instruction file
- Level indicators showing parent/child relationships
- Information about applied overrides

### 📍 Status Bar Integration

The status bar shows:
- Number of instruction files applying to the current file
- Quick access to view active instructions
- Tooltip with list of all applicable files

### 🔧 Quick Navigation

- Jump directly to any instruction file
- Reveal instruction files in the tree
- Generate merged instructions for manual use

### ⚙️ Workspace Overrides

Configure workspace-specific instruction overrides for advanced customization.

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Copilot Instruction Resolver"
4. Click Install

### From Source

```bash
git clone https://github.com/feelgood4everai/copilot-instruction-resolver.git
cd copilot-instruction-resolver
npm install
npm run compile
code .
# Press F5 to run in development mode
```

## Usage

### Basic Usage

1. The extension activates automatically when you open a workspace with Copilot instruction files
2. Look for the "Copilot Instructions" panel in your Explorer sidebar
3. Open any file - the status bar shows how many instructions apply
4. Click the status bar item or use `Ctrl+Shift+P` → "Show Active Instructions" to see the hierarchy

### Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `Copilot Instruction Resolver: Refresh` | Refresh the instruction tree | - |
| `Copilot Instruction Resolver: Show Active Instructions` | Show hierarchy for current file | - |
| `Copilot Instruction Resolver: Open Instruction File` | Open a specific instruction file | - |
| `Copilot Instruction Resolver: Show Instruction Hierarchy` | Generate markdown view of hierarchy | - |
| `Copilot Instruction Resolver: Generate Merged Instructions` | Create merged instruction file | - |

### Configuration

Add to your `.vscode/settings.json`:

```json
{
  "copilotInstructionResolver.enabled": true,
  "copilotInstructionResolver.maxParentLevels": 10,
  "copilotInstructionResolver.mergeStrategy": "hierarchical",
  "copilotInstructionResolver.showInStatusBar": true,
  "copilotInstructionResolver.instructionFileNames": [
    "copilot-instructions.md",
    ".github/copilot-instructions.md"
  ]
}
```

#### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the extension |
| `maxParentLevels` | number | `10` | Max directory levels to traverse |
| `mergeStrategy` | string | `"hierarchical"` | How to merge: `concatenate` or `hierarchical` |
| `showInStatusBar` | boolean | `true` | Show instruction count in status bar |
| `instructionFileNames` | array | See below | File names to look for |
| `workspaceOverrides` | object | `null` | Workspace-specific overrides |

### Default Instruction File Names

The extension looks for these files by default:
- `copilot-instructions.md`
- `.github/copilot-instructions.md`

You can customize this list in settings to support:
- `.copilot-instructions.md`
- `copilot.md`
- Custom naming conventions

## How It Works

### Instruction Discovery

When you open a file, the extension:

1. Starts from the file's directory
2. Checks for instruction files in that directory
3. Walks up the parent directories
4. Stops at workspace root or max levels
5. Collects all found files

### Merging Strategy

#### Hierarchical (Default)

Instructions are merged with source annotations:

```markdown
<!-- Instructions from: packages/frontend/copilot-instructions.md (closest) -->

This is a React project using TypeScript...

---

<!-- Instructions from: copilot-instructions.md (root) -->

Follow the project's general coding standards...
```

#### Concatenate

Simple concatenation without annotations:

```markdown
This is a React project using TypeScript...

---

Follow the project's general coding standards...
```

### Monorepo Example

Given this structure:

```
my-monorepo/
├── copilot-instructions.md
│   └── "Follow TypeScript strict mode..."
├── packages/
│   ├── web/
│   │   ├── copilot-instructions.md
│   │   │   └── "This is a Next.js app..."
│   │   └── pages/index.tsx
│   └── api/
│       ├── copilot-instructions.md
│       └── src/server.ts
└── .github/
    └── copilot-instructions.md
        └── "Organization standards..."
```

When editing `packages/web/pages/index.tsx`, Copilot should see:

1. `packages/web/copilot-instructions.md` (Next.js specifics)
2. `copilot-instructions.md` (TypeScript standards)
3. `.github/copilot-instructions.md` (Org standards)

This extension visualizes and manages this inheritance.

## Example Workflows

### Setting Up a Monorepo

1. Create root `copilot-instructions.md` with general rules
2. Add `.github/copilot-instructions.md` for org-wide standards
3. In each package, add specific instructions:
   - `packages/web/copilot-instructions.md` - Frontend rules
   - `packages/api/copilot-instructions.md` - Backend rules
   - `packages/shared/copilot-instructions.md` - Shared library rules
4. Install this extension
5. Navigate between files - the tree view updates automatically

### Adding Workspace Overrides

For temporary customization:

```json
{
  "copilotInstructionResolver.workspaceOverrides": {
    "packages/web/copilot-instructions.md": "Override content here"
  }
}
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development

```bash
npm install
npm run watch
# In VS Code: Press F5 to run extension
```

## Known Issues

- This extension currently provides visualization and management only
- Full Copilot integration (feeding instructions to Copilot directly) requires GitHub Copilot API support
- See [GitHub issue #11027](https://github.com/microsoft/vscode-copilot-release/issues/11027) for updates on native support

## Future Enhancements

- [ ] Direct Copilot API integration when available
- [ ] Automatic root instruction generation
- [ ] AI-powered instruction optimization
- [ ] Cross-workspace instruction sharing
- [ ] Team instruction templates

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Thanks to the VS Code team for the extensibility platform
- Thanks to GitHub Copilot team for the AI coding assistant
- Inspired by the community discussion in issue #11027

## Related

- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Creating a Copilot Instructions File](https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/creating-a-copilot-instructions-file)
- [VS Code Extension API](https://code.visualstudio.com/api)