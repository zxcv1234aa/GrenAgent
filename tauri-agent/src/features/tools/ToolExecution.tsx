import { Collapse, Flexbox, Highlighter, Icon } from '@lobehub/ui';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useCardStyles } from './cardStyles';
import { StatusIndicator } from './StatusIndicator';
import {
  argSummary,
  extractText,
  getArgString,
  getDiff,
  langByPath,
  stringifyJson,
  toolMeta,
} from './toolUtils';

interface ToolExecutionProps {
  toolName: string;
  args: unknown;
  result: unknown;
  status: 'running' | 'done' | 'error';
}

function ToolInspector({
  toolName,
  args,
  status,
}: {
  toolName: string;
  args: unknown;
  status: ToolExecutionProps['status'];
}) {
  const { styles } = useCardStyles();
  const { icon } = toolMeta(toolName);
  const summary = argSummary(args);

  return (
    <Flexbox horizontal align="center" gap={6} style={{ minWidth: 0, flex: 1 }}>
      <StatusIndicator status={status} />
      <Icon icon={icon} size={14} />
      <div className={styles.inspectorTitle}>
        <span className={styles.toolName}>{toolName}</span>
        {summary && (
          <>
            <Icon icon={ChevronRight} size={12} style={{ marginInline: 4, verticalAlign: 'middle' }} />
            <span className={styles.paramKey}>(</span>
            <span className={styles.paramValue}>{summary}</span>
            <span className={styles.paramKey}>)</span>
          </>
        )}
      </div>
    </Flexbox>
  );
}

function TerminalOutput({ text, isError }: { text: string; isError?: boolean }) {
  const { styles, cx } = useCardStyles();
  if (!text) return null;
  return (
    <div className={cx(styles.terminalOutput, isError && styles.terminalOutputError)}>{text}</div>
  );
}

function ToolDetail({
  toolName,
  args,
  result,
  status,
}: {
  toolName: string;
  args: unknown;
  result: unknown;
  status: ToolExecutionProps['status'];
}) {
  const { styles } = useCardStyles();
  const name = toolName.toLowerCase();
  const text = extractText(result);
  const diff = getDiff(result);
  const isError = status === 'error';

  if (name === 'bash' || name === 'shell' || name === 'run_terminal_cmd') {
    const command = getArgString(args, 'command');
    return (
      <Flexbox gap={8}>
        {command && (
          <Highlighter language="bash" copyable variant="borderless" style={{ maxHeight: 200 }}>
            {command}
          </Highlighter>
        )}
        <TerminalOutput text={text} isError={isError} />
      </Flexbox>
    );
  }

  if (name === 'read' || name === 'read_file') {
    const path = getArgString(args, 'path');
    const lang = langByPath(path);
    return (
      <Flexbox gap={8}>
        {path && (
          <div className={styles.pathLabel}>
            {path}
          </div>
        )}
        {text ? (
          <Highlighter language={lang} copyable style={{ maxHeight: 320 }}>
            {text}
          </Highlighter>
        ) : (
          <TerminalOutput text={stringifyJson(result)} isError={isError} />
        )}
      </Flexbox>
    );
  }

  if (name === 'write' || name === 'write_file') {
    const path = getArgString(args, 'path');
    const content = getArgString(args, 'content') || text;
    const lang = langByPath(path);
    return (
      <Flexbox gap={8}>
        {path && (
          <div className={styles.pathLabel}>
            {path}
          </div>
        )}
        {content && (
          <Highlighter language={lang} copyable style={{ maxHeight: 320 }}>
            {content}
          </Highlighter>
        )}
      </Flexbox>
    );
  }

  if (name === 'edit' || name === 'search_replace' || name === 'str_replace') {
    const path = getArgString(args, 'path');
    if (diff) {
      return (
        <Flexbox gap={8}>
          {path && (
            <div className={styles.pathLabel}>
              {path}
            </div>
          )}
          <Highlighter language="diff" copyable style={{ maxHeight: 320 }}>
            {diff}
          </Highlighter>
        </Flexbox>
      );
    }
    const oldText = getArgString(args, 'oldText') || getArgString(args, 'old_string');
    const newText = getArgString(args, 'newText') || getArgString(args, 'new_string');
    return (
      <Flexbox gap={8}>
        {path && (
          <div className={styles.pathLabel}>
            {path}
          </div>
        )}
        {oldText && (
          <Highlighter language="diff" copyable style={{ maxHeight: 160 }}>
            {`- ${oldText}`}
          </Highlighter>
        )}
        {newText && (
          <Highlighter language="diff" copyable style={{ maxHeight: 160 }}>
            {`+ ${newText}`}
          </Highlighter>
        )}
        {!oldText && !newText && <TerminalOutput text={text || stringifyJson(result)} isError={isError} />}
      </Flexbox>
    );
  }

  if (name === 'glob' || name === 'grep' || name === 'ripgrep' || name === 'ls' || name === 'list_dir') {
    return <TerminalOutput text={text || stringifyJson(result)} isError={isError} />;
  }

  if (text) {
    return <TerminalOutput text={text} isError={isError} />;
  }

  const json = stringifyJson(result);
  if (!json) return null;
  return (
    <Highlighter language="json" copyable style={{ maxHeight: 300 }}>
      {json}
    </Highlighter>
  );
}

export function ToolExecution({ toolName, args, result, status }: ToolExecutionProps) {
  const { styles } = useCardStyles();
  const hasDetail = useMemo(() => {
    if (status === 'running') return true;
    return Boolean(extractText(result) || getDiff(result) || stringifyJson(result));
  }, [result, status]);

  if (!hasDetail && status !== 'running') {
    return (
      <Flexbox className={styles.toolRow} gap={4}>
        <ToolInspector toolName={toolName} args={args} status={status} />
      </Flexbox>
    );
  }

  return (
    <div className={styles.toolRow}>
      <Collapse
        variant="outlined"
        gap={4}
        items={[
          {
            key: 'tool',
            label: <ToolInspector toolName={toolName} args={args} status={status} />,
            children: <ToolDetail toolName={toolName} args={args} result={result} status={status} />,
          },
        ]}
      />
    </div>
  );
}
