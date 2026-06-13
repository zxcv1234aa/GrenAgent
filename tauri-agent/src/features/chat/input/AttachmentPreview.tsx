import { ActionIcon, Flexbox } from '@lobehub/ui';
import { X } from 'lucide-react';
import { useChatInput } from './ChatInputContext';

export function AttachmentPreview() {
  const { attachments, removeAttachment } = useChatInput();
  if (attachments.length === 0) return null;
  return (
    <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
      {attachments.map((a, index) => (
        <div key={`${a.name}-${index}`} style={{ position: 'relative' }}>
          <img
            src={a.url}
            alt={a.name}
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, display: 'block' }}
          />
          <ActionIcon
            icon={X}
            size="small"
            title="移除"
            onClick={() => removeAttachment(index)}
            style={{ position: 'absolute', top: -8, right: -8 }}
          />
        </div>
      ))}
    </Flexbox>
  );
}
