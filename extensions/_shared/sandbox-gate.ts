import { getApprovalPolicy } from "./approval.js";
import { getConfig } from "./runtime-config.js";
import { getSandbox } from "./sandbox/index.js";

// 沙箱可用性（与审批策略无关）：SANDBOX_ENABLE=off 总 kill，否则看 WSL2 是否就绪。
// 用于「不可信/显式」隔离场景：无主人微信会话、multi-agent 显式 sandbox 档——这些隔离
// 由场景本身要求，不应被 owner 个人的「完全访问」策略关掉。
export async function sandboxAvailable(): Promise<boolean> {
  if (getConfig("SANDBOX_ENABLE") === "off") return false;
  return (await getSandbox()).isAvailable();
}

// 策略感知判据：在「可用」之上再要求审批策略 != full。用于 owner 自己会话的执行
// （code-exec、safety 禁内置 bash）——owner 选「完全访问」即在宿主直跑、不隔离。
export async function sandboxOn(): Promise<boolean> {
  if (getApprovalPolicy() === "full") return false;
  return sandboxAvailable();
}
