import { useEffect, useState } from 'react';
import { Select } from '@lobehub/ui/base-ui';
import { useAgentStoreContext } from '../../../../stores/AgentStoreContext';
import { pi } from '../../../../lib/pi';
import { modelKey, parseModelKey, parseModels, type ModelInfo } from '../modelUtils';

interface RpcSessionState {
  model?: { id?: string; name?: string; provider?: string };
}

export default function ModelAction() {
  const { workspace } = useAgentStoreContext();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [value, setValue] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 启动初期 workspace 可能尚未 open（ModelAction 的子 effect 先于 App 的 openWorkspace effect 触发），
      // 此时 getAvailableModels 会以「workspace not open」失败。轮询重试直到拿到模型或超出上限，
      // 避免首次启动模型列表永久为空。
      const MAX_ATTEMPTS = 20;
      const RETRY_DELAY = 400;
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt++) {
        // 独立结算：getState 失败不应清空模型列表（否则下拉变「无模型可选」）
        const [modelsRes, stateRes] = await Promise.allSettled([
          pi.getAvailableModels(workspace),
          pi.getState(workspace),
        ]);
        if (cancelled) return;

        if (stateRes.status === 'fulfilled') {
          const model = (stateRes.value as RpcSessionState)?.model;
          if (model?.provider && model?.id) setValue(modelKey(model.provider, model.id));
        }

        if (modelsRes.status === 'fulfilled') {
          const parsed = parseModels(modelsRes.value);
          if (parsed.length > 0) {
            setModels(parsed);
            setFailed(false);
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
      if (!cancelled) setFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  const onChange = (key: string) => {
    const { provider, id } = parseModelKey(key);
    setValue(key);
    void pi.setModel(workspace, provider, id);
  };

  const options = models.map((m) => ({ label: m.name ?? m.id, value: modelKey(m.provider, m.id) }));

  return (
    <Select
      size="small"
      popupMatchSelectWidth={false}
      disabled={failed || options.length === 0}
      value={value || undefined}
      options={options}
      placeholder="模型"
      onChange={onChange}
    />
  );
}
