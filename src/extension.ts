// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Enhanced tree item with better text formatting
class DirectoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly fullPath?: string,
    public readonly contextValue?: string
  ) {
    super(label, collapsibleState);
    
    // Set the tooltip to show the full path on hover
    if (fullPath) {
      this.tooltip = fullPath;
      
      // Format the description to show the directory part of the path
      // This appears to the right of the label in a different style
      // and helps with readability
      const dirName = path.dirname(fullPath);
      if (dirName !== '.') {
        // Truncate long paths with ellipsis in the middle
        this.description = formatPath(dirName);
      }
    }
    
    // Set contextValue for potential context menu customization
    if (contextValue) {
      this.contextValue = contextValue;
    }
  }
}

// Helper function to format paths for better display
function formatPath(filePath: string): string {
  const maxLength = 40; // Maximum length to display
  
  if (filePath.length <= maxLength) {
    return filePath;
  }
  
  // For long paths, keep the beginning and end, add ellipsis in the middle
  const start = filePath.substring(0, maxLength / 2 - 3);
  const end = filePath.substring(filePath.length - (maxLength / 2 - 3));
  return `${start}...${end}`;
}

// Helper function to count file types in a directory
function countFileTypes(directoryPath: string): { [key: string]: number } {
  try {
    const files = fs.readdirSync(directoryPath);
    const counts: { [key: string]: number } = {
      directories: 0,
      files: 0
    };
    
    for (const file of files) {
      try {
        const filePath = path.join(directoryPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          counts.directories++;
        } else {
          counts.files++;
          
          // Count by extension
          const ext = path.extname(file).toLowerCase();
          if (ext) {
            counts[ext] = (counts[ext] || 0) + 1;
          } else {
            counts['no-extension'] = (counts['no-extension'] || 0) + 1;
          }
        }
      } catch (e) {
        // Skip files we can't access
      }
    }
    
    return counts;
  } catch (e) {
    return { error: 1 };
  }
}

// Helper function to get readable size
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

// Helper function to calculate directory size
function calculateDirSize(dirPath: string): number {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      try {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          // Don't recurse too deep for performance reasons
          // Just count the immediate directory size
          totalSize += stats.size;
        } else {
          totalSize += stats.size;
        }
      } catch (e) {
        // Skip files we can't access
      }
    }
  } catch (e) {
    // Return 0 if can't access directory
  }
  
  return totalSize;
}

// Provider that shows selected item or workspace root
class SelectedItemProvider implements vscode.TreeDataProvider<DirectoryItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DirectoryItem | undefined | null | void> = new vscode.EventEmitter<DirectoryItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DirectoryItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  private currentSelection: vscode.Uri | undefined;
  
  constructor(private workspaceRoot: string | undefined) {}

  refresh(selection?: vscode.Uri): void {
    this.currentSelection = selection;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DirectoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DirectoryItem): Thenable<DirectoryItem[]> {
    // If this is a nested level request (we already have an element), 
    // return no children for this simple example
    if (element) {
      return Promise.resolve([]);
    }

    const items: DirectoryItem[] = [];

    // If we have a current selection, show details about it
    if (this.currentSelection) {
      try {
        const stats = fs.statSync(this.currentSelection.fsPath);
        const itemName = path.basename(this.currentSelection.fsPath);
        const itemType = stats.isDirectory() ? 'Directory' : 'File';
        const contextValue = stats.isDirectory() ? 'directory' : 'file';
        
        // Add basic info item
        items.push(
          new DirectoryItem(
            `${itemType}: ${itemName}`,
            vscode.TreeItemCollapsibleState.None,
            this.currentSelection.fsPath,
            contextValue
          )
        );
        
        // Add common details for both files and directories
        const createdDate = stats.birthtime.toLocaleString();
        items.push(
          new DirectoryItem(
            `Created: ${createdDate}`,
            vscode.TreeItemCollapsibleState.None
          )
        );
        
        const modifiedDate = stats.mtime.toLocaleString();
        items.push(
          new DirectoryItem(
            `Modified: ${modifiedDate}`,
            vscode.TreeItemCollapsibleState.None
          )
        );
        
        // Add permission info
        const permissions = (stats.mode & 0o777).toString(8);
        items.push(
          new DirectoryItem(
            `Permissions: ${permissions}`,
            vscode.TreeItemCollapsibleState.None
          )
        );
        
        // Add file-specific details
        if (!stats.isDirectory()) {
          // Add size info for files
          items.push(
            new DirectoryItem(
              `Size: ${formatSize(stats.size)}`,
              vscode.TreeItemCollapsibleState.None
            )
          );
          
          // Show file extension if it exists
          const extension = path.extname(itemName);
          if (extension) {
            items.push(
              new DirectoryItem(
                `Type: ${extension.substring(1)}`,
                vscode.TreeItemCollapsibleState.None
              )
            );
          }
        } 
        // Add directory-specific details
        else {
          // Calculate directory size (non-recursive for performance)
          const dirSize = calculateDirSize(this.currentSelection.fsPath);
          items.push(
            new DirectoryItem(
              `Size (approx): ${formatSize(dirSize)}`,
              vscode.TreeItemCollapsibleState.None
            )
          );
          
          // For directories, count files by type
          try {
            const files = fs.readdirSync(this.currentSelection.fsPath);
            items.push(
              new DirectoryItem(
                `Contains: ${files.length} items`,
                vscode.TreeItemCollapsibleState.None
              )
            );
            
            // Count files vs directories
            const counts = countFileTypes(this.currentSelection.fsPath);
            
            if (counts.directories > 0) {
              items.push(
                new DirectoryItem(
                  `Subdirectories: ${counts.directories}`,
                  vscode.TreeItemCollapsibleState.None
                )
              );
            }
            
            if (counts.files > 0) {
              items.push(
                new DirectoryItem(
                  `Files: ${counts.files}`,
                  vscode.TreeItemCollapsibleState.None
                )
              );
            }
            
            // Show most common file types (limit to top 3)
            const extensions = Object.entries(counts)
              .filter(([key]) => !['directories', 'files', 'no-extension', 'error'].includes(key))
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            
            if (extensions.length > 0) {
              const extensionSummary = extensions
                .map(([ext, count]) => `${ext.substring(1)}: ${count}`)
                .join(', ');
              
              items.push(
                new DirectoryItem(
                  `Common types: ${extensionSummary}`,
                  vscode.TreeItemCollapsibleState.None
                )
              );
            }
          } catch (e) {
            // Ignore errors reading directory
            items.push(
              new DirectoryItem(
                'Error reading directory contents',
                vscode.TreeItemCollapsibleState.None
              )
            );
          }
        }
      } catch (error) {
        // Handle errors gracefully
        items.push(
          new DirectoryItem(
            'Error reading file information',
            vscode.TreeItemCollapsibleState.None
          )
        );
      }
    } 
    // If no selection but we have a workspace, show the workspace root
    else if (this.workspaceRoot) {
      const folderName = path.basename(this.workspaceRoot);
      items.push(
        new DirectoryItem(
          `Workspace: ${folderName}`,
          vscode.TreeItemCollapsibleState.None,
          this.workspaceRoot,
          'directory'
        )
      );
      
      // Add additional workspace info
      try {
        const files = fs.readdirSync(this.workspaceRoot);
        items.push(
          new DirectoryItem(
            `Root contains: ${files.length} items`,
            vscode.TreeItemCollapsibleState.None
          )
        );
        
        // Add stats about workspace
        const counts = countFileTypes(this.workspaceRoot);
        
        if (counts.directories > 0) {
          items.push(
            new DirectoryItem(
              `Subdirectories: ${counts.directories}`,
              vscode.TreeItemCollapsibleState.None
            )
          );
        }
        
        if (counts.files > 0) {
          items.push(
            new DirectoryItem(
              `Files: ${counts.files}`,
              vscode.TreeItemCollapsibleState.None
            )
          );
        }
      } catch (e) {
        // Ignore errors reading directory
      }
    } 
    // Neither workspace nor selection
    else {
      items.push(
        new DirectoryItem(
          'No workspace or selection',
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    return Promise.resolve(items);
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

  // Create the tree data provider
  const selectedItemProvider = new SelectedItemProvider(workspaceRoot);
  
  // Register the tree view
  const treeView = vscode.window.createTreeView('selectedItemExplorer', { 
    treeDataProvider: selectedItemProvider 
  });
  
  // Add to subscriptions so it gets disposed properly
  context.subscriptions.push(treeView);

  // Listen for selection changes in the active editor
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        selectedItemProvider.refresh(editor.document.uri);
      }
    })
  );

  // Listen for file explorer selection changes (using API compatible approach)
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(() => {
      // This is triggered when the user clicks around, we can check if there's
      // a selection from the Explorer view via vscode API
      vscode.commands.executeCommand('copyFilePath').then(
        () => {
          // If selection exists, the clipboard now has the file path
          vscode.env.clipboard.readText().then(text => {
            if (text && (text.startsWith('/') || text.includes(':/'))) {
              try {
                const uri = vscode.Uri.file(text);
                if (fs.existsSync(uri.fsPath)) {
                  selectedItemProvider.refresh(uri);
                }
              } catch (e) {
                // Not a valid path, ignore
              }
            }
          });
        },
        () => {} // Ignore if command fails - no selection
      );
    })
  );

  // Also register a command to manually select a path (backup approach)
  const selectCommand = vscode.commands.registerCommand('codelens.selectPath', async () => {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select',
      canSelectFiles: true,
      canSelectFolders: true
    };
    
    const fileUri = await vscode.window.showOpenDialog(options);
    if (fileUri && fileUri[0]) {
      selectedItemProvider.refresh(fileUri[0]);
    }
  });
  
  context.subscriptions.push(selectCommand);

  // If there's an active editor at startup, use it
  if (vscode.window.activeTextEditor) {
    selectedItemProvider.refresh(vscode.window.activeTextEditor.document.uri);
  }

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
