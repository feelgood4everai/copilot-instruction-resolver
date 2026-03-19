/**
 * Hierarchy Visualizer - Shows instruction inheritance and relationships
 * 
 * This module provides visualization of how instructions are inherited
 * and merged across the directory hierarchy.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { InstructionHierarchy, InstructionFile } from './instructionResolver';

/**
 * Represents a node in the instruction hierarchy visualization
 */
export interface HierarchyNode {
  /** Display name for the node */
  label: string;
  /** Description of the node's role */
  description: string;
  /** Full path or identifier */
  path: string;
  /** Children nodes */
  children: HierarchyNode[];
  /** Whether this node has instructions */
  hasInstructions: boolean;
  /** Content preview (if available) */
  contentPreview?: string;
  /** Level in the hierarchy */
  level: number;
}

/**
 * Visualizes instruction hierarchies and inheritance relationships
 */
export class HierarchyVisualizer {
  /**
   * Generate a hierarchy node structure for a given instruction hierarchy
   */
  public static generateHierarchyTree(hierarchy: InstructionHierarchy): HierarchyNode {
    const root: HierarchyNode = {
      label: 'Root',
      description: 'Base instructions',
      path: '',
      children: [],
      hasInstructions: false,
      level: 0
    };

    // Build tree from the hierarchy files
    let currentNode = root;
    const files = [...hierarchy.files].reverse(); // Start from root

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const node: HierarchyNode = {
        label: path.basename(file.directory) || 'Workspace Root',
        description: file.relativePath,
        path: file.path,
        children: [],
        hasInstructions: true,
        contentPreview: this.generateContentPreview(file.content),
        level: files.length - 1 - i
      };

      currentNode.children.push(node);
      currentNode = node;
    }

    return root;
  }

  /**
   * Generate a text-based tree representation
   */
  public static generateTextTree(hierarchy: InstructionHierarchy): string {
    const lines: string[] = [];
    lines.push('# Copilot Instruction Hierarchy');
    lines.push('');
    lines.push(`Target file: \`${hierarchy.targetFile}\``);
    lines.push('');
    lines.push('## Inheritance Chain (closest to root)');
    lines.push('');

    const files = hierarchy.files;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const indent = '  '.repeat(i);
      const prefix = i === files.length - 1 ? '└── ' : '├── ';
      const marker = i === 0 ? ' 🎯' : i === files.length - 1 ? ' 🏠' : '';
      
      lines.push(`${indent}${prefix}${file.relativePath}${marker}`);
      lines.push(`${indent}    Level ${file.level} • ${this.countLines(file.content)} lines`);
    }

    lines.push('');
    lines.push('## Merged Instructions Preview');
    lines.push('');
    lines.push('```markdown');
    lines.push(hierarchy.mergedContent.substring(0, 500));
    if (hierarchy.mergedContent.length > 500) {
      lines.push('...');
      lines.push(`(total: ${this.countLines(hierarchy.mergedContent)} lines)`);
    }
    lines.push('```');

    if (hierarchy.overridesApplied) {
      lines.push('');
      lines.push('⚠️ **Workspace overrides have been applied to these instructions**');
    }

    return lines.join('\n');
  }

  /**
   * Generate an HTML visualization for webview
   */
  public static generateHtmlVisualization(hierarchy: InstructionHierarchy): string {
    const files = hierarchy.files;
    
    let nodesHtml = '';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isFirst = i === 0;
      const isLast = i === files.length - 1;
      
      nodesHtml += `
        <div class="node ${isFirst ? 'target' : ''} ${isLast ? 'root' : ''}" 
             style="--level: ${file.level}">
          <div class="node-header">
            <span class="node-badge" title="${isFirst ? 'Closest to target' : isLast ? 'Root level' : 'Intermediate'}">
              ${isFirst ? '🎯' : isLast ? '🏠' : '⏵'}
            </span>
            <span class="node-path" title="${file.path}">${file.relativePath}</span>
          </div>
          <div class="node-meta">
            <span>Level ${file.level}</span>
            <span>${this.countLines(file.content)} lines</span>
            <span>Modified: ${file.lastModified.toLocaleDateString()}</span>
          </div>
          <div class="node-preview" title="Click to expand">
            <pre>${this.escapeHtml(this.generateContentPreview(file.content))}</pre>
          </div>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-editorWidget-background);
            --fg-primary: var(--vscode-foreground);
            --accent: var(--vscode-focusBorder);
            --border: var(--vscode-panel-border);
            --success: #4ec9b0;
            --warning: #cca700;
          }
          
          * {
            box-sizing: border-box;
          }
          
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background: var(--bg-primary);
            color: var(--fg-primary);
            padding: 20px;
            margin: 0;
          }
          
          h1 {
            margin: 0 0 10px 0;
            font-size: 1.5em;
          }
          
          .target-file {
            color: var(--vscode-textPreformat-foreground);
            margin-bottom: 20px;
            padding: 10px;
            background: var(--bg-secondary);
            border-radius: 4px;
          }
          
          .hierarchy {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          
          .node {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
            margin-left: calc(var(--level) * 20px);
            transition: all 0.2s;
          }
          
          .node:hover {
            border-color: var(--accent);
          }
          
          .node.target {
            border-color: var(--success);
            border-width: 2px;
          }
          
          .node.root {
            border-color: var(--accent);
          }
          
          .node-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
          }
          
          .node-badge {
            font-size: 1.2em;
          }
          
          .node-path {
            font-weight: bold;
            font-family: var(--vscode-editor-font-family);
          }
          
          .node-meta {
            display: flex;
            gap: 16px;
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
          }
          
          .node-preview {
            background: var(--bg-primary);
            border-radius: 4px;
            padding: 8px;
            cursor: pointer;
          }
          
          .node-preview pre {
            margin: 0;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.85em;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 100px;
            overflow: hidden;
          }
          
          .node-preview.expanded pre {
            max-height: none;
          }
          
          .legend {
            margin-top: 20px;
            padding: 10px;
            background: var(--bg-secondary);
            border-radius: 4px;
            font-size: 0.9em;
          }
          
          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
          }
          
          .info-box {
            margin-top: 20px;
            padding: 12px;
            background: var(--bg-secondary);
            border-left: 4px solid var(--warning);
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <h1>🔗 Copilot Instruction Hierarchy</h1>
        <div class="target-file">
          <strong>Target:</strong> ${path.basename(hierarchy.targetFile)}
        </div>
        
        <div class="hierarchy">
          ${nodesHtml}
        </div>
        
        <div class="legend">
          <strong>Legend:</strong>
          <div class="legend-item"><span>🎯</span> Closest instructions to target file</div>
          <div class="legend-item"><span>⏵</span> Intermediate level instructions</div>
          <div class="legend-item"><span>🏠</span> Root/workspace level instructions</div>
        </div>

        ${hierarchy.overridesApplied ? `
        <div class="info-box">
          ⚠️ <strong>Workspace overrides applied:</strong> Some instructions have been overridden via workspace settings.
        </div>
        ` : ''}
        
        <script>
          document.querySelectorAll('.node-preview').forEach(el => {
            el.addEventListener('click', () => {
              el.classList.toggle('expanded');
            });
          });
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Generate a content preview (first few lines)
   */
  private static generateContentPreview(content: string, maxLines: number = 5): string {
    const lines = content.split('\n').filter(line => line.trim());
    const preview = lines.slice(0, maxLines).join('\n');
    
    if (lines.length > maxLines) {
      return preview + '\n...';
    }
    return preview;
  }

  /**
   * Count lines in content
   */
  private static countLines(content: string): number {
    return content.split('\n').length;
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Show hierarchy in a webview panel
   */
  public static async showInWebview(
    hierarchy: InstructionHierarchy, 
    extensionUri: vscode.Uri
  ): Promise<vscode.WebviewPanel> {
    const panel = vscode.window.createWebviewPanel(
      'copilotInstructionHierarchy',
      'Copilot Instruction Hierarchy',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    panel.webview.html = this.generateHtmlVisualization(hierarchy);
    
    return panel;
  }

  /**
   * Show hierarchy in a text document
   */
  public static async showInDocument(hierarchy: InstructionHierarchy): Promise<vscode.TextDocument> {
    const text = this.generateTextTree(hierarchy);
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: text
    });
    
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Two,
      preview: true
    });
    
    return doc;
  }
}