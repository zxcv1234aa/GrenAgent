import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgentStoreContext } from '../../stores/AgentStoreContext';
import { pi } from '../../lib/pi';

export interface SettingsForm {
  values: Record<string, string>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setValue: (key: string, value: string) => void;
  save: () => Promise<void>;
}

export function useSettingsForm(): SettingsForm {
  const { workspace } = useAgentStoreContext();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef(workspace);
  wsRef.current = workspace;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void pi
      .getSettings()
      .then((s) => {
        if (alive) setValues(s ?? {});
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await pi.setSettings(values);
      // env 在 spawn 时注入：close + open 重启 sidecar 使新设置生效。
      const ws = wsRef.current;
      await pi.closeWorkspace(ws);
      await pi.openWorkspace(ws);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [values]);

  return { values, loading, saving, error, setValue, save };
}
