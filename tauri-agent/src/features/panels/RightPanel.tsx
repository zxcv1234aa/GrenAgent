import { ActionIcon, Flexbox } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { PanelRightClose } from 'lucide-react';

import { PanelHeader } from '../../components/PanelHeader';

const useStyles = createStyles(({ token, css }) => ({
  container: css`
    background: ${token.colorBgContainer};
    height: 100%;
  `,
  content: css`
    flex: 1;
    min-height: 0;
    padding: 16px;
    color: ${token.colorTextSecondary};
  `,
}));

interface RightPanelProps {
  /** 收起右面板（显示为 header 折叠图标）。 */
  onCollapse?: () => void;
}

export function RightPanel({ onCollapse }: RightPanelProps) {
  const { styles } = useStyles();

  return (
    <Flexbox className={styles.container}>
      <PanelHeader
        title="Panel"
        actions={
          onCollapse ? (
            <ActionIcon icon={PanelRightClose} title="Collapse panel" onClick={onCollapse} />
          ) : undefined
        }
      />
      <Flexbox className={styles.content}>
        <div>Right panel placeholder (tabs will be added in stage 4)</div>
      </Flexbox>
    </Flexbox>
  );
}
