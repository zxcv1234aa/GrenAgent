import { useEffect } from 'react';
import { useTheme } from 'antd-style';

/**
 * 把 lobe-ui 当前主题的 colorBgLayout 同步到 body 背景,
 * 避免窗口边缘/滚动回弹露出浏览器默认白底 (亮/暗切换时尤其明显)。
 * 直接读 antd 实际 token, 因此与 lobe 默认主题完全一致, 自身不渲染任何 DOM。
 */
export function ThemeBridge() {
  const theme = useTheme();

  useEffect(() => {
    document.documentElement.dataset.theme = theme.appearance;
    document.body.style.background = theme.colorBgLayout;
  }, [theme]);

  return null;
}
