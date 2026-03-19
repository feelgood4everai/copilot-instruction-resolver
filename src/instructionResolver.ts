/**
 * Instruction Resolver - Core logic for finding and merging Copilot instruction files
 * 
 * This module handles the core functionality of walking up directory trees
 * to find copilot-instructions.md files and merging them appropriately.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Represents an instruction file found in the file system
 */
export interface InstructionFile {
  /** Full path to the instruction file */
  path: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** Directory containing the instruction file */
  directory: string;
  /** How many levels up from the target file */
  level: number;
  /** Content of the instruction file */
  content: string;
  /** Last modified time */
  lastModified: Date;
}

/**
 * Represents a hierarchy of instruction files for a specific target
 */
export interface InstructionHierarchy {
  /** The file path these instructions apply to */
  targetFile: string;
  /** Ordered list of instruction files (closest first, root last) */
  files: InstructionFile[];
  /** Merged instruction content */
  mergedContent: string;
  /** Workspace-specific overrides applied */
  overridesApplied: boolean;
}

/**
 * Options for merging instructions
 */
export interface MergeOptions {
  /** Strategy for merging */
  strategy: 'concatenate' | 'hierarchical';
  /** Whether to include source comments */
  includeSourceComments: boolean;
  /** Separator between instruction sections */
  separator: string;
}

/**
 * Default merge options
 */
const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  strategy: 'hierarchical',
  includeSourceComments: true,
  separator: '\n\n---\n\n'
};

/**
 * Resolves Copilot instruction files by walking up the directory tree
 */
export class InstructionResolver {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration('copilotInstructionResolver');
  }

  /**
   * Refresh configuration (call when settings change)
   */
  public refreshConfig(): void {
    this.config = vscode.workspace.getConfiguration('copilotInstructionResolver');
  }

  /**
   * Check if the extension is enabled
   */
  public isEnabled(): boolean {
    return this.config.get<boolean>('enabled', true);
  }

  /**
   * Get the list of instruction file names to look for
   */
  public getInstructionFileNames(): string[] {
    return this.config.get<string[]>('instructionFileNames', [
      'copilot-instructions.md',
      '.github/copilot-instructions.md'
    ]);
  }

  /**
   * Get maximum parent levels to traverse
   */
  public getMaxParentLevels(): number {
    return this.config.get<number>('maxParentLevels', 10);
  }

  /**
   * Get merge strategy from configuration
   */
  public getMergeOptions(): MergeOptions {
    const strategy = this.config.get<'concatenate' | 'hierarchical'>('mergeStrategy', 'hierarchical');
    return {
      ...DEFAULT_MERGE_OPTIONS,
      strategy
    };
  }

  /**
   * Find all instruction files in the workspace
   */
  public async findAllInstructionFiles(): Promise<InstructionFile[]> {
    const files: InstructionFile[] = [];
    const seenPaths = new Set<string>();

    if (!vscode.workspace.workspaceFolders) {
      return files;
    }

    const fileNames = this.getInstructionFileNames();

    for (const folder of vscode.workspace.workspaceFolders) {
      const rootPath = folder.uri.fsPath;
      await this.findInstructionFilesInTree(rootPath, fileNames, files, seenPaths, 0);
    }

    // Sort by path depth (deepest first)
    return files.sort((a, b) => b.directory.split(path.sep).length - a.directory.split(path.sep).length);
  }

  /**
   * Recursively find instruction files in a directory tree
   */
  private async findInstructionFilesInTree(
    dir: string,
    fileNames: string[],
    files: InstructionFile[],
    seenPaths: Set<string>,
    level: number
  ): Promise<void> {
    if (level > this.getMaxParentLevels()) {
      return;
    }

    for (const fileName of fileNames) {
      const fullPath = path.join(dir, fileName);
      
      if (seenPaths.has(fullPath)) {
        continue;
      }

      if (fs.existsSync(fullPath)) {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            files.push({
              path: fullPath,
              relativePath: path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', fullPath),
              directory: dir,
              level,
              content,
              lastModified: stats.mtime
            });
            seenPaths.add(fullPath);
          }
        } catch (error) {
          console.error(`Error reading instruction file ${fullPath}:`, error);
        }
      }
    }

    // Recurse into subdirectories (limit depth)
    if (level < 5) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await this.findInstructionFilesInTree(
              path.join(dir, entry.name),
              fileNames,
              files,
              seenPaths,
              level + 1
            );
          }
        }
      } catch (error) {
        // Directory not readable, skip
      }
    }
  }

  /**
   * Get instruction hierarchy for a specific file
   */
  public async getInstructionHierarchyForFile(
    filePath: string
  ): Promise<InstructionHierarchy | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const files: InstructionFile[] = [];
    let currentDir = path.dirname(filePath);
    const fileNames = this.getInstructionFileNames();
    const maxLevels = this.getMaxParentLevels();
    let level = 0;

    // Walk up the directory tree
    while (currentDir !== path.dirname(currentDir) && level < maxLevels) {
      for (const fileName of fileNames) {
        const instructionPath = path.join(currentDir, fileName);
        
        if (fs.existsSync(instructionPath)) {
          try {
            const stats = fs.statSync(instructionPath);
            if (stats.isFile()) {
              const content = fs.readFileSync(instructionPath, 'utf-8');
              files.push({
                path: instructionPath,
                relativePath: path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', instructionPath),
                directory: currentDir,
                level,
                content,
                lastModified: stats.mtime
              });
            }
          } catch (error) {
            console.error(`Error reading instruction file ${instructionPath}:`, error);
          }
        }
      }

      currentDir = path.dirname(currentDir);
      level++;
    }

    // Check workspace root for any workspace folders
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const rootPath = folder.uri.fsPath;
        for (const fileName of fileNames) {
          const rootInstructionPath = path.join(rootPath, fileName);
          
          if (fs.existsSync(rootInstructionPath) && !files.some(f => f.path === rootInstructionPath)) {
            try {
              const stats = fs.statSync(rootInstructionPath);
              const content = fs.readFileSync(rootInstructionPath, 'utf-8');
              files.push({
                path: rootInstructionPath,
                relativePath: path.relative(rootPath, rootInstructionPath),
                directory: rootPath,
                level: files.length,
                content,
                lastModified: stats.mtime
              });
            } catch (error) {
              console.error(`Error reading instruction file ${rootInstructionPath}:`, error);
            }
          }
        }
      }
    }

    if (files.length === 0) {
      return null;
    }

    // Sort by level (closest first)
    files.sort((a, b) => a.level - b.level);

    // Apply workspace overrides if any
    const overridesApplied = await this.applyWorkspaceOverrides(files);

    // Merge the content
    const mergedContent = this.mergeInstructions(files, this.getMergeOptions());

    return {
      targetFile: filePath,
      files,
      mergedContent,
      overridesApplied
    };
  }

  /**
   * Apply workspace-specific overrides to instruction files
   */
  private async applyWorkspaceOverrides(files: InstructionFile[]): Promise<boolean> {
    const overrides = this.config.get<Record<string, string>>('workspaceOverrides', {});
    
    if (!overrides || Object.keys(overrides).length === 0) {
      return false;
    }

    let applied = false;

    for (const file of files) {
      if (overrides[file.path]) {
        // Override is direct content
        file.content = overrides[file.path];
        applied = true;
      } else if (overrides[file.relativePath]) {
        file.content = overrides[file.relativePath];
        applied = true;
      }
    }

    return applied;
  }

  /**
   * Merge multiple instruction files into a single content string
   */
  public mergeInstructions(
    files: InstructionFile[],
    options: Partial<MergeOptions> = {}
  ): string {
    const opts = { ...DEFAULT_MERGE_OPTIONS, ...options };
    
    if (files.length === 0) {
      return '';
    }

    if (files.length === 1) {
      return files[0].content;
    }

    const parts: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let content = file.content;

      if (opts.includeSourceComments && opts.strategy === 'hierarchical') {
        const relativePath = file.relativePath || path.basename(file.path);
        content = `<!-- Instructions from: ${relativePath} (${i === 0 ? 'closest' : i === files.length - 1 ? 'root' : 'intermediate'}) -->\n\n${content}`;
      }

      parts.push(content);
    }

    return parts.join(opts.separator);
  }

  /**
   * Get the effective instruction content for a file (for use by Copilot)
   * This returns the merged instructions that should apply to the given file
   */
  public async getEffectiveInstructionsForFile(filePath: string): Promise<string | null> {
    const hierarchy = await this.getInstructionHierarchyForFile(filePath);
    return hierarchy?.mergedContent || null;
  }

  /**
   * Check if a file is an instruction file
   */
  public isInstructionFile(filePath: string): boolean {
    const fileNames = this.getInstructionFileNames();
    return fileNames.some(name => filePath.endsWith(name.replace('/', path.sep)));
  }

  /**
   * Watch for changes to instruction files
   */
  public createFileWatcher(): vscode.FileSystemWatcher {
    const fileNames = this.getInstructionFileNames();
    const patterns = fileNames.map(name => `**/${name}`);
    
    // Create a pattern that matches any of the instruction file names
    const pattern = new vscode.RelativePattern(
      vscode.workspace.workspaceFolders?.[0] || '',
      `{${patterns.join(',')}}`
    );
    
    return vscode.workspace.createFileSystemWatcher(pattern);
  }
}