// Core logic for finding and merging copilot-instructions.md files
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface InstructionFile {
    path: string;
    relativePath: string;
    content: string;
    depth: number;
}

export class InstructionResolver {
    private readonly INSTRUCTION_FILENAME = 'copilot-instructions.md';

    /**
     * Walks up the directory tree from workspace root to find all instruction files
     */
    async findAllInstructions(): Promise<InstructionFile[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const instructions: InstructionFile[] = [];

        for (const folder of workspaceFolders) {
            const folderInstructions = await this.findInstructionsInFolder(folder.uri.fsPath);
            instructions.push(...folderInstructions);
        }

        // Sort by depth (root first, then deeper)
        return instructions.sort((a, b) => a.depth - b.depth);
    }

    /**
     * Walk up from a folder path to find all copilot-instructions.md files
     */
    private async findInstructionsInFolder(startPath: string): Promise<InstructionFile[]> {
        const instructions: InstructionFile[] = [];
        let currentPath = startPath;
        let depth = 0;

        // Walk up the directory tree
        while (true) {
            const instructionPath = path.join(currentPath, this.INSTRUCTION_FILENAME);
            
            if (fs.existsSync(instructionPath)) {
                try {
                    const content = fs.readFileSync(instructionPath, 'utf-8');
                    const relativePath = path.relative(startPath, instructionPath) || this.INSTRUCTION_FILENAME;
                    
                    instructions.push({
                        path: instructionPath,
                        relativePath: relativePath,
                        content: content,
                        depth: depth
                    });
                } catch (err) {
                    console.error(`Error reading ${instructionPath}:`, err);
                }
            }

            // Move up to parent
            const parentPath = path.dirname(currentPath);
            
            // Stop if we've reached the root
            if (parentPath === currentPath) {
                break;
            }

            currentPath = parentPath;
            depth++;
        }

        return instructions;
    }

    /**
     * Get merged instruction content based on config strategy
     */
    async getMergedInstructions(): Promise<string | null> {
        const instructions = await this.findAllInstructions();
        
        if (instructions.length === 0) {
            return null;
        }

        const config = vscode.workspace.getConfiguration('copilotInstructionResolver');
        const strategy = config.get<string>('mergeStrategy', 'concatenate');

        if (strategy === 'override') {
            // Use only the deepest (most specific) instruction
            return instructions[instructions.length - 1].content;
        }

        // Concatenate: root first, then each child adds its own
        const merged = instructions.map((inst, index) => {
            const header = index === 0 
                ? `# Base Instructions (${inst.relativePath})\n\n`
                : `\n---\n\n# Override from ${inst.relativePath}\n\n`;
            return header + inst.content;
        }).join('\n');

        return merged;
    }

    /**
     * Check if there's a copilot-instructions.md in workspace root
     */
    hasRootInstructions(): boolean {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return false;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const rootInstruction = path.join(rootPath, this.INSTRUCTION_FILENAME);
        
        return fs.existsSync(rootInstruction);
    }
}