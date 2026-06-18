// SpecsFileTree — renders a sorted tree of specs/*.md files with folder grouping.
// Each file shows a dirty indicator (unsaved dot) when present in dirtyPaths.
// Clicking a file calls onSelect; the currently selected path is highlighted.
import { useMemo } from 'react';
import { DocumentTextIcon, FolderIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import translations from '../translations/en.json';

export interface SpecsManifestEntry {
  path: string;
  sizeBytes: number;
}

export interface SpecsFileTreeProps {
  files: SpecsManifestEntry[];
  selectedPath: string | null;
  dirtyPaths: Set<string>;
  // [why] Files that are locally saved but not yet committed — show an indigo
  // indicator so users can see which files need committing.
  pendingCommitPaths: Set<string>;
  onSelect: (path: string) => void;
}

interface FileNode {
  type: 'file';
  name: string;
  path: string;
}

interface FolderNode {
  type: 'folder';
  name: string;
  children: TreeNode[];
}

type TreeNode = FileNode | FolderNode;

// Build nested folder/file tree from flat path list.
function buildTree(files: SpecsManifestEntry[]): TreeNode[] {
  const root: FolderNode = { type: 'folder', name: '', children: [] };

  for (const file of files) {
    const parts = file.path.replace(/^\//, '').split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      if (i === parts.length - 1) {
        current.children.push({ type: 'file', name: part, path: file.path });
      } else {
        let folder = current.children.find(
          (n): n is FolderNode => n.type === 'folder' && n.name === part,
        );
        if (!folder) {
          folder = { type: 'folder', name: part, children: [] };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  // Sort each level: folders first, then files, each alphabetically.
  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return [...nodes].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return sortNodes(nodes).map((n) => {
      if (n.type === 'folder') return { ...n, children: sortTree(n.children) };
      return n;
    });
  }

  return sortTree(root.children);
}

// Recursive tree renderer.
function TreeNodes({
  nodes,
  selectedPath,
  dirtyPaths,
  pendingCommitPaths,
  onSelect,
  depth,
}: {
  nodes: TreeNode[];
  selectedPath: string | null;
  dirtyPaths: Set<string>;
  pendingCommitPaths: Set<string>;
  onSelect: (path: string) => void;
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'folder') {
          return (
            <div key={`folder-${node.name}-${depth}`}>
              <div
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted"
                style={{ paddingLeft: `${(depth + 1) * 12}px` }}
              >
                <FolderOpenIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {node.name}
              </div>
              <TreeNodes
                nodes={node.children}
                selectedPath={selectedPath}
                dirtyPaths={dirtyPaths}
                pendingCommitPaths={pendingCommitPaths}
                onSelect={onSelect}
                depth={depth + 1}
              />
            </div>
          );
        }

        const isSelected = selectedPath === node.path;
        const isDirty = dirtyPaths.has(node.path);
        const isPendingCommit = !isDirty && pendingCommitPaths.has(node.path);

        return (
          <button
            key={node.path}
            type="button"
            onClick={() => { onSelect(node.path); }}
            style={{ paddingLeft: `${(depth + 1) * 12}px` }}
            className={[
              'flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm transition-colors',
              isSelected
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
                : 'text-subtle hover:bg-bg-overlay hover:text-base',
            ].join(' ')}
            title={node.path}
          >
            <DocumentTextIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">{node.name}</span>
            {isDirty && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                aria-label={translations['SpecsFileTree.unsavedChangesAria']}
                title={translations['SpecsFileTree.unsavedChangesTitle']}
              />
            )}
            {isPendingCommit && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                aria-label={translations['SpecsFileTree.readyToCommitAria']}
                title={translations['SpecsFileTree.readyToCommitTitle']}
              />
            )}
          </button>
        );
      })}
    </>
  );
}

const SpecsFileTree = ({ files, selectedPath, dirtyPaths, pendingCommitPaths, onSelect }: SpecsFileTreeProps) => {
  const tree = useMemo(() => buildTree(files), [files]);

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <FolderIcon className="h-8 w-8 text-muted" aria-hidden="true" />
        <p className="text-sm text-muted">No spec files found.</p>
      </div>
    );
  }

  return (
    <nav aria-label={translations['SpecsFileTree.navAria']} className="py-1">
      <TreeNodes
        nodes={tree}
        selectedPath={selectedPath}
        dirtyPaths={dirtyPaths}
        pendingCommitPaths={pendingCommitPaths}
        onSelect={onSelect}
        depth={0}
      />
    </nav>
  );
};

export default SpecsFileTree;
