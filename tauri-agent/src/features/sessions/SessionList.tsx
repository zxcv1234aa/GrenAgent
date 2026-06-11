import { Flexbox, Text, List, ActionIcon, Empty, type ListItemProps } from '@lobehub/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useSessionStore } from '../../store';

interface SessionListProps {
  onCreateSession: () => Promise<void>;
  onSwitchSession: (path: string) => Promise<void>;
  onDeleteSession: (path: string) => Promise<void>;
}

function timestampToDate(timestamp: string | null): number | undefined {
  if (!timestamp) return undefined;
  const ms = new Date(timestamp).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

export function SessionList({ onCreateSession, onSwitchSession, onDeleteSession }: SessionListProps) {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionPath = useSessionStore((state) => state.activeSessionPath);

  const items: ListItemProps[] = sessions.map((session) => ({
    key: session.path,
    title: session.name || 'Untitled',
    date: timestampToDate(session.timestamp),
    actions: (
      <ActionIcon
        icon={Trash2}
        size="small"
        danger
        title="Delete"
        onClick={(e) => {
          e.stopPropagation();
          void onDeleteSession(session.path);
        }}
      />
    ),
  }));

  return (
    <Flexbox height="100%" style={{ minHeight: 0 }}>
      <Flexbox
        horizontal
        align="center"
        distribution="space-between"
        padding={12}
        flex="0 0 auto"
      >
        <Text strong>Sessions</Text>
        <ActionIcon icon={Plus} title="New Session" onClick={() => void onCreateSession()} />
      </Flexbox>

      <Flexbox flex={1} style={{ minHeight: 0, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <Empty description="No sessions" />
        ) : (
          <List
            items={items}
            activeKey={activeSessionPath ?? undefined}
            onClick={({ key }) => void onSwitchSession(key)}
          />
        )}
      </Flexbox>
    </Flexbox>
  );
}
