// 进程内共享的审批策略（多扩展读同一份）。approval 扩展按 session 设置；
// safety / 沙箱消费者读取。默认 auto（替我审批）。
export type ApprovalPolicy = "ask" | "auto" | "full";

let current: ApprovalPolicy = "auto";

export function getApprovalPolicy(): ApprovalPolicy {
  return current;
}

export function setApprovalPolicy(p: ApprovalPolicy): void {
  current = p;
}

export function parseApproval(s: string | undefined): ApprovalPolicy | undefined {
  const v = (s ?? "").trim().toLowerCase();
  return v === "ask" || v === "auto" || v === "full" ? v : undefined;
}

export const APPROVAL_LABELS: Record<ApprovalPolicy, string> = {
  ask: "请求批准",
  auto: "替我审批",
  full: "完全访问",
};
