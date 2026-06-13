import { useEffect, useState } from 'react';
import { ActionIcon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const TITLE_BAR_HEIGHT = 38;

const appWindow = getCurrentWindow();

const useStyles = createStyles(({ token, css }) => ({
  bar: css`
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;

    height: ${TITLE_BAR_HEIGHT}px;
    padding-inline: 12px;
    border-block-end: 1px solid ${token.colorBorderSecondary};

    background: ${token.colorBgContainer};
    user-select: none;
  `,
  title: css`
    /* Let clicks fall through to the drag-region parent so the brand area is draggable. */
    pointer-events: none;

    font-size: 13px;
    font-weight: 700;
    color: ${token.colorText};
  `,
  controls: css`
    display: flex;
    gap: 4px;
    align-items: center;
  `,
  control: css`
    border-radius: 8px;
    color: ${token.colorTextSecondary};

    &:hover {
      color: ${token.colorText};
      background: ${token.colorFillTertiary};
    }
  `,
  close: css`
    border-radius: 8px;
    color: ${token.colorTextSecondary};

    &:hover {
      color: ${token.colorBgBase};
      background: ${token.colorError};
    }
  `,
}));

export function Titlebar() {
  const { styles } = useStyles();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void appWindow.isMaximized().then(setMaximized);
    void appWindow
      .onResized(() => {
        void appWindow.isMaximized().then(setMaximized);
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  return (
    <div data-tauri-drag-region className={styles.bar}>
      <span data-tauri-drag-region className={styles.title}>
        Hermes
      </span>
      <div className={styles.controls}>
        <ActionIcon
          icon={Minus}
          size={{ blockSize: 28, size: 14 }}
          title="最小化"
          className={styles.control}
          onClick={() => void appWindow.minimize()}
        />
        <ActionIcon
          icon={maximized ? Minimize2 : Maximize2}
          size={{ blockSize: 28, size: 14 }}
          title={maximized ? '还原' : '最大化'}
          className={styles.control}
          onClick={async () => {
            await appWindow.toggleMaximize();
            setMaximized(await appWindow.isMaximized());
          }}
        />
        <ActionIcon
          icon={X}
          size={{ blockSize: 28, size: 14 }}
          title="关闭"
          className={styles.close}
          onClick={() => void appWindow.close()}
        />
      </div>
    </div>
  );
}
