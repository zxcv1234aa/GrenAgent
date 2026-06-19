// 历史桩迁移到 _shared/sandbox。此文件仅 re-export 以不破坏旧导入路径。
export type { SandboxAdapter, SandboxResult, SandboxSpec } from "../_shared/sandbox/index.js";
export { NoopSandbox, getSandbox } from "../_shared/sandbox/index.js";
