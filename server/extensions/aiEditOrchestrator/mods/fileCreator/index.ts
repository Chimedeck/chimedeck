// File creator — writes new markdown files within allowed paths.
// [why] The orchestrator creates new files (e.g. sprint specs, changelog entries)
// before editing existing ones, following the create-before-edit contract.
import { validatePath } from '../pathGuard';
import type { CreateFileInput, CreateFileResult } from '../../types';

export const fileCreatorDeps = {
  validatePath,
  writeFile: async (filePath: string, content: string): Promise<void> => {
    // [why] Use Bun's native file API for fast, synchronous writes
    // in the async pipeline.
    await Bun.write(filePath, content);
  },
  fileExists: async (filePath: string): Promise<boolean> => {
    const file = Bun.file(filePath);
    return file.exists();
  },
};

/**
 * Create a new file at the given relative path with the provided content.
 * [why] Validates path first, checks for existing file (idempotent skip),
 * creates parent directories, then writes the file.
 */
export async function createFile({
  filePath,
  content,
}: CreateFileInput): Promise<CreateFileResult> {
  // 1. Validate path is within allowed zones
  const pathCheck = fileCreatorDeps.validatePath({ filePath });
  if (!pathCheck.allowed) {
    return {
      status: 403,
      name: 'path-not-allowed',
      data: { filePath, created: false },
      message: pathCheck.reason,
    };
  }

  // 2. Check if file already exists — idempotent skip
  const exists = await fileCreatorDeps.fileExists(filePath);
  if (exists) {
    return {
      status: 409,
      name: 'file-already-exists',
      data: { filePath, created: false },
      message: `File already exists at "${filePath}" — skipping creation`,
    };
  }

  // 3. Create parent directories if needed
  const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
  if (parentDir) {
    try {
      // [why] Bun doesn't have a built-in mkdir -p equivalent natively,
      // so we use the file system to create directories recursively.
      const mkdirResult =
        Bun.spawnSync({
          cmd: ['mkdir', '-p', parentDir],
          stdout: 'pipe',
          stderr: 'pipe',
        });
      if (mkdirResult.exitCode !== 0) {
        const errStr = new TextDecoder().decode(mkdirResult.stderr);
        return {
          status: 500,
          name: 'directory-creation-failed',
          data: { filePath, created: false },
          message: `Failed to create parent directory "${parentDir}": ${errStr}`,
        };
      }
    } catch (error) {
      return {
        status: 500,
        name: 'directory-creation-failed',
        data: { filePath, created: false },
        message: error instanceof Error ? error.message : 'Unknown directory creation error',
      };
    }
  }

  // 4. Write the file
  try {
    await fileCreatorDeps.writeFile(filePath, content);
    return {
      status: 201,
      data: { filePath, created: true },
    };
  } catch (error) {
    return {
      status: 500,
      name: 'file-write-failed',
      data: { filePath, created: false },
      message: error instanceof Error ? error.message : 'Unknown write error',
    };
  }
}
