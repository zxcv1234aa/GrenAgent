import { useEffect, useState } from 'react';
import type { EditorSlashMenuItems } from '@lobehub/ui';
import { pi } from '../../../lib/pi';
import {
  getFrontendCommands,
  mergeCommands,
  parseCommands,
  toSlashMenuItems,
} from './commandUtils';

const COMMAND_CACHE_TTL_MS = 10_000;
const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 400;

const commandCache = new Map<string, { data: EditorSlashMenuItems; expiresAt: number }>();
const commandInflight = new Map<string, Promise<EditorSlashMenuItems>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWorkspaceNotOpenError(error: unknown): boolean {
  return String(error).includes('workspace not open');
}

async function fetchCommands(workspace: string): Promise<EditorSlashMenuItems> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await pi.getCommands(workspace);
      const merged = mergeCommands(parseCommands(raw), getFrontendCommands());
      return toSlashMenuItems(merged);
    } catch (error) {
      if (isWorkspaceNotOpenError(error) && attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }
  return toSlashMenuItems(getFrontendCommands());
}

async function loadCommands(workspace: string): Promise<EditorSlashMenuItems> {
  const now = Date.now();
  const cached = commandCache.get(workspace);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const inflight = commandInflight.get(workspace);
  if (inflight) return inflight;

  const request = fetchCommands(workspace)
    .then((data) => {
      commandCache.set(workspace, { data, expiresAt: Date.now() + COMMAND_CACHE_TTL_MS });
      return data;
    })
    .catch(() => toSlashMenuItems(getFrontendCommands()))
    .finally(() => {
      commandInflight.delete(workspace);
    });

  commandInflight.set(workspace, request);
  return request;
}

export function useSlashCommands(open: boolean, workspace: string) {
  const [items, setItems] = useState<EditorSlashMenuItems>(() =>
    toSlashMenuItems(getFrontendCommands()),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !workspace) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void loadCommands(workspace)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setItems(toSlashMenuItems(getFrontendCommands()));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, workspace]);

  return { items, loading, error };
}
