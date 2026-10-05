// File editor — applies structured edits to existing files.
// [why] Preserves YAML front-matter during edits, validates paths,
// and constrains edits to specified line ranges when provided.
import { validatePath } from '../pathGuard';
import { validateFrontMatter } from './frontMatterGuard';
import type { EditFileInput, EditFileResult } from '../../types';

export const fileEditorDeps = {
  validatePath,
  validateFrontMatter,
  readFile: async (filePath: string): Promise<string> => {
    const file = Bun.file(filePath);
    return file.text();
  },
  writeFile: async (filePath: string, content: string): Promise<void> => {
    await Bun.write(filePath, content);
  },
  fileExists: async (filePath: string): Promise<boolean> => {
    const file = Bun.file(filePath);
    return file.exists();
  },
};

/**
 * Apply a search-and-replace edit to a file.
 * [why] Uses a simple search/replace pattern that preserves front-matter
 * and constrains edits to the specified line range when provided.
 */
export async function editFile({
  filePath,
  search,
  replace,
  lineRange,
}: EditFileInput): Promise<EditFileResult> {
  // 1. Validate path
  const pathCheck = fileEditorDeps.validatePath({ filePath });
  if (!pathCheck.allowed) {
    return {
      status: 403,
      name: 'path-not-allowed',
      data: { filePath, applied: false },
      message: pathCheck.reason,
    };
  }

  // 2. Check file exists
  const exists = await fileEditorDeps.fileExists(filePath);
  if (!exists) {
    return {
      status: 404,
      name: 'file-not-found',
      data: { filePath, applied: false },
      message: `File "${filePath}" does not exist — use file creator for new files`,
    };
  }

  // 3. Read file content
  let content: string;
  try {
    content = await fileEditorDeps.readFile(filePath);
  } catch (error) {
    return {
      status: 500,
      name: 'file-read-failed',
      data: { filePath, applied: false },
      message: error instanceof Error ? error.message : 'Unknown read error',
    };
  }

  // 4. Validate front-matter
  const fmCheck = fileEditorDeps.validateFrontMatter({ content, filePath });
  if (!fmCheck.valid) {
    return {
      status: 422,
      name: 'invalid-front-matter',
      data: { filePath, applied: false },
      message: fmCheck.reason ?? 'Invalid front-matter',
    };
  }
  const hadFm = fmCheck.original !== '';

  // 5. Apply the edit
  // [why] If lineRange is provided, constrain the search/replace to those lines
  let newContent: string;
  if (lineRange && (lineRange.startLine || lineRange.endLine)) {
    const lines = content.split('\n');
    const startIdx = (lineRange.startLine ?? 1) - 1;
    const endIdx = lineRange.endLine ?? lines.length;
    const constrainedLines = lines.slice(startIdx, endIdx);
    const constrainedText = constrainedLines.join('\n');

    if (!constrainedText.includes(search)) {
      // [why] If search text isn't in the constrained range,
      // try to append after the last line in range
      const before = lines.slice(0, endIdx).join('\n');
      const after = lines.slice(endIdx).join('\n');
      newContent = before + '\n' + replace + (after ? '\n' + after : '');
    } else {
      newContent = content.replace(search, replace);
    }
  } else {
    if (!content.includes(search)) {
      // [why] Append if search text not found — common for adding sections
      newContent = content + '\n' + replace;
    } else {
      newContent = content.replace(search, replace);
    }
  }

  // 6. Validate the edited content still has valid front-matter
  const postEditFmCheck = fileEditorDeps.validateFrontMatter({
    content: newContent,
    filePath,
  });
  // [why] If the original had front-matter but the edited content doesn't,
  // the edit corrupted the YAML delimiters — reject it.
  if (hadFm && postEditFmCheck.original === '') {
    return {
      status: 422,
      name: 'edit-corrupts-front-matter',
      data: { filePath, applied: false },
      message: 'Edit removed the front-matter delimiters',
    };
  }
  if (!postEditFmCheck.valid) {
    return {
      status: 422,
      name: 'edit-corrupts-front-matter',
      data: { filePath, applied: false },
      message: postEditFmCheck.reason ?? 'Edit would corrupt front-matter',
    };
  }

  // 7. Write the edited content
  try {
    await fileEditorDeps.writeFile(filePath, newContent);

    // Generate a simple summary of what changed
    const changes =
      content !== newContent
        ? `Replaced "${search.slice(0, 100)}${search.length > 100 ? '...' : ''}"` +
          ` with "${replace.slice(0, 100)}${replace.length > 100 ? '...' : ''}"`
        : 'No changes detected';

    return {
      status: 200,
      data: { filePath, applied: true, changes },
    };
  } catch (error) {
    return {
      status: 500,
      name: 'file-write-failed',
      data: { filePath, applied: false },
      message: error instanceof Error ? error.message : 'Unknown write error',
    };
  }
}
