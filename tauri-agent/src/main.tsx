import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 窗口以 visible:false 启动；待 React 首帧（BrandLoading）绘制后再 show，
// 规避 WebView2 启动时的窗口级白屏。双 rAF 确保已完成首次绘制；
// setTimeout 作兜底，避免任何情况下 show 丢失导致窗口永不出现。
function revealWindow() {
  void getCurrentWindow()
    .show()
    .catch(() => {});
}
requestAnimationFrame(() => requestAnimationFrame(revealWindow));
setTimeout(revealWindow, 2000);
