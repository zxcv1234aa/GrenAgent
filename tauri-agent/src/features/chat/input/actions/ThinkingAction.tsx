import { useEffect, useState } from 'react';
import { Select } from '@lobehub/ui/base-ui';
import { useAgentStoreContext } from '../../../../stores/AgentStoreContext';
import { pi } from '../../../../lib/pi';

const LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;

const OPTIONS = LEVELS.map((l) => ({ label: l, value: l }));

interface RpcSessionState {
  thinkingLevel?: string;
}

export default function ThinkingAction() {
  const { workspace } = useAgentStoreContext();
  const [level, setLevel] = useState('off');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const MAX_ATTEMPTS = 20;
      const RETRY_DELAY = 400;
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt++) {
        try {
          const state = (await pi.getState(workspace)) as RpcSessionState;
          if (cancelled) return;
          if (state?.thinkingLevel) setLevel(state.thinkingLevel);
          setReady(true);
          return;
        } catch {
          // workspace 尚未 open，与 ModelAction 同样的启动竞态
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  const onChange = (next: string) => {
    setLevel(next);
    void pi.setThinkingLevel(workspace, next);
  };

  return (
    <Select
      size="small"
      popupMatchSelectWidth={false}
      disabled={!ready}
      value={level}
      options={OPTIONS}
      placeholder="推理"
      onChange={onChange}
    />
  );
}
