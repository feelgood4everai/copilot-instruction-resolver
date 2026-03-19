/**
 * Instruction Tree Provider - Tree view UI for displaying Copilot instruction files
 * 
 * Provides a hierarchical tree view of all discovered instruction files
 * and their relationships in the workspace.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { InstructionResolver, InstructionFile, InstructionHierarchy } from './instructionResolver';

/**
 * Tree item types for the instruction tree
 */
export enum TreeItemType {
  Root = 'root',
  InstructionFile = 'instructionFile',
  Directory = 'directory',
  Info = 'info',
  CurrentFile = 'currentFile'
}

/**
 * Base class for all instruction tree items
 */
export class InstructionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: TreeItemType,
    public readonly data?: InstructionFile | InstructionHierarchy,
    public readonly contextValue?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue || type;
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.command = this.getCommand();
  }

  private getTooltip(): string | vscode.MarkdownString {
    switch (this.type) {
      case TreeItemType.InstructionFile:
        if (this.data && 'content' in this.data) {
          const file = this.data as InstructionFile;
          const lines = file.content.split('\n').length;
          return new vscode.MarkdownString(
            `**${file.relativePath}**\\n` +
            `Level: ${file.level}\\n` +
            `Lines: ${lines}\\n` +
            `Last modified: ${file.lastModified.toLocaleString()}`
          );
        }
        return '';
      case TreeItemType.CurrentFile:
        if (this.data && 'targetFile' in this.data) {
          const hierarchy = this.data as InstructionHierarchy;
          return new vscode.MarkdownString(
            `**Active Instructions**\\n` +
            `Target: ${path.basename(hierarchy.targetFile)}\\n` +
            `Applied files: ${hierarchy.files.length}\\n` +
            `Overrides: ${hierarchy.overridesApplied ? 'Yes' : 'No'}`
          );
        }
        return '';
      default:
        return '';
    }
  }

  private getIcon(): vscode.ThemeIcon | undefined {
    switch (this.type) {
      case TreeItemType.InstructionFile:
        return new vscode.ThemeIcon('file-code');
      case TreeItemType.Directory:
        return new vscode.ThemeIcon('folder');
      case TreeItemType.CurrentFile:
        return new vscode.ThemeIcon('file');
      case TreeItemType.Info:
        return new vscode.ThemeIcon('info');
      case TreeItemType.Root:
        return new vscode.ThemeIcon('root-folder');
      default:
        return undefined;
    }
  }

  private getCommand(): vscode.Command | undefined {
    if (this.type === TreeItemType.InstructionFile && this.data && 'path' in this.data) {
      const file = this.data as InstructionFile;
      return {
        command: 'copilotInstructionResolver.openInstructionFile',
        title: 'Open Instruction File',
        arguments: [file.path]
      };
    }
    return undefined;
  }
}

/**
 * Tree data provider for the Copilot instructions view
 */
export class InstructionTreeProvider implements vscode.TreeDataProvider<InstructionTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<InstructionTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<InstructionTreeItem | undefined | null | void>();
  
  readonly onDidChangeTreeData: vscode.Event<InstructionTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private resolver: InstructionResolver;
  private currentFileHierarchy: InstructionHierarchy | null = null;

  constructor(resolver: InstructionResolver) {
    this.resolver = resolver;
  }

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this.resolver.refreshConfig();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update the current file context
   */
  public async updateCurrentFile(filePath: string): Promise<void> {
    this.currentFileHierarchy = await this.resolver.getInstructionHierarchyForFile(filePath);
    this._onDidChangeTreeData.fire();
    
    // Update context key for view visibility
    const hasInstructions = this.currentFileHierarchy !== null && this.currentFileHierarchy.files.length > 0;
    vscode.commands.executeCommand('setContext', 'workspaceHasCopilotInstructions', hasInstructions);
  }

  /**
   * Get tree item for a given element
   */
  public getTreeItem(element: InstructionTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of a tree item
   */
  public async getChildren(element?: InstructionTreeItem): Promise<InstructionTreeItem[]> {
    if (!element) {
      // Root level - return all instruction files grouped by directory
      return this.getRootItems();
    }

    switch (element.type) {
      case TreeItemType.CurrentFile:
        if (this.currentFileHierarchy) {
          return this.currentFileHierarchy.files.map(file => 
            new InstructionTreeItem(
              file.relativePath,
              vscode.TreeItemCollapsibleState.None,
              TreeItemType.InstructionFile,
              file,
              'instructionFile'
            )
          );
        }
        return [];

      case TreeItemType.Directory:
        // Show files in this directory
        if (element.data && 'files' in element.data) {
          const hierarchy = element.data as InstructionHierarchy;
          return hierarchy.files
            .filter(f => f.directory === (element.data as any).directory)
            .map(file => 
              new InstructionTreeItem(
                path.basename(file.path),
                vscode.TreeItemCollapsibleState.None,
                TreeItemType.InstructionFile,
                file,
                'instructionFile'
              )
            );
        }
        return [];

      case TreeItemType.Root:
        // Return all discovered files grouped
        const allFiles = await this.resolver.findAllInstructionFiles();
        return this.groupFilesByDirectory(allFiles);

      default:
        return [];
    }
  }

  /**
   * Get root level items
   */
  private async getRootItems(): Promise<InstructionTreeItem[]> {
    const items: InstructionTreeItem[] = [];

    // Add current file section if we have active editor
    if (this.currentFileHierarchy && this.currentFileHierarchy.files.length > 0) {
      items.push(
        new InstructionTreeItem(
          'Active for Current File',
          vscode.TreeItemCollapsibleState.Expanded,
          TreeItemType.CurrentFile,
          this.currentFileHierarchy,
          'currentFile'
        )
      );
    }

    // Add all workspace instructions
    const allFiles = await this.resolver.findAllInstructionFiles();
    if (allFiles.length > 0) {
      items.push(
        new InstructionTreeItem(
          `All Instructions (${allFiles.length})`,
          vscode.TreeItemCollapsibleState.Collapsed,
          TreeItemType.Root,
          undefined,
          'root'
        )
      );
    } else {
      items.push(
        new InstructionTreeItem(
          'No instruction files found',
          vscode.TreeItemCollapsibleState.None,
          TreeItemType.Info
        )
      );
    }

    return items;
  }

  /**
   * Group files by their parent directory
   */
  private groupFilesByDirectory(files: InstructionFile[]): InstructionTreeItem[] {
    const groups = new Map<string, InstructionFile[]>();

    for (const file of files) {
      const group = groups.get(file.directory) || [];
      group.push(file);
      groups.set(file.directory, group);
    }

    return Array.from(groups.entries()).map(([dir, dirFiles]) => {
      const relativeDir = vscode.workspace.workspaceFolders?.[0] 
        ? path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, dir) 
        : dir;
      
      return new InstructionTreeItem(
        relativeDir || 'Workspace Root',
        vscode.TreeItemCollapsibleState.Collapsed,
        TreeItemType.Directory,
        { directory: dir, files: dirFiles } as any
      );
    });
  }

  /**
   * Get the parent of a tree item
   */
  public getParent(element: InstructionTreeItem): InstructionTreeItem | undefined {
    // Implementation would require tracking parent relationships
    return undefined;
  }

  /**
   * Reveal a specific file in the tree
   */
  public async revealFile(filePath: string, treeView: vscode.TreeView<InstructionTreeItem>): Promise<void> {
    const allFiles = await this.resolver.findAllInstructionFiles();
    const targetFile = allFiles.find(f => f.path === filePath);
    
    if (targetFile) {
      const item = new InstructionTreeItem(
        targetFile.relativePath,
        vscode.TreeItemCollapsibleState.None,
        TreeItemType.InstructionFile,
        targetFile,
        'instructionFile'
      );
      
      treeView.reveal(item, { select: true, focus: true });
    }
  }
}