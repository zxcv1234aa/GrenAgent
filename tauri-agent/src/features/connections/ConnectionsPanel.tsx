import { Flexbox } from '@lobehub/ui';
import { useSettingsForm } from '../settings/useSettingsForm';
import { CONNECTION_FIELDS } from '../settings/settingsSchema';

const muted = 'var(--gren-fg-muted, #9aa1ac)';
const border = '1px solid var(--gren-border, rgba(255,255,255,0.08))';

const PLATFORMS = [
  { name: 'Slack', hint: '用 Slack Events API/Bolt 适配器把消息 POST 到网关 /message，回复回 replyUrl。' },
  { name: '飞书 / Feishu', hint: '用飞书机器人回调把消息转发到网关 /message。' },
  { name: 'Telegram', hint: '用 Telegram Bot webhook 把消息转发到网关 /message。' },
];

export function ConnectionsPanel() {
  const { values, setValue, save, saving, loading, error } = useSettingsForm();

  return (
    <Flexbox
      data-testid="connections-panel"
      style={{ height: '100%', minHeight: 0, overflowY: 'auto' }}
    >
      <Flexbox
        horizontal
        align="center"
        justify="space-between"
        style={{ padding: '10px 14px', borderBottom: border, flex: '0 0 auto' }}
      >
        <span style={{ fontSize: 13 }}>{loading ? '加载中…' : 'IM 网关（保存后重启生效）'}</span>
        <button
          data-testid="conn-save"
          onClick={() => void save()}
          disabled={saving}
          style={{
            padding: '4px 14px',
            borderRadius: 6,
            border,
            cursor: 'pointer',
            background: 'var(--gren-rail-active, rgba(255,255,255,0.08))',
            color: 'inherit',
            fontSize: 12,
          }}
        >
          {saving ? '保存中…' : '保存并重启'}
        </button>
      </Flexbox>
      {error && <div style={{ padding: '6px 14px', fontSize: 12, color: '#f87171' }}>{error}</div>}

      <div style={{ padding: 16, maxWidth: 560 }}>
        {CONNECTION_FIELDS.map((f) => (
          <Flexbox key={f.key} gap={4} style={{ marginBlockEnd: 12 }}>
            <span style={{ fontSize: 12, color: muted }}>{f.label}</span>
            <input
              data-testid={`conn-field-${f.key}`}
              value={values[f.key] ?? ''}
              placeholder={f.placeholder}
              type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
              onChange={(e) => setValue(f.key, e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: 6,
                border,
                background: 'transparent',
                color: 'inherit',
                fontSize: 13,
              }}
            />
          </Flexbox>
        ))}

        <div style={{ marginBlockStart: 8, fontSize: 13, fontWeight: 600 }}>平台接入</div>
        <div style={{ fontSize: 12, color: muted, marginBlockEnd: 8 }}>
          网关监听 <code>POST /message {'{ text, replyUrl? }'}</code>，回复回 replyUrl。
        </div>
        {PLATFORMS.map((p) => (
          <Flexbox key={p.name} gap={2} style={{ marginBlockEnd: 10 }}>
            <span style={{ fontSize: 13 }}>{p.name}</span>
            <span style={{ fontSize: 12, color: muted }}>{p.hint}</span>
          </Flexbox>
        ))}
      </div>
    </Flexbox>
  );
}
