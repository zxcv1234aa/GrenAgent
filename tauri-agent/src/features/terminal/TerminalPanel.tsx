import { useRef } from 'react';
import { Flexbox, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';

const useStyles = createStyles(({ token, css }) => ({
  header: css`
    padding: 6px 12px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgElevated};
  `,
  body: css`
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 8px 12px;
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    color: ${token.colorSuccessText};
    background: ${token.colorBgContainer};
  `,
}));

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { styles } = useStyles();

  // TODO: 集成 xterm.js（接 shell_start/shell_write/shell_stop）。

  return (
    <Flexbox height="100%" style={{ minHeight: 0 }}>
      <div className={styles.header}>
        <Text strong style={{ fontSize: 12 }}>
          Terminal
        </Text>
      </div>
      <div ref={terminalRef} className={styles.body}>
        $ Ready
      </div>
    </Flexbox>
  );
}
