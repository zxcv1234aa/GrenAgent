import { useEffect } from 'react';
import { ThemeProvider, Header, ActionIcon } from '@lobehub/ui';
import { PanelLeft, PanelRight, SquareTerminal } from 'lucide-react';
import { ChatView } from './features/chat/ChatView';
import { SessionList } from './features/sessions/SessionList';
import { ContextPanel } from './features/context/ContextPanel';
import { DockPanel } from './features/dock/DockPanel';
import { AgentStoreProvider, useAgentStoreContext } from './stores/AgentStoreContext';
import { useSessionStore } from './store';
import { useUIStore } from './store/ui';
import { useAppStyles } from './theme';
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
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const contextOpen = useUIStore((s) => s.contextOpen);
  const terminalOpen = useUIStore((s) => s.terminalOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleContext = useUIStore((s) => s.toggleContext);
  const toggleTerminal = useUIStore((s) => s.toggleTerminal);

  const { styles } = useAppStyles({ sidebarOpen, contextOpen });
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
    <div className={styles.appShell}>
      {sidebarOpen && (
        <aside className={styles.appSessions}>
          <SessionList
            onCreateSession={handleCreateSession}
            onSwitchSession={handleSwitchSession}
            onDeleteSession={handleDeleteSession}
          />
        </aside>
      )}

      <div className={styles.appMain}>
        <Header
          logo={<span style={{ fontWeight: 700, fontSize: 16 }}>Hermes</span>}
          actions={
            <>
              <ActionIcon
                icon={SquareTerminal}
                active={terminalOpen}
                title="Terminal"
                onClick={toggleTerminal}
              />
              <ActionIcon
                icon={PanelRight}
                active={contextOpen}
                title="Context"
                onClick={toggleContext}
              />
              <ActionIcon
                icon={PanelLeft}
                active={sidebarOpen}
                title="Sidebar"
                onClick={toggleSidebar}
              />
            </>
          }
        />

        <div className={styles.appChat}>
          <ChatView />
        </div>
      </div>

      {contextOpen && (
        <aside className={styles.appContext}>
          <ContextPanel />
        </aside>
      )}

      {terminalOpen && <DockPanel />}
    </div>
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

  return (
    <ThemeProvider themeMode="dark">
      <AgentStoreProvider workspace={WORKSPACE}>
        <Workspace />
      </AgentStoreProvider>
    </ThemeProvider>
  );
}
