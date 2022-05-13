// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "treeicons" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('treeicons.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from treeicons!');
	});

	let treeDataProvider = new Provider();
	context.subscriptions.push(vscode.window.createTreeView('fileExplorer', { treeDataProvider }));
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

interface Entry {
	level : number;
	uri: vscode.Uri;
	type: vscode.FileType;
}

export class FileStat implements vscode.FileStat {

	constructor(private fsStat: fs.Stats) { }

	get type(): vscode.FileType {
		return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
	}

	get isFile(): boolean | undefined {
		return this.fsStat.isFile();
	}

	get isDirectory(): boolean | undefined {
		return this.fsStat.isDirectory();
	}

	get isSymbolicLink(): boolean | undefined {
		return this.fsStat.isSymbolicLink();
	}

	get size(): number {
		return this.fsStat.size;
	}

	get ctime(): number {
		return this.fsStat.ctime.getTime();
	}

	get mtime(): number {
		return this.fsStat.mtime.getTime();
	}
}

function handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
	if (error) {
		reject(massageError(error));
	} else {
		resolve(result);
	}
}

function massageError(error: Error & { code?: string }): Error {
	if (error.code === 'ENOENT') {
		return vscode.FileSystemError.FileNotFound();
	}

	if (error.code === 'EISDIR') {
		return vscode.FileSystemError.FileIsADirectory();
	}

	if (error.code === 'EEXIST') {
		return vscode.FileSystemError.FileExists();
	}

	if (error.code === 'EPERM' || error.code === 'EACCESS') {
		return vscode.FileSystemError.NoPermissions();
	}

	return error;
}


export function readdir(path: string): Promise<string[]> {
	return new Promise<string[]>((resolve, reject) => {
		fs.readdir(path, (error, children) => handleResult(resolve, reject, error, children));
	});
}

export function stat(path: string): Promise<fs.Stats> {
	return new Promise<fs.Stats>((resolve, reject) => {
		fs.stat(path, (error, stat) => handleResult(resolve, reject, error, stat));
	});
}

class Provider implements vscode.TreeDataProvider<Entry> {
	async _stat(path: string): Promise<vscode.FileStat> {
		return new FileStat(await stat(path));
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
		return this._readDirectory(uri);
	}

	async _readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
		const children = await readdir(uri.fsPath);

		const result: [string, vscode.FileType][] = [];
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const stat = await this._stat(path.join(uri.fsPath, child));
			result.push([child, stat.type]);
		}

		return Promise.resolve(result);
	}

	async getChildren(element?: Entry): Promise<Entry[]> {
		if (element) {
			const children = await this.readDirectory(element.uri);
			const l = element.level + 1;
			return children.map(([name, type]) => ({ 
				level : l,
				uri : vscode.Uri.file(path.join(element.uri.fsPath, name)),
				type }));
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.filter(folder => folder.uri.scheme === 'file')[0];
		if (workspaceFolder) {
			const children = await this.readDirectory(workspaceFolder.uri);
			children.sort((a, b) => {
				if (a[1] === b[1]) {
					return a[0].localeCompare(b[0]);
				}
				return a[1] === vscode.FileType.Directory ? -1 : 1;
			});
			return children.map(([name, type]) => ({ 
				level : 0,
				uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, name)), 
				type }));
		}

		return [];
	}

	getTreeItem(element: Entry): vscode.TreeItem {
		let l = element.uri.path;
		l = l.substring(l.lastIndexOf('/') + 1);

		// each other level will have resourceUri undefined
		let u : boolean;
		if (element.type === vscode.FileType.Directory) {
			if ((element.level % 2) === 0) {
				u = true;
				l = l + " (broken)";
			} else {
				l =  l + " (without URI)";
				u = false;
			}
		} else {
			u = true;
		}
		const treeItem = new vscode.TreeItem(l, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		if (u) {
			treeItem.resourceUri = element.uri;
		}
		treeItem.iconPath = new vscode.ThemeIcon("extensions");
		if (element.type === vscode.FileType.File) {
			treeItem.command = { command: 'fileExplorer.openFile', title: "Open File", arguments: [element.uri], };
			treeItem.contextValue = 'file';
		}
		return treeItem;
	}
}