import { Button, Flexbox } from '@lobehub/ui';
import { Select, Switch } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { Hammer, Play, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { codeIntelInit, codeIntelReindex, codeIntelStatus, codeIntelSync } from '../../lib/codeIntelIo';
import { useAgentStoreContext } from '../../stores/AgentStoreContext';
import { ModelSelectField } from '../settings/ModelSelectField';
import { userConfiguredCodegraph } from './codeIntelYield';

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const styles = createStaticStyles(({ css }) => ({
  section: css`
    margin-block-end: 22px;
  `,
  secTitle: css`
    margin-block-end: 10px;
    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    margin-block-end: 8px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    background: ${cssVar.colorBgContainer};
  `,
  rowLabel: css`
    font-size: 13px;
    color: ${cssVar.colorText};
  `,
  rowDesc: css`
    margin-block-start: 2px;
    font-size: 11px;
    color: ${cssVar.colorTextTertiary};
  `,
  badge: css`
    padding: 1px 8px;
    border-radius: 999px;
    background: ${cssVar.colorFillSecondary};
    color: ${cssVar.colorTextSecondary};
    font-size: 11px;
  `,
  badgeYield: css`
    background: ${cssVar.colorWarningBg};
    color: ${cssVar.colorWarning};
  `,
  status: css`
    padding: 10px 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    background: ${cssVar.colorFillQuaternary};
    font-family: ${mono};
    font-size: 11px;
    white-space: pre-wrap;
    color: ${cssVar.colorTextSecondary};
    max-height: 220px;
    overflow: auto;
  `,
}));

interface CodeIntelTabProps {
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  /** 标记有改动（触发自动存盘 + 重启生效提示）。 */
  onChange: () => void;
  /** 当前已连 MCP 工具名（用于让位徽标，来自 tools cache 汇总）。 */
  knownToolNames: string[];
}

const ENGINE_OPTIONS = [
  { value: 'codegraph', label: 'CodeGraph（内置，默认）' },
  { value: 'gitnexus', label: 'GitNexus（opt-in，Phase 4）' },
  { value: 'off', label: '关闭' },
];

export function CodeIntelTab({ values, setValue, onChange, knownToolNames }: CodeIntelTabProps) {
  const { workspace } = useAgentStoreContext();
  const engine = values.CODE_INTEL ?? 'codegraph';
  const autoInit = (values.CODE_INTEL_AUTO_INIT ?? '1') !== '0';
  const explorerOn = (values.CODE_INTEL_EXPLORER ?? '1') !== '0';
  const yielded = userConfiguredCodegraph(values.MCP_SERVERS ?? '', knownToolNames);

  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);

  const refreshStatus = async () => {
    setBusy('status');
    try {
      setStatus(await codeIntelStatus(workspace));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  const run = async (kind: 'init' | 'sync' | 'reindex') => {
    setBusy(kind);
    try {
      const fn = kind === 'init' ? codeIntelInit : kind === 'sync' ? codeIntelSync : codeIntelReindex;
      setStatus(await fn(workspace));
      await refreshStatus();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const setEngine = (v: string) => {
    setValue('CODE_INTEL', v);
    onChange();
  };
  const toggleAutoInit = (on: boolean) => {
    setValue('CODE_INTEL_AUTO_INIT', on ? '1' : '0');
    onChange();
  };
  const toggleExplorer = (on: boolean) => {
    setValue('CODE_INTEL_EXPLORER', on ? '1' : '0');
    onChange();
  };
  const setExplorerModel = (v: string) => {
    setValue('CODE_INTEL_EXPLORER_MODEL', v);
    onChange();
  };

  return (
    <div data-testid="code-intel-tab">
      <div className={styles.section}>
        <div className={styles.secTitle}>引擎</div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>代码图谱引擎</div>
            <div className={styles.rowDesc}>CodeGraph 为内置离线引擎；切换经热更新生效</div>
          </div>
          <Flexbox horizontal align="center" gap={8}>
            <span className={`${styles.badge} ${yielded ? styles.badgeYield : ''}`} data-testid="code-intel-badge">
              {yielded ? '已检测到自配 codegraph，内置让位' : '内置 (bundled)'}
            </span>
            <Select
              data-testid="code-intel-engine"
              size="small"
              value={engine}
              options={ENGINE_OPTIONS}
              style={{ minWidth: 200 }}
              onChange={setEngine}
            />
          </Flexbox>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.secTitle}>索引（当前 workspace）</div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>打开 workspace 时自动初始化</div>
            <div className={styles.rowDesc}>无 .codegraph 时后台自动 init（CODE_INTEL_AUTO_INIT）</div>
          </div>
          <Switch size="small" checked={autoInit} data-testid="code-intel-autoinit" onChange={toggleAutoInit} />
        </div>
        <Flexbox horizontal align="center" gap={8} style={{ marginBlockEnd: 10 }}>
          <Button size="small" icon={<Play size={14} />} loading={busy === 'init'} data-testid="code-intel-init" onClick={() => void run('init')}>
            初始化
          </Button>
          <Button size="small" icon={<RotateCw size={14} />} loading={busy === 'sync'} data-testid="code-intel-sync" onClick={() => void run('sync')}>
            手动同步
          </Button>
          <Button size="small" icon={<Hammer size={14} />} loading={busy === 'reindex'} data-testid="code-intel-reindex" onClick={() => void run('reindex')}>
            重建
          </Button>
          <Button size="small" loading={busy === 'status'} data-testid="code-intel-refresh" onClick={() => void refreshStatus()}>
            刷新状态
          </Button>
        </Flexbox>
        <div className={styles.status} data-testid="code-intel-status">
          {status || '（点「刷新状态」查看索引统计）'}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.secTitle}>探索子代理</div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>启用 explore_context</div>
            <div className={styles.rowDesc}>只读探索子代理；关闭后该工具不再注册（需重启生效）</div>
          </div>
          <Switch size="small" checked={explorerOn} data-testid="code-intel-explorer" onChange={toggleExplorer} />
        </div>
        <div className={styles.row}>
          <div>
            <div className={styles.rowLabel}>探索模型</div>
            <div className={styles.rowDesc}>留空＝子代理便宜模型（SUBAGENT_MODEL_CHEAP）</div>
          </div>
          <ModelSelectField
            value={values.CODE_INTEL_EXPLORER_MODEL ?? ''}
            placeholder="如 deepseek/deepseek-chat"
            testId="code-intel-explorer-model"
            onChange={setExplorerModel}
          />
        </div>
      </div>
    </div>
  );
}
