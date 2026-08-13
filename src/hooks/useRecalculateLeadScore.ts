import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Silently triggers a lead score recalculation for one or many leads.
 * - No toast, no UI block — fire-and-forget for great UX after stage changes
 *   or after a new transcription is confirmed.
 * - The DB trigger + cron worker (process-score-queue) is the source of truth;
 *   this hook just makes the new score appear faster in the UI.
 */
export function useRecalculateLeadScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadIds: string | string[]) => {
      const ids = Array.isArray(leadIds) ? leadIds : [leadIds];
      // Run in parallel; ignore individual failures (the DB queue will retry).
      await Promise.allSettled(
        ids.map((lead_id) =>
          supabase.functions.invoke("score-lead", { body: { lead_id } })
        )
      );
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      ids.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: ["lead-score", id] });
        queryClient.invalidateQueries({ queryKey: ["lead-detail", id] });
      });
    },
  });
}
