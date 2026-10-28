import { createWorkspace, migrateV1, validateWorkspace } from "./model.ts";
import type { Workspace } from "./types.ts";
import { syncRewards } from "./rank.ts";
export const dataMode =
  import.meta.env.VITE_DATA_MODE === "api" ? "api" : "demo";
const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const key = "dotodo.workspace.v2";
let revision: number | null = null;
let loadedSnapshot: string | null = null;
export class ConflictError extends Error {}
async function request(path: string, options?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new Error(
      "서버에 연결할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요."
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 409)
      throw new ConflictError(
        "다른 창에서 데이터가 변경됐어요. 새로 불러온 후 다시 시도해 주세요."
      );
    throw new Error(
      body?.message || "저장하지 못했어요. 잠시 후 다시 시도해 주세요."
    );
  }
  return response.json();
}
export const workspaceApi = {
  async load(): Promise<Workspace> {
    if (dataMode === "api") {
      const result = await request("/workspace");
      revision = result.revision;
      return syncRewards(validateWorkspace(result.data));
    }
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      const state = validateWorkspace(JSON.parse(saved));
      loadedSnapshot = saved;
      return syncRewards(state);
    }
    const legacy = localStorage.getItem("dotodo.todos.v1");
    const state = legacy ? migrateV1(JSON.parse(legacy)) : createWorkspace();
    loadedSnapshot = JSON.stringify(state);
    localStorage.setItem(key, loadedSnapshot);
    return syncRewards(state);
  },
  async save(state: Workspace): Promise<void> {
    validateWorkspace(state);
    if (dataMode === "api") {
      const result = await request("/workspace", {
        method: "PUT",
        body: JSON.stringify({ revision, data: state }),
      });
      revision = result.revision;
    } else {
      if (localStorage.getItem(key) !== loadedSnapshot)
        throw new ConflictError(
          "다른 창에서 데이터가 변경됐어요. 새로 불러온 후 다시 시도해 주세요."
        );
      const serialized = JSON.stringify(state);
      localStorage.setItem(key, serialized);
      loadedSnapshot = serialized;
    }
  },
};
