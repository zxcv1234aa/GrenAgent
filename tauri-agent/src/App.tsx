import { useEffect } from 'react';
import { ThemeProvider, ActionIcon, Flexbox } from '@lobehub/ui';
import { Moon, PanelLeftOpen, PanelRightOpen, SquareTerminal, Sun } from 'lucide-react';
import { PanelHeader } from './components/PanelHeader';
import { ThemeBridge } from './components/ThemeBridge';
import { useThemeStore } from './stores/themeStore';
import { ChatView } from './features/chat/ChatView';
import { SessionList } from './features/sessions/SessionList';
import { RightPanel } from './features/panels';
import { TerminalPanel } from './features/terminal/TerminalPanel';
import { ResizeHandle } from './components/ResizeHandle';
import { Titlebar } from './components/Titlebar';
import { AgentStoreProvider, useAgentStoreContext } from './stores/AgentStoreContext';
import { useSessionStore } from './store';
import {
  useLayoutStore,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  TERMINAL_MIN_HEIGHT,
  TERMINAL_MAX_HEIGHT,
} from './stores/layoutStore';
import { pi } from './lib/pi';

// 暂以当前目录为单一工作区。后续可接入工作区选择/审批流程。
const WORKSPACE = '.';

/** 拉取并刷新会话列表。 */
async function refreshSessions(workspace: string): Promise<void> {
  const { setSessions, setActiveSession, setError } = useSessionStore.getState();
  try {
    const sessions = await pi.listSessions(workspace);
    setSessions(sessions);
    const active = useSessionStore.getState().activeSessionPath;
    if (!active && sessions.length > 0) {
      setActiveSession(sessions[0].path);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  }
}

function Workspace() {
  const { store } = useAgentStoreContext();

  const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);
  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);

  const rightPanelOpen = useLayoutStore((s) => s.rightPanelOpen);
  const rightPanelWidth = useLayoutStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useLayoutStore((s) => s.setRightPanelWidth);
  const toggleRightPanel = useLayoutStore((s) => s.toggleRightPanel);

  const terminalOpen = useLayoutStore((s) => s.terminalOpen);
  const terminalHeight = useLayoutStore((s) => s.terminalHeight);
  const setTerminalHeight = useLayoutStore((s) => s.setTerminalHeight);
  const toggleTerminal = useLayoutStore((s) => s.toggleTerminal);

  const appearance = useThemeStore((s) => s.appearance);
  const toggleAppearance = useThemeStore((s) => s.toggleAppearance);

  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  const handleCreateSession = async () => {
    await pi.newSession(WORKSPACE);
    store.reset();
    await refreshSessions(WORKSPACE);
  };

  const handleSwitchSession = async (path: string) => {
    setActiveSession(path);
    await pi.switchSession(WORKSPACE, path);
    const { messages } = await pi.getMessages(WORKSPACE);
    store.loadMessages(messages, { force: true });
  };

  const handleDeleteSession = async (path: string) => {
    await pi.deleteSession(WORKSPACE, path);
    const active = useSessionStore.getState().activeSessionPath;
    if (active === path) {
      useSessionStore.getState().setActiveSession('');
    }
    await refreshSessions(WORKSPACE);
  };

  return (
    <Flexbox style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Titlebar />
      {/* 根容器：Sidebar | 右容器 */}
      <Flexbox horizontal flex={1} style={{ minHeight: 0 }}>
        {/* Sidebar：始终挂载，靠 DraggablePanel 的 expand 做收起/展开动画 */}
        <ResizeHandle
          placement="left"
          defaultSize={sidebarWidth}
          minSize={SIDEBAR_MIN_WIDTH}
          maxSize={SIDEBAR_MAX_WIDTH}
          onResize={setSidebarWidth}
          expand={sidebarOpen}
          onExpandChange={toggleSidebar}
        >
          <SessionList
            onCreateSession={handleCreateSession}
            onSwitchSession={handleSwitchSession}
            onDeleteSession={handleDeleteSession}
            onToggleSidebar={toggleSidebar}
          />
        </ResizeHandle>

      {/* 右容器：上部(Main+Right) / Terminal 竖向分割 */}
      <Flexbox flex={1} style={{ minWidth: 0, height: '100%' }}>
        {/* 上部：Main / RightPanel 横向分割 */}
        <Flexbox horizontal flex={1} style={{ minHeight: 0 }}>
          {/* 主列：Header + Chat */}
          <Flexbox flex={1} style={{ minWidth: 0, height: '100%' }}>
            <PanelHeader
              left={
                !sidebarOpen ? (
                  <ActionIcon icon={PanelLeftOpen} title="Sidebar" onClick={toggleSidebar} />
                ) : undefined
              }
              actions={
                <>
                  {/* 主题：亮/暗切换 */}
                  <ActionIcon
                    icon={appearance === 'dark' ? Sun : Moon}
                    title={appearance === 'dark' ? 'Light mode' : 'Dark mode'}
                    onClick={toggleAppearance}
                  />
                  {/* 终端：顶部常驻 toggle（active 表示已打开），点击切换收起/展开 */}
                  <ActionIcon
                    icon={SquareTerminal}
                    active={terminalOpen}
                    title="Terminal"
                    onClick={toggleTerminal}
                  />
                  {/* 右面板：仅折叠时显示打开按钮，展开后由面板内折叠图标收起（对齐左侧栏） */}
                  {!rightPanelOpen && (
                    <ActionIcon icon={PanelRightOpen} title="Panel" onClick={toggleRightPanel} />
                  )}
                </>
              }
            />
            <Flexbox flex={1} style={{ minHeight: 0, position: 'relative' }}>
              <ChatView />
            </Flexbox>
          </Flexbox>

          {/* Right Panel：始终挂载，靠 DraggablePanel 的 expand 做收起/展开动画 */}
          <ResizeHandle
            placement="right"
            defaultSize={rightPanelWidth}
            minSize={RIGHT_PANEL_MIN_WIDTH}
            maxSize={RIGHT_PANEL_MAX_WIDTH}
            onResize={setRightPanelWidth}
            expand={rightPanelOpen}
            onExpandChange={toggleRightPanel}
          >
            <RightPanel onCollapse={toggleRightPanel} />
          </ResizeHandle>
        </Flexbox>

        {/* Terminal（仅在 Main+Right 下方）：始终挂载，靠 DraggablePanel 的 expand 做收起/展开动画 */}
        <ResizeHandle
          placement="bottom"
          defaultSize={terminalHeight}
          minSize={TERMINAL_MIN_HEIGHT}
          maxSize={TERMINAL_MAX_HEIGHT}
          onResize={setTerminalHeight}
          expand={terminalOpen}
          onExpandChange={toggleTerminal}
        >
          <TerminalPanel />
        </ResizeHandle>
      </Flexbox>
      </Flexbox>
    </Flexbox>
  );
}

export default function App() {
  useEffect(() => {
    let active = true;
    pi.openWorkspace(WORKSPACE)
      .then(() => {
        if (active) void refreshSessions(WORKSPACE);
      })
      .catch((err) => {
        useSessionStore.getState().setError(
          err instanceof Error ? err.message : String(err),
        );
      });

    return () => {
      active = false;
      void pi.closeWorkspace(WORKSPACE);
    };
  }, []);

  const appearance = useThemeStore((s) => s.appearance);

  return (
    <ThemeProvider themeMode={appearance}>
      <ThemeBridge />
      <AgentStoreProvider workspace={WORKSPACE}>
        <Workspace />
      </AgentStoreProvider>
    </ThemeProvider>
  );
}
