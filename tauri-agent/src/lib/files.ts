import { invoke } from '@tauri-apps/api/core';

export interface FileNode {
  name: string;
  path: string;
  kind: 'file' | 'directory' | string;
  children?: FileNode[] | null;
  git_status?: string | null;
  size?: number | null;
}

export interface BinaryFile {
  mime_type: string;
  data: string;
  size: number;
}

export interface FileStatus {
  path: string;
  status: string;
}

export const files = {
  getTree: (workspace: string, includeGitStatus = false) =>
    invoke<FileNode>('get_file_tree', { workspace, includeGitStatus }),

  read: (workspace: string, path: string) =>
    invoke<string>('read_file', { workspace, path }),

  readBinary: (workspace: string, path: string) =>
    invoke<BinaryFile>('read_file_binary', { workspace, path }),

  write: (workspace: string, path: string, content: string) =>
    invoke<void>('write_file', { workspace, path, content }),

  gitStatus: (workspace: string) =>
    invoke<FileStatus[]>('get_git_status', { workspacePath: workspace }),

  gitDiff: (workspace: string, filePath: string) =>
    invoke<string>('get_git_diff', { workspacePath: workspace, filePath }),
};
