import { useRef, type ChangeEvent } from 'react';
import { ActionIcon } from '@lobehub/ui';
import { ImagePlus } from 'lucide-react';
import { useChatInput, type ImageAttachment } from '../ChatInputContext';

/** 读图片为附件：data 为纯 base64（pi 要求），url 保留 dataURL 供预览。 */
function readImage(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const comma = url.indexOf(',');
      const data = comma >= 0 ? url.slice(comma + 1) : url;
      resolve({
        type: 'image',
        mimeType: file.type || 'image/png',
        data,
        name: file.name,
        url,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function UploadAction() {
  const { addAttachments } = useChatInput();
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      addAttachments(await Promise.all(files.map(readImage)));
    }
    e.target.value = '';
  };

  return (
    <>
      <ActionIcon
        icon={ImagePlus}
        size="small"
        title="添加图片"
        onClick={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={onChange}
      />
    </>
  );
}
