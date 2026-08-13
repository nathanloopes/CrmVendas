import { useCallback, useEffect, useState } from "react";
import type { LeadFilterValues } from "@/components/leads/LeadFilters";

export interface SavedFilter {
  id: string;
  name: string;
  filters: LeadFilterValues;
}

const keyFor = (userId?: string) => `lead-saved-filters:${userId || "anon"}`;

export function useSavedLeadFilters(userId?: string) {
  const [items, setItems] = useState<SavedFilter[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(userId));
      setItems(raw ? (JSON.parse(raw) as SavedFilter[]) : []);
    } catch {
      setItems([]);
    }
  }, [userId]);

  const persist = useCallback((next: SavedFilter[]) => {
    setItems(next);
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, [userId]);

  const save = useCallback((name: string, filters: LeadFilterValues) => {
    const item: SavedFilter = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || "Sem nome",
      filters,
    };
    persist([...items, item]);
  }, [items, persist]);

  const remove = useCallback((id: string) => {
    persist(items.filter((i) => i.id !== id));
  }, [items, persist]);

  return { items, save, remove };
}
