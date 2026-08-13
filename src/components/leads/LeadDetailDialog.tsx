import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { LeadEditForm } from "./LeadEditForm";
import { LeadTimeline } from "./LeadTimeline";
import { LeadMaterials } from "./LeadMaterials";
import { LeadTasks } from "./LeadTasks";

import { LeadTranscription } from "./LeadTranscription";
import { LeadMeetings } from "./LeadMeetings";
import { LeadScore } from "./LeadScore";
import { LeadSummary } from "./LeadSummary";
import { DeleteLeadDialog } from "./DeleteLeadDialog";
import { User, MessageSquare, Paperclip, CheckSquare, Mic, Calendar, TrendingUp, Trash2, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isLostStage } from "@/lib/stage-utils";
import { getStageLabel } from "@/lib/stage-labels";

type Lead = Tables<"leads">;

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  stages?: string[];
  customLabels?: Record<string, any>;
  onStageChange?: (lead: Lead, newStage: string) => void;
}

export function LeadDetailDialog({ lead, open, onOpenChange, defaultTab = "dados", stages = [], customLabels = {}, onStageChange }: LeadDetailDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const dirtyRef = useRef(false);
  const formDataRef = useRef<Record<string, any> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [meetingTranscription, setMeetingTranscription] = useState<string>("");
  const [activeTab, setActiveTab] = useState(defaultTab);

  const { data: pendingTasksCount = 0 } = useQuery({
    queryKey: ["lead-pending-tasks-count", lead?.id],
    queryFn: async () => {
      if (!lead?.id) return 0;
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id)
        .neq("status", "completed");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!lead?.id,
  });

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleDirtyChange = useCallback((isDirty: boolean, formData: Record<string, any>) => {
    dirtyRef.current = isDirty;
    formDataRef.current = formData;
  }, []);

  const handleOpenChange = useCallback(async (nextOpen: boolean) => {
    if (!nextOpen && dirtyRef.current && formDataRef.current && lead) {
      const f = formDataRef.current;
      try {
        // Auto-resolve city_available from registry on save
        let resolvedCityAvailable: boolean | null = null;
        if (f.city_of_interest && f.state_of_interest) {
          const { data: cityRow } = await supabase
            .from("available_cities" as any)
            .select("status")
            .ilike("city", f.city_of_interest)
            .ilike("state", f.state_of_interest)
            .maybeSingle();
          if (cityRow) {
            resolvedCityAvailable = (cityRow as any).status === "available";
          }
        }

        const { error } = await supabase
          .from("leads")
          .update({
            name: f.name || null,
            phone: f.phone || null,
            email: f.email || null,
            city: f.city || null,
            state: f.state || null,
            state_of_interest: f.state_of_interest || null,
            city_of_interest: f.city_of_interest || null,
            source: f.source || null,
            interest: f.interest || null,
            investment: f.investment || null,
            lost_reason: f.lost_reason || null,
            sdr_responsible_id: f.sdr_responsible_id || null,
            commercial_responsible_id: f.commercial_responsible_id || null,
            modelo_loja: f.modelo_loja || null,
            tipo_proprietario: f.tipo_proprietario || null,
            additional_contact_name: f.additional_contact_name || null,
            city_available: resolvedCityAvailable,
            nearest_available_city: f.nearest_available_city || null,
            tags: f.tags || [],
            board_id: f.board_id || null,
            stage: f.stage || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id);

        if (error) throw error;

        // Record stage change if applicable
        if (f.stage !== (lead.stage || "") && lead.stage) {
          await supabase.from("lead_stage_history").insert({
            lead_id: lead.id,
            old_stage: lead.stage,
            new_stage: f.stage,
            changed_by: user?.id || null,
          });
        }

        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast.success("Alterações salvas automaticamente");
      } catch (err: any) {
        console.error("Erro ao auto-salvar:", err);
        toast.error("Erro ao salvar alterações");
      }
      dirtyRef.current = false;
    }
    onOpenChange(nextOpen);
  }, [lead, onOpenChange, queryClient, user?.id]);

  const handleDeleteLead = useCallback(async (reason: string) => {
    if (!lead) return;
    try {
      await supabase.from("deleted_leads_log").insert({
        lead_id: lead.id,
        lead_name: lead.name,
        deleted_by: user?.id || null,
        reason,
      });
      const { error } = await supabase.from("leads").delete().eq("id", lead.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead excluído com sucesso");
      setDeleteOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao excluir lead:", err);
      toast.error("Erro ao excluir lead");
    }
  }, [lead, user?.id, queryClient, onOpenChange]);

  if (!lead) return null;

  const currentStage = lead.stage || "captação";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-card rounded-2xl shadow-xl border border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="text-lg font-bold text-foreground">{lead.name || "Sem nome"}</DialogTitle>
            {stages.length > 0 && onStageChange ? (
              <Select
                value={currentStage}
                onValueChange={(newStage) => {
                  if (newStage !== currentStage) {
                    onStageChange(lead, newStage);
                  }
                }}
              >
                <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {getStageLabel(s, customLabels as Record<string, string>)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : lead.stage ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {getStageLabel(lead.stage)}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 ml-auto text-destructive/70 hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
              title="Excluir lead"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} key={defaultTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted rounded-xl p-1 border border-border">
            <TabsTrigger value="dados" className="gap-1.5 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg">
              <User className="h-3.5 w-3.5" /> Dados
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg">
              <MessageSquare className="h-3.5 w-3.5" /> Notas
            </TabsTrigger>
            <TabsTrigger value="materiais" className="gap-1.5 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg">
              <Paperclip className="h-3.5 w-3.5" /> Materiais
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="gap-1.5 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg">
              <CheckSquare className="h-3.5 w-3.5" /> Tarefas
              {pendingTasksCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] h-4 ml-0.5 flex items-center justify-center">
                  {pendingTasksCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reuniao" className="gap-1.5 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg">
              <Mic className="h-3.5 w-3.5" /> Transcrição da Reunião
            </TabsTrigger>
            <TabsTrigger value="agendar" className="gap-1.5 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg">
              <Calendar className="h-3.5 w-3.5" /> Reuniões
            </TabsTrigger>
            <TabsTrigger value="resumo" className="gap-1.5 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg">
              <FileText className="h-3.5 w-3.5" /> Resumo
            </TabsTrigger>
            <TabsTrigger value="score" className="gap-1.5 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg">
              <TrendingUp className="h-3.5 w-3.5" /> Score
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-2 pr-1">
            <TabsContent value="dados" className="mt-0">
              <LeadEditForm lead={lead} onSaved={() => onOpenChange(false)} onDirtyChange={handleDirtyChange} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-0">
              <LeadTimeline leadId={lead.id} />
            </TabsContent>
            <TabsContent value="materiais" className="mt-0">
              <LeadMaterials leadId={lead.id} />
            </TabsContent>
            <TabsContent value="tarefas" className="mt-0">
              <LeadTasks leadId={lead.id} leadName={lead.name} />
            </TabsContent>
            <TabsContent value="reuniao" className="mt-0">
              <LeadTranscription leadId={lead.id} initialTranscription={meetingTranscription} />
            </TabsContent>
            <TabsContent value="agendar" className="mt-0">
              <LeadMeetings
                leadId={lead.id}
                leadName={lead.name}
                leadPhone={lead.phone}
                onTranscriptionReady={(text) => {
                  setMeetingTranscription(text);
                  setActiveTab("reuniao");
                }}
              />
            </TabsContent>
            <TabsContent value="resumo" className="mt-0">
              <LeadSummary leadId={lead.id} />
            </TabsContent>
            <TabsContent value="score" className="mt-0">
              <LeadScore lead={lead} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>

      <DeleteLeadDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        leadName={lead.name}
        onConfirm={handleDeleteLead}
      />
    </Dialog>
  );
}
