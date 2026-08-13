import { supabase } from "@/integrations/supabase/client";

const LEAD_STAGE_HISTORY_CHUNK_SIZE = 50;

function chunkLeadIds(leadIds: string[]) {
  const ids = Array.from(new Set(leadIds.filter(Boolean)));
  const chunks: string[][] = [];

  for (let index = 0; index < ids.length; index += LEAD_STAGE_HISTORY_CHUNK_SIZE) {
    chunks.push(ids.slice(index, index + LEAD_STAGE_HISTORY_CHUNK_SIZE));
  }

  return chunks;
}

export async function fetchLatestLeadStageEntries(leadIds: string[]) {
  const chunks = chunkLeadIds(leadIds);

  if (chunks.length === 0) {
    return {} as Record<string, string>;
  }

  const responses = await Promise.all(
    chunks.map((leadIdChunk) =>
      supabase
        .from("lead_stage_history")
        .select("lead_id, changed_at")
        .in("lead_id", leadIdChunk)
        .order("changed_at", { ascending: false }),
    ),
  );

  const latestEntry: Record<string, string> = {};

  for (const { data, error } of responses) {
    if (error) throw error;

    data?.forEach((row) => {
      if (!latestEntry[row.lead_id]) {
        latestEntry[row.lead_id] = row.changed_at;
      }
    });
  }

  return latestEntry;
}