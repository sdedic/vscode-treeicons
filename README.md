# TreeIcons test extension

This extension is to demonstrate a bug in TreeView icon handling, present in vscode 1.67. The Extension creates an additional File Explorer
that displays 1st workspace folder, if it exist. 

On first (and each odd) level of the tree, it provides TreeItems with a valid `resourceUri` and an `iconPath` set to `new vscode.ThemeIcon("extensions")`. These
items do NOT show extensions icon, but the default theme-folder (= none) one. On 2nd and each even level, TreeItems have the same `iconPath`, but no `resourceUri` -- and they display as expected, with the requested theme icon (extensions).
