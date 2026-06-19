import { Icon } from '@lobehub/ui';
import { Select } from '@lobehub/ui/base-ui';
import { Bot, Bug, ListChecks, MessageCircleQuestion, type LucideIcon } from 'lucide-react';
import { useAgentStoreContext } from '../../../../stores/AgentStoreContext';
import { pi } from '../../../../lib/pi';
import { AGENT_MODES, MODE_LABELS, useModeStore, type AgentMode } from '../../../../stores/modeStore';

/** 每个模式的 lucide 图标（统一经 @lobehub/ui 的 Icon 渲染，不用 emoji）。 */
const MODE_ICONS: Record<AgentMode, LucideIcon> = {
  agent: Bot,
  ask: MessageCircleQuestion,
  debug: Bug,
  plan: ListChecks,
};

/**
 * 模式选择器：Agent / Ask / Debug / Plan 互斥单选，每项带图标。
 * 当前模式由 sidecar 的 agent-mode 扩展经 setStatus 推送到 modeStore（切会话/刷新后回读）；
 * 切换走 agent_set_mode（底层 /mode 命令，不调 LLM），并乐观更新本地状态即时反馈。
 */
export default function ModeAction() {
  const { workspace, workspaceReady } = useAgentStoreContext();
  const mode = useModeStore((s) => s.byWorkspace[workspace] ?? 'agent');

  const onChange = (next: string) => {
    const target = next as AgentMode;
    // 乐观更新，避免等待后端 setStatus 回推的延迟；后端确认后会再推一次（值一致，无抖动）。
    useModeStore.getState().setMode(workspace, target);
    void pi.setMode(workspace, target);
  };

  // 紧凑图标按钮：触发器只显示当前模式图标（label 即图标，去掉 prefix 避免重复），
  // hover 出名字、下拉项仍是「图标 + 文字」（optionRender）。
  const options = AGENT_MODES.map((m) => ({ label: <Icon icon={MODE_ICONS[m]} size={14} />, value: m }));

  return (
    <span title={`模式：${MODE_LABELS[mode]}`} style={{ display: 'inline-flex' }}>
      <Select
        size="small"
        popupMatchSelectWidth={false}
        disabled={!workspaceReady}
        value={mode}
        options={options}
        optionRender={(option) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon icon={MODE_ICONS[option.value as AgentMode]} size={14} />
            {MODE_LABELS[option.value as AgentMode]}
          </span>
        )}
        placeholder="模式"
        style={{ width: 'auto' }}
        onChange={onChange}
      />
    </span>
  );
}
