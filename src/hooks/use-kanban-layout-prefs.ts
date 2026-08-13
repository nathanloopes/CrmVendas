import { useCallback, useEffect, useState } from "react";

export type KanbanDensity = "compact" | "comfortable";
export type KanbanColumnWidth = "narrow" | "default" | "wide";

export interface KanbanLayoutPrefs {
  density: KanbanDensity;
  columnWidth: KanbanColumnWidth;
  collapsedColumns: string[];
}

const DEFAULT: KanbanLayoutPrefs = {
  density: "comfortable",
  columnWidth: "default",
  collapsedColumns: [],
};

const KEY = (scope: string) => `kanban-layout-prefs:${scope}`;

export function useKanbanLayoutPrefs(scope: string = "global") {
  const [prefs, setPrefs] = useState<KanbanLayoutPrefs>(DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(scope));
      if (raw) setPrefs({ ...DEFAULT, ...JSON.parse(raw) });
      else setPrefs(DEFAULT);
    } catch {
      setPrefs(DEFAULT);
    }
  }, [scope]);

  const update = useCallback((patch: Partial<KanbanLayoutPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY(scope), JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, [scope]);

  const setDensity = useCallback((density: KanbanDensity) => update({ density }), [update]);
  const setColumnWidth = useCallback((columnWidth: KanbanColumnWidth) => update({ columnWidth }), [update]);
  const toggleCollapsed = useCallback((stage: string) => {
    setPrefs((prev) => {
      const exists = prev.collapsedColumns.includes(stage);
      const collapsedColumns = exists
        ? prev.collapsedColumns.filter((s) => s !== stage)
        : [...prev.collapsedColumns, stage];
      const next = { ...prev, collapsedColumns };
      try { localStorage.setItem(KEY(scope), JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, [scope]);

  return { prefs, setDensity, setColumnWidth, toggleCollapsed };
}

export const COLUMN_WIDTH_PX: Record<KanbanColumnWidth, number> = {
  narrow: 256,
  default: 320,
  wide: 384,
};
