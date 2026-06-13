import { Flexbox } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';

/** 所有面板顶部 header 的统一高度，与 @lobehub/ui <Header> 默认值对齐。 */
export const HEADER_HEIGHT = 64;

const useStyles = createStyles(({ token, css }) => ({
  bar: css`
    flex: 0 0 auto;
    height: ${HEADER_HEIGHT}px;
    padding-inline: 12px;
    border-block-end: 1px solid ${token.colorBorderSecondary};
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
}));

interface PanelHeaderProps {
  /** 左侧内容（如折叠/展开按钮），显示在标题之前。 */
  left?: ReactNode;
  /** 标题；传入 string 时套用统一标题样式。 */
  title?: ReactNode;
  /** 右侧操作区图标。 */
  actions?: ReactNode;
}

/** 左栏/主列/右栏共用的面板头部：统一高度、内边距、底边框与图标间距。 */
export function PanelHeader({ left, title, actions }: PanelHeaderProps) {
  const { styles } = useStyles();

  return (
    <Flexbox horizontal align="center" distribution="space-between" className={styles.bar}>
      <Flexbox horizontal align="center" gap={8}>
        {left}
        {typeof title === 'string' ? <span className={styles.title}>{title}</span> : title}
      </Flexbox>
      {actions != null && (
        <Flexbox horizontal align="center" gap={4}>
          {actions}
        </Flexbox>
      )}
    </Flexbox>
  );
}
