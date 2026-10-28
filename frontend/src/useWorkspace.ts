import { useCallback, useEffect, useRef, useState } from "react";
import { ConflictError, dataMode, workspaceApi } from "./api";
import { remainingSeconds, uid } from "./model";
import type { Workspace } from "./types";
import { rankProfile, syncRewards } from "./rank";

export type Commit = (
  change: (current: Workspace) => Workspace,
  message?: string
) => Promise<boolean>;
export default function useWorkspace() {
  const [state, setState] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef<Workspace | null>(null);
  const saving = useRef(false);
  const load = useCallback(async () => {
    try {
      const next = await workspaceApi.load();
      latest.current = next;
      setState(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없어요.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const commit: Commit = useCallback(async (change, message) => {
    if (!latest.current || saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const before = rankProfile(latest.current);
      const next = syncRewards(change(latest.current));
      await workspaceApi.save(next);
      latest.current = next;
      setState(next);
      const after = rankProfile(next);
      const delta = after.xp - before.xp;
      if (after.label !== before.label && delta > 0)
        setNotice(`${after.label} 승급! +${delta} XP`);
      else if (delta !== 0)
        setNotice(
          `${message || "성장 기록이 반영됐어요"} · ${
            delta > 0 ? "+" : ""
          }${delta} XP`
        );
      else if (message) setNotice(message);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "변경사항을 저장하지 못했어요."
      );
      if (e instanceof ConflictError)
        setNotice("새로 불러오기 버튼으로 최신 데이터를 확인해 주세요.");
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const timer = setInterval(() => {
      const current = latest.current;
      if (
        !current ||
        !current.timer.endAt ||
        remainingSeconds(current.timer) > 0 ||
        saving.current
      )
        return;
      void commit(
        (w) => {
          const focus = w.timer.mode === "focus";
          const duration =
            (focus ? w.settings.breakMinutes : w.settings.focusMinutes) * 60;
          return {
            ...w,
            sessions: focus
              ? [
                  ...w.sessions,
                  {
                    id: uid(),
                    taskId: w.timer.taskId,
                    title:
                      w.tasks.find((t) => t.id === w.timer.taskId)?.title ||
                      "자유 집중",
                    minutes: w.timer.duration / 60,
                    completedAt: new Date().toISOString(),
                  },
                ]
              : w.sessions,
            timer: {
              ...w.timer,
              mode: focus ? "break" : "focus",
              endAt: null,
              remaining: duration,
              duration,
            },
          };
        },
        current.timer.mode === "focus"
          ? "집중을 완료했어요. 잠깐 쉬어갈까요?"
          : "휴식이 끝났어요. 다시 시작해 볼까요?"
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [commit]);
  useEffect(() => {
    if (dataMode !== "demo") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === "dotodo.workspace.v2" && !saving.current) {
        setNotice("다른 창의 변경사항이 있어요. 최신 데이터를 불러와 주세요.");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return { state, error, notice, busy, commit, load, setNotice, setError };
}
