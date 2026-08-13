import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { LeadFilters, EMPTY_FILTERS, type LeadFilterValues } from "@/components/leads/LeadFilters";
import { useKanbanLayoutPrefs } from "@/hooks/use-kanban-layout-prefs";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { KanbanToolbar } from "@/components/leads/KanbanToolbar";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProspeccaoAtivaShell from "@/components/leads/prospeccao/ProspeccaoAtivaShell";
import TriagemPanel from "@/components/leads/triagem/TriagemPanel";

const DEFAULT_STAGES = [
  "dados-incompletos", "captação", "leads", "qualificação", "reagendamento",
  "material-reuniao", "standby", "reuniao-modulo-1", "reuniao-modulo-2",
  "reuniao-modulo-3", "contrato", "fechamento", "ganho", "perdido",
];

export default function Leads() {
  const { user, isAdmin } = useAuth();
  const [filtersReady, setFiltersReady] = useState(false);
  const [filters, setFilters] = useState<LeadFilterValues>(EMPTY_FILTERS);
  const [filteredCount, setFilteredCount] = useState<number>(0);
  const layout = useKanbanLayoutPrefs(user?.id || "global");

  useEffect(() => {
    if (user?.id && !filtersReady) {
      setFilters((prev) => ({ ...prev, assignedTo: user.id }));
      setFiltersReady(true);
    }
  }, [user?.id, filtersReady]);

  const [addOpen, setAddOpen] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "triagem" ? "triagem"
    : (searchParams.get("tab") === "prospeccao" || searchParams.get("openUnit")) ? "prospeccao" : "kanban";
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: boards = [] } = useQuery({
    queryKey: ["kanban-boards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_boards")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const activeBoardId = selectedBoardId || boards[0]?.id || null;
  const activeBoard = boards.find((b) => b.id === activeBoardId);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", activeBoardId],
    queryFn: async () => {
      // Slim select: only fields needed by Kanban board, cards and filters.
      // Full lead is fetched on-demand inside LeadDetailDialog children.
      let query = supabase
        .from("leads")
        .select(
          "id, name, phone, email, city, state, source, stage, board_id, " +
          "assigned_to, sdr_responsible_id, commercial_responsible_id, administrative_responsible_id, " +
          "lead_score, lost_reason, tags, " +
          "city_available, city_of_interest, state_of_interest, " +
          "last_contact, next_contact, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
        .range(0, 4999);
      if (activeBoardId) {
        query = query.eq("board_id", activeBoardId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Tables<"leads">[];
    },
    enabled: !!activeBoardId,
  });

  const stages = (activeBoard?.stage_order as string[]) || DEFAULT_STAGES;
  const customLabels = (activeBoard?.custom_labels as Record<string, string>) || {};

  const isKanban = activeTab === "kanban";

  return (
    <div className={isKanban ? "flex flex-col h-full w-full overflow-hidden" : "w-full"}>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className={isKanban ? "flex flex-col h-full" : "flex flex-col"}
      >
        <div className="shrink-0 px-1">
          <TabsList className="h-auto bg-transparent p-0 gap-1.5 rounded-none">
            <TabsTrigger
              value="kanban"
              className="rounded-md px-3.5 py-1.5 text-[13px] font-medium bg-muted text-muted-foreground border border-transparent shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-none"
            >
              Kanban
            </TabsTrigger>
            <TabsTrigger
              value="prospeccao"
              className="rounded-md px-3.5 py-1.5 text-[13px] font-medium bg-muted text-muted-foreground border border-transparent shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-none"
            >
              Prospecção Ativa
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="triagem"
                className="rounded-md px-3.5 py-1.5 text-[13px] font-medium bg-muted text-muted-foreground border border-transparent shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-none"
              >
                Triagem
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent
          value="kanban"
          className="flex-1 flex flex-col min-h-0 mt-2 data-[state=inactive]:hidden"
          forceMount
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="shrink-0 w-full overflow-hidden space-y-4 pb-4">
                <KanbanToolbar
                  boards={boards}
                  selectedBoardId={activeBoardId}
                  onSelectBoard={setSelectedBoardId}
                  onAddLead={() => setAddOpen(true)}
                  density={layout.prefs.density}
                  columnWidth={layout.prefs.columnWidth}
                  onDensityChange={layout.setDensity}
                  onColumnWidthChange={layout.setColumnWidth}
                />
                <LeadFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  currentUserId={user?.id || ""}
                  boardStages={stages}
                  customLabels={customLabels}
                  filteredCount={filteredCount}
                  totalCount={leads.length}
                />
              </div>
              <div className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto">
                <KanbanBoard
                  leads={leads}
                  stages={stages}
                  customLabels={customLabels}
                  filters={filters}
                  onFilteredCountChange={setFilteredCount}
                  density={layout.prefs.density}
                  columnWidth={layout.prefs.columnWidth}
                  collapsedColumns={layout.prefs.collapsedColumns}
                  onToggleColumnCollapsed={layout.toggleCollapsed}
                />
              </div>
              <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} boardId={activeBoardId} />
            </>
          )}
        </TabsContent>

        <TabsContent
          value="prospeccao"
          className="mt-2 px-1 data-[state=inactive]:hidden"
        >
          <ProspeccaoAtivaShell />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="triagem" className="mt-2 px-1 data-[state=inactive]:hidden">
            <TriagemPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
