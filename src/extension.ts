// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// Simple tree item for our minimal implementation
class DirectoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

// Minimal TreeDataProvider that just shows current workspace root
class SimpleDirectoryProvider implements vscode.TreeDataProvider<DirectoryItem> {
  constructor(private workspaceRoot: string | undefined) {}

  getTreeItem(element: DirectoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DirectoryItem): Thenable<DirectoryItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No workspace folder open');
      return Promise.resolve([]);
    }

    // If we're at the root level (no element), show the workspace directory
    if (!element) {
      // Just show the workspace root folder name
      const folderName = path.basename(this.workspaceRoot);
      return Promise.resolve([
        new DirectoryItem(
          `Current Directory: ${folderName}`, 
          vscode.TreeItemCollapsibleState.None
        )
      ]);
    }

    // No children for any items in this simplified example
    return Promise.resolve([]);
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "codelens" is now active!');

	// Get the workspace folder
	const workspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;

	// Register the simple directory provider that just shows the current workspace
	const directoryProvider = new SimpleDirectoryProvider(workspaceRoot);
	vscode.window.registerTreeDataProvider('directoryExplorer', directoryProvider);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('codelens.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from codelens!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
