/**
 * Copilot Instruction Resolver - Main Extension Entry Point
 * 
 * This extension solves the limitation where GitHub Copilot only looks for
 * copilot-instructions.md in the workspace root, by walking up parent directories
 * and merging instructions from multiple levels.
 * 
 * GitHub Issue: https://github.com/microsoft/vscode-copilot-release/issues/11027
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { InstructionResolver } from './instructionResolver';
import { InstructionTreeProvider, InstructionTreeItem, TreeItemType } from './instructionTreeProvider';
import { HierarchyVisualizer } from './hierarchyVisualizer';

// Extension state
let resolver: InstructionResolver;
let treeProvider: InstructionTreeProvider;
let treeView: vscode.TreeView<InstructionTreeItem>;
let statusBarItem: vscode.StatusBarItem;
let fileWatcher: vscode.FileSystemWatcher;
let outputChannel: vscode.OutputChannel;

/**
 * Extension activation entry point
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Copilot Instruction Resolver is now active');

  // Initialize components
  resolver = new InstructionResolver();
  treeProvider = new InstructionTreeProvider(resolver);
  outputChannel = vscode.window.createOutputChannel('Copilot Instruction Resolver');

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'copilotInstructionResolver.showActiveInstructions';
  context.subscriptions.push(statusBarItem);

  // Create tree view
  treeView = vscode.window.createTreeView('copilotInstructions', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Setup file watcher for instruction files
  fileWatcher = resolver.createFileWatcher();
  context.subscriptions.push(fileWatcher);

  // Register commands
  registerCommands(context);

  // Setup event handlers
  setupEventHandlers(context);

  // Initial update
  updateCurrentFileContext();
  updateStatusBar();

  outputChannel.appendLine('Copilot Instruction Resolver activated');
  outputChannel.appendLine(`Workspace: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'none'}`);
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
  // Refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copilotInstructionResolver.refresh',
      async () => {
        treeProvider.refresh();
        await updateCurrentFileContext();
        await updateStatusBar();
        vscode.window.showInformationMessage('Copilot instructions refreshed');
      }
    )
  );

  // Open instruction file command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copilotInstructionResolver.openInstructionFile',
      async (filePath?: string) => {
        if (!filePath) {
          // If no path provided, show quick pick
          const allFiles = await resolver.findAllInstructionFiles();
          const selection = await vscode.window.showQuickPick(
            allFiles.map(f => ({
              label: f.relativePath,
              description: `${f.level} levels from root`,
              detail: f.path,
              path: f.path
            })),
            { placeHolder: 'Select an instruction file to open' }
          );
          
          if (selection) {
            filePath = selection.path;
          }
        }

        if (filePath) {
          const doc = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(doc);
        }
      }
    )
  );

  // Show active instructions command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copilotInstructionResolver.showActiveInstructions',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor');
          return;
        }

        const filePath = editor.document.uri.fsPath;
        const hierarchy = await resolver.getInstructionHierarchyForFile(filePath);

        if (!hierarchy || hierarchy.files.length === 0) {
          vscode.window.showInformationMessage('No Copilot instructions apply to this file');
          return;
        }

        // Show hierarchy visualization
        await HierarchyVisualizer.showInWebview(hierarchy, context.extensionUri);
      }
    )
  );

  // Show hierarchy command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copilotInstructionResolver.showHierarchy',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor');
          return;
        }

        const filePath = editor.document.uri.fsPath;
        const hierarchy = await resolver.getInstructionHierarchyForFile(filePath);

        if (!hierarchy || hierarchy.files.length === 0) {
          vscode.window.showInformationMessage('No Copilot instructions found');
          return;
        }

        await HierarchyVisualizer.showInDocument(hierarchy);
      }
    )
  );

  // Reveal in tree command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copilotInstructionResolver.revealInTree',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        // Focus the tree view
        await vscode.commands.executeCommand('copilotInstructions.focus');
        
        // Update to show current file's instructions
        await updateCurrentFileContext();
      }
    )
  );

  // Generate merged instructions command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copilotInstructionResolver.generateMergedInstructions',
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor');
          return;
        }

        const filePath = editor.document.uri.fsPath;
        const merged = await resolver.getEffectiveInstructionsForFile(filePath);

        if (!merged) {
          vscode.window.showInformationMessage('No instructions to merge for this file');
          return;
        }

        // Create new document with merged instructions
        const doc = await vscode.workspace.openTextDocument({
          language: 'markdown',
          content: merged
        });
        
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.Beside,
          preview: true
        });

        vscode.window.showInformationMessage(
          'Merged instructions generated. You can copy this to your root copilot-instructions.md',
          'Copy to Clipboard'
        ).then(selection => {
          if (selection === 'Copy to Clipboard') {
            vscode.env.clipboard.writeText(merged);
          }
        });
      }
    )
  );
}

/**
 * Setup event handlers
 */
function setupEventHandlers(context: vscode.ExtensionContext) {
  // Update when active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async () => {
      await updateCurrentFileContext();
      await updateStatusBar();
    })
  );

  // Watch for instruction file changes
  context.subscriptions.push(
    fileWatcher.onDidChange(async (uri) => {
      outputChannel.appendLine(`Instruction file changed: ${uri.fsPath}`);
      treeProvider.refresh();
      await updateCurrentFileContext();
      await updateStatusBar();
    })
  );

  context.subscriptions.push(
    fileWatcher.onDidCreate(async (uri) => {
      outputChannel.appendLine(`Instruction file created: ${uri.fsPath}`);
      treeProvider.refresh();
      await updateCurrentFileContext();
      await updateStatusBar();
    })
  );

  context.subscriptions.push(
    fileWatcher.onDidDelete(async (uri) => {
      outputChannel.appendLine(`Instruction file deleted: ${uri.fsPath}`);
      treeProvider.refresh();
      await updateCurrentFileContext();
      await updateStatusBar();
    })
  );

  // Watch configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('copilotInstructionResolver')) {
        resolver.refreshConfig();
        treeProvider.refresh();
      }
    })
  );

  // Watch workspace folder changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      treeProvider.refresh();
      await updateCurrentFileContext();
      await updateStatusBar();
    })
  );
}

/**
 * Update the tree view with current file context
 */
async function updateCurrentFileContext() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await treeProvider.updateCurrentFile(editor.document.uri.fsPath);
  }
}

/**
 * Update the status bar with instruction count
 */
async function updateStatusBar() {
  const config = vscode.workspace.getConfiguration('copilotInstructionResolver');
  if (!config.get<boolean>('showInStatusBar', true)) {
    statusBarItem.hide();
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    statusBarItem.hide();
    return;
  }

  const filePath = editor.document.uri.fsPath;
  
  // Don't show for instruction files themselves
  if (resolver.isInstructionFile(filePath)) {
    statusBarItem.hide();
    return;
  }

  const hierarchy = await resolver.getInstructionHierarchyForFile(filePath);
  
  if (hierarchy && hierarchy.files.length > 0) {
    statusBarItem.text = `$(copilot) ${hierarchy.files.length} instruction${hierarchy.files.length > 1 ? 's' : ''}`;
    statusBarItem.tooltip = new vscode.MarkdownString(
      `**${hierarchy.files.length} Copilot instruction file${hierarchy.files.length > 1 ? 's' : ''}** apply to this file\\n\\n` +
      hierarchy.files.map(f => `- ${f.relativePath}`).join('\\n') +
      (hierarchy.overridesApplied ? '\\n\\n⚠️ *Workspace overrides applied*' : '')
    );
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

/**
 * Extension deactivation
 */
export function deactivate() {
  outputChannel?.appendLine('Copilot Instruction Resolver deactivated');
  outputChannel?.dispose();
}