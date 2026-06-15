import { memo, useCallback } from 'react';
import { SessionItem } from './SessionItem';
import type { ConversationItem } from './useConversations';

interface ConversationRowProps {
  item: ConversationItem;
  active: boolean;
  running: boolean;
  editing: boolean;
  onOpen: (cwd: string, path: string) => void;
  onDelete: (cwd: string) => void;
  onSubmitRename: (cwd: string, path: string, name: string) => void;
  onRequestRename: (path: string) => void;
}

export const ConversationRow = memo(function ConversationRow({
  item,
  active,
  running,
  editing,
  onOpen,
  onDelete,
  onSubmitRename,
  onRequestRename,
}: ConversationRowProps) {
  const handleClick = useCallback(() => onOpen(item.cwd, item.sessionPath), [onOpen, item.cwd, item.sessionPath]);
  const handleDelete = useCallback(() => onDelete(item.cwd), [onDelete, item.cwd]);
  const handleRename = useCallback(
    (name: string) => onSubmitRename(item.cwd, item.sessionPath, name),
    [onSubmitRename, item.cwd, item.sessionPath],
  );
  const handleRequestRename = useCallback(() => onRequestRename(item.sessionPath), [onRequestRename, item.sessionPath]);
  const noop = useCallback(() => {}, []);

  return (
    <SessionItem
      title={item.name}
      active={active}
      running={running}
      pinned={false}
      editing={editing}
      onClick={handleClick}
      onPinToggle={noop}
      onRequestRename={handleRequestRename}
      onRename={handleRename}
      onDelete={handleDelete}
    />
  );
});
