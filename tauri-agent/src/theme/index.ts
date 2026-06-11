// src/theme/index.ts
import { createStyles } from 'antd-style';
import { semanticTokens } from './tokens';

interface AppStyleProps {
  sidebarOpen: boolean;
  contextOpen: boolean;
}

const SESSIONS_WIDTH = 240;
const CONTEXT_WIDTH = 280;

export const useAppStyles = createStyles(
  ({ token, css }, { sidebarOpen, contextOpen }: AppStyleProps) => {
    const cols = [
      sidebarOpen ? `${SESSIONS_WIDTH}px` : '0px',
      'minmax(0, 1fr)',
      contextOpen ? `${CONTEXT_WIDTH}px` : '0px',
    ].join(' ');

    return {
      appShell: css`
        display: grid;
        grid-template-columns: ${cols};
        height: 100vh;
        width: 100vw;
        overflow: hidden;
        background: ${token.colorBgLayout};
        transition: grid-template-columns 0.2s ease;
      `,

      appSessions: css`
        min-width: 0;
        height: 100%;
        overflow: hidden;
        border-right: 1px solid ${token.colorBorderSecondary};
        background: ${token.colorBgContainer};
      `,

      appMain: css`
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        background: ${token.colorBgLayout};
      `,

      appChat: css`
        flex: 1;
        min-height: 0;
        overflow: hidden;
        position: relative;
      `,

      dockPanel: css`
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 200px;
        z-index: 10;
        background: ${token.colorBgContainer};
        border-top: 1px solid ${token.colorBorderSecondary};
      `,

      appContext: css`
        min-width: 0;
        height: 100%;
        overflow: hidden;
        border-left: 1px solid ${token.colorBorderSecondary};
        background: ${token.colorBgContainer};
      `,
    };
  },
);

export { semanticTokens };
