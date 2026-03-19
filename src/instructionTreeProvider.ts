// Tree view provider for showing instruction hierarchy
import * as vscode from 'vscode';
import { InstructionResolver, InstructionFile } from './instructionResolver';

export class InstructionTreeProvider implements vscode.TreeDataProvider<InstructionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<InstructionItem | undefined | null | void> = new vscode.EventEmitter<InstructionItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<InstructionItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private instructions: InstructionFile[] = [];

    constructor(private resolver: InstructionResolver) {}

    refresh(): void {
        this.resolver.findAllInstructions().then(instructions => {
            this.instructions = instructions;
            this._onDidChangeTreeData.fire();
        });
    }

    getTreeItem(element: InstructionItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: InstructionItem): Thenable<InstructionItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        if (this.instructions.length === 0) {
            return Promise.resolve([
                new InstructionItem(
                    'No copilot-instructions.md found',
                    'Walk up from workspace root to find instruction files',
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    'info'
                )
            ]);
        }

        const items = this.instructions.map((inst, index) => {
            const isRoot = index === 0;
            const isDeepest = index === this.instructions.length - 1;
            const label = isRoot ? '🔵 Root' : isDeepest ? '🟢 Active' : '🟡 Inherited';
            
            return new InstructionItem(
                `${label}: ${inst.relativePath}`,
                inst.path,
                vscode.TreeItemCollapsibleState.None,
                inst.path,
                'file',
                {
                    command: 'copilotInstructionResolver.openFile',
                    title: 'Open',
                    arguments: [inst.path]
                }
            );
        });

        return Promise.resolve(items);
    }
}

class InstructionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly filePath?: string,
        public readonly contextValue?: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.contextValue = contextValue;
        
        if (filePath) {
            this.resourceUri = vscode.Uri.file(filePath);
            this.iconPath = new vscode.ThemeIcon('file-text');
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}