import { TerminalPanel } from '../terminal/TerminalPanel';
import { useAppStyles } from '../../theme';

export function DockPanel() {
  const { styles } = useAppStyles({ sidebarOpen: false, contextOpen: false });

  return (
    <div className={styles.dockPanel}>
      <TerminalPanel />
    </div>
  );
}
