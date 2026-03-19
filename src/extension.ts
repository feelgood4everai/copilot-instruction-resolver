// Extension activation and command registration
import * as vscode from 'vscode';
import { InstructionTreeProvider } from './instructionTreeProvider';
import { InstructionResolver } from './instructionResolver';
import { HierarchyVisualizer } from './hierarchyVisualizer';

export function activate(context: vscode.ExtensionContext) {
    const resolver = new InstructionResolver();
    const treeProvider = new InstructionTreeProvider(resolver);
    const hierarchyVisualizer = new HierarchyVisualizer();

    // Register the tree view
    const treeView = vscode.window.createTreeView('copilotInstructions', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });

    // Refresh command
    const refreshCommand = vscode.commands.registerCommand(
        'copilotInstructionResolver.refresh',
        () => treeProvider.refresh()
    );

    // Show hierarchy command
    const hierarchyCommand = vscode.commands.registerCommand(
        'copilotInstructionResolver.showHierarchy',
        () => hierarchyVisualizer.show(resolver)
    );

    // Open file command
    const openFileCommand = vscode.commands.registerCommand(
        'copilotInstructionResolver.openFile',
        (filePath: string) => {
            vscode.workspace.openTextDocument(filePath).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        }
    );

    // Watch for file changes
    const fileWatcher = vscode.workspace.createFileSystemWatcher(
        '**/copilot-instructions.md'
    );
    
    fileWatcher.onDidCreate(() => treeProvider.refresh());
    fileWatcher.onDidDelete(() => treeProvider.refresh());
    fileWatcher.onDidChange(() => treeProvider.refresh());

    // Push all disposables
    context.subscriptions.push(
        treeView,
        refreshCommand,
        hierarchyCommand,
        openFileCommand,
        fileWatcher
    );

    // Initial refresh
    treeProvider.refresh();

    console.log('Copilot Instruction Resolver activated');
}

export function deactivate() {
    console.log('Copilot Instruction Resolver deactivated');
}