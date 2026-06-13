import { Input } from 'antd';
import { Icon } from '@lobehub/ui';
import { Search } from 'lucide-react';
import { useSessionStore } from '../../store/session';

export function SearchBox() {
  const keyword = useSessionStore((s) => s.searchKeyword);
  const setKeyword = useSessionStore((s) => s.setSearchKeyword);
  return (
    <Input
      allowClear
      autoFocus
      size="small"
      placeholder="搜索会话 / 项目"
      prefix={<Icon icon={Search} size="small" />}
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
      style={{ margin: '0 8px 4px', width: 'calc(100% - 16px)' }}
    />
  );
}
