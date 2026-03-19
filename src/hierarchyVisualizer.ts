// Visualizes the instruction inheritance hierarchy
import * as vscode from 'vscode';
import { InstructionResolver } from './instructionResolver';

export class HierarchyVisualizer {
    private panel: vscode.WebviewPanel | undefined;

    async show(resolver: InstructionResolver): Promise<void> {
        const instructions = await resolver.findAllInstructions();

        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'copilotInstructionHierarchy',
                'Copilot Instruction Hierarchy',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }

        this.panel.webview.html = this.getHtmlContent(instructions);
    }

    private getHtmlContent(instructions: { path: string; relativePath: string; depth: number }[]): string {
        if (instructions.length === 0) {
            return this.getEmptyHtml();
        }

        const hierarchyItems = instructions.map((inst, index) => {
            const isRoot = index === 0;
            const isActive = index === instructions.length - 1;
            const indent = index * 30;
            
            return `
                <div class="hierarchy-item" style="margin-left: ${indent}px;">
                    <div class="connector ${isRoot ? 'root' : ''}"></div>
                    <div class="node ${isRoot ? 'root-node' : ''} ${isActive ? 'active-node' : ''}">
                        <div class="level">${isRoot ? 'ROOT' : isActive ? 'ACTIVE' : `Level +${index}`}</div>
                        <div class="path">${this.escapeHtml(inst.path)}</div>
                        <div class="relative">${this.escapeHtml(inst.relativePath)}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Copilot Instruction Hierarchy</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px;
        }
        h1 {
            color: var(--vscode-titleBar-activeForeground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .info-box {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .hierarchy {
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .hierarchy-item {
            display: flex;
            align-items: flex-start;
            position: relative;
        }
        .connector {
            width: 20px;
            height: 60px;
            border-left: 2px solid var(--vscode-panel-border);
            border-bottom: 2px solid var(--vscode-panel-border);
            margin-right: 10px;
            margin-top: -20px;
        }
        .connector.root {
            border-left: none;
            border-bottom: none;
            width: 0;
        }
        .node {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 10px;
            min-width: 300px;
        }
        .node.root-node {
            border-color: var(--vscode-charts-blue);
            background: rgba(0, 122, 204, 0.1);
        }
        .node.active-node {
            border-color: var(--vscode-charts-green);
            background: rgba(0, 168, 0, 0.1);
        }
        .level {
            font-size: 11px;
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .path {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            color: var(--vscode-foreground);
            margin-top: 4px;
        }
        .relative {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
        }
        .legend {
            margin-top: 20px;
            padding: 10px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 5px 0;
            font-size: 12px;
        }
        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
        .legend-root { background: rgba(0, 122, 204, 0.5); }
        .legend-inherited { background: var(--vscode-editor-inactiveSelectionBackground); }
        .legend-active { background: rgba(0, 168, 0, 0.5); }
    </style>
</head>
<body>
    <h1>📋 Copilot Instruction Hierarchy</h1>
    
    <div class="info-box">
        <strong>How it works:</strong> Copilot Instruction Resolver walks up the directory tree 
        from your workspace root to find all <code>copilot-instructions.md</code> files. 
        Instructions are merged from root (base) down to your workspace (most specific).
    </div>

    <div class="hierarchy">
        ${hierarchyItems}
    </div>

    <div class="legend">
        <strong>Legend:</strong>
        <div class="legend-item">
            <div class="legend-color legend-root"></div>
            <span>Root - Base instructions (highest in tree)</span>
        </div>
        <div class="legend-item">
            <div class="legend-color legend-inherited"></div>
            <span>Inherited - Intermediate instruction files</span>
        </div>
        <div class="legend-item">
            <div class="legend-color legend-active"></div>
            <span>Active - Your workspace instructions (deepest/most specific)</span>
        </div>
    </div>
</body>
</html>`;
    }

    private getEmptyHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Copilot Instruction Hierarchy</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 20px;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
        }
        .empty-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        h2 {
            color: var(--vscode-titleBar-activeForeground);
        }
        p {
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h2>No Instructions Found</h2>
        <p>No <code>copilot-instructions.md</code> files were found in your workspace or parent directories.</p>
        <p>Create one at your workspace root to get started!</p>
    </div>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}