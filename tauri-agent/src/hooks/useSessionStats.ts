import { useCallback, useEffect, useState } from 'react';
import { pi, onPiEvent, type AgentEvent } from '../lib/pi';
import { mapSessionStats, type ContextStats } from '../lib/sessionStats';

const REFETCH_EVENTS = new Set(['agent_end', 'compaction_end', 'message_end']);

function shouldRefetch(event: AgentEvent): boolean {
  if (REFETCH_EVENTS.has(event.type)) {
    if (event.type === 'message_end') {
      return (event as { message: { role?: string } }).message?.role === 'assistant';
    }
    return true;
  }
  return false;
}

export function useSessionStats(workspace: string) {
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const raw = await pi.getSessionStats(workspace);
      setStats(mapSessionStats(raw));
      setError(undefined);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onPiEvent((env) => {
      if (env.workspace !== workspace) return;
      if (shouldRefetch(env.event)) void refetch();
    }).then((un) => {
      unlisten = un;
    });
    return () => unlisten?.();
  }, [workspace, refetch]);

  return { stats, error, loading, refetch };
}
