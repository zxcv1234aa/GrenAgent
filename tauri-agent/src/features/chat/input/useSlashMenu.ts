import { useCallback, useRef, useState } from 'react';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { parseSlashContext, type SlashContext } from './slashMenuUtils';

function getTextAreaCursor(ref: React.RefObject<TextAreaRef | null>, fallback: number): number {
  const el = ref.current?.resizableTextArea?.textArea;
  return el?.selectionStart ?? fallback;
}

export function useSlashMenu(value: string, setValue: (next: string) => void) {
  const textareaRef = useRef<TextAreaRef>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [slashContext, setSlashContext] = useState<SlashContext | null>(null);

  const applyContext = useCallback((text: string, cursor: number) => {
    const ctx = parseSlashContext(text, cursor);
    if (ctx) {
      setSlashContext(ctx);
      setQuery(ctx.query);
      setOpen(true);
      return;
    }
    setSlashContext(null);
    setQuery('');
    setOpen(false);
  }, []);

  const syncFromTextarea = useCallback(
    (text: string) => {
      const cursor = getTextAreaCursor(textareaRef, text.length);
      applyContext(text, cursor);
    },
    [applyContext],
  );

  const handleInput = useCallback(
    (next: string) => {
      setValue(next);
      requestAnimationFrame(() => syncFromTextarea(next));
    },
    [setValue, syncFromTextarea],
  );

  const handleSelectionChange = useCallback(() => {
    syncFromTextarea(value);
  }, [value, syncFromTextarea]);

  const close = useCallback(() => {
    setOpen(false);
    setSlashContext(null);
    setQuery('');
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) close();
    },
    [close],
  );

  return {
    textareaRef,
    anchorRef,
    open,
    query,
    slashContext,
    close,
    handleInput,
    handleSelectionChange,
    handleOpenChange,
    slashMenuOpen: open,
  };
}
