import { Block, Tag, Highlighter, Collapse, Flexbox, Text } from '@lobehub/ui';

interface ToolExecutionProps {
  toolName: string;
  args: unknown;
  result: unknown;
  status: 'running' | 'done' | 'error';
}

const STATUS_COLOR: Record<ToolExecutionProps['status'], string> = {
  running: 'processing',
  done: 'success',
  error: 'error',
};

function stringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolExecution({ toolName, args, result, status }: ToolExecutionProps) {
  const argsText = stringify(args);
  const resultText = stringify(result);

  return (
    <Block variant="outlined" padding={12} gap={8}>
      <Flexbox horizontal align="center" distribution="space-between">
        <Text code strong>
          {toolName}
        </Text>
        <Tag color={STATUS_COLOR[status]}>{status}</Tag>
      </Flexbox>

      {argsText && (
        <Collapse
          variant="borderless"
          gap={4}
          items={[
            {
              key: 'args',
              label: 'Parameters',
              children: (
                <Highlighter language="json" copyable>
                  {argsText}
                </Highlighter>
              ),
            },
          ]}
        />
      )}

      {resultText && (
        <Flexbox gap={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Result
          </Text>
          <Highlighter language="json" copyable>
            {resultText}
          </Highlighter>
        </Flexbox>
      )}
    </Block>
  );
}
