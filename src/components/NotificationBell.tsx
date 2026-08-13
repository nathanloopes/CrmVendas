import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, AtSign, CheckSquare, ArrowRightLeft, Lightbulb, CheckCircle2, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNotificationRoute } from "@/lib/notification-routing";

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 60000,
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const mentionNotifications = notifications.filter((n) => n.type === "mention");
  const taskNotifications = notifications.filter((n) => n.type === "task_overdue" || n.type === "task_due");
  const stageNotifications = notifications.filter((n) => n.type === "stage_move" || n.type === "stage_change");
  const unreadMentions = mentionNotifications.filter((n) => !n.read).length;
  const unreadTasks = taskNotifications.filter((n) => !n.read).length;
  const unreadStage = stageNotifications.filter((n) => !n.read).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length === 0) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", unreadIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-suggestion-completed"] });
    },
  });

  const markOneRead = useMutation({
    mutationFn: async (notificationId: string) => {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-suggestion-completed"] });
    },
  });

  const handleNotificationClick = (n: typeof notifications[0]) => {
    if (!n.read) {
      markOneRead.mutate(n.id);
    }
    const route = getNotificationRoute(n as any);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  const renderIcon = (type: string) => {
    if (type === "mention") return <AtSign className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
    if (type === "stage_move" || type === "stage_change") return <ArrowRightLeft className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />;
    if (type === "suggestion_completed") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />;
    if (type === "suggestion_new" || type === "suggestion_update") return <Lightbulb className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />;
    if (type.startsWith("task")) return <CheckSquare className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />;
    return null;
  };

  const renderList = (items: typeof notifications) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>;
    }
    return (
      <div className="divide-y divide-border">
        {items.map((n) => {
          const isCompletedSuggestion = n.type === "suggestion_completed";
          return (
          <div
            key={n.id}
            className={`group px-4 py-3 text-sm flex gap-2 cursor-pointer hover:bg-muted/50 transition-colors ${
              isCompletedSuggestion && !n.read
                ? "bg-green-500/10 border-l-4 border-green-500"
                : !n.read
                ? "bg-primary/5"
                : ""
            }`}
            onClick={() => handleNotificationClick(n)}
          >
            {renderIcon(n.type)}
            <div className="min-w-0 flex-1">
              <p className={`${!n.read ? "font-medium" : "text-muted-foreground"}`}>{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
            {!n.read && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 self-start opacity-70 hover:opacity-100 hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        markOneRead.mutate(n.id);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Marcar como lida</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          );
        })}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllRead.mutate()}>
              Marcar tudo como lido
            </Button>
          )}
        </div>
        <Tabs defaultValue="todas" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-9 px-1">
            <TabsTrigger value="todas" className="text-[11px] px-2 py-1 data-[state=active]:shadow-none relative">
              Todas
              {unreadCount > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] rounded-full px-1.5 py-0.5 leading-none">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mencoes" className="text-[11px] px-2 py-1 data-[state=active]:shadow-none relative">
              <AtSign className="h-3 w-3 mr-0.5" />
              Menções
              {unreadMentions > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-[9px] rounded-full px-1.5 py-0.5 leading-none">
                  {unreadMentions}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="text-[11px] px-2 py-1 data-[state=active]:shadow-none relative">
              <CheckSquare className="h-3 w-3 mr-0.5" />
              Tarefas
              {unreadTasks > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-[9px] rounded-full px-1.5 py-0.5 leading-none">
                  {unreadTasks}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="movimentacoes" className="text-[11px] px-2 py-1 data-[state=active]:shadow-none relative">
              <ArrowRightLeft className="h-3 w-3 mr-0.5" />
              Movimentações
              {unreadStage > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-[9px] rounded-full px-1.5 py-0.5 leading-none">
                  {unreadStage}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="todas" className="mt-0">
            <div className="max-h-96 overflow-y-auto">{renderList(notifications)}</div>
          </TabsContent>
          <TabsContent value="mencoes" className="mt-0">
            <div className="max-h-96 overflow-y-auto">{renderList(mentionNotifications)}</div>
          </TabsContent>
          <TabsContent value="tarefas" className="mt-0">
            <div className="max-h-96 overflow-y-auto">{renderList(taskNotifications)}</div>
          </TabsContent>
          <TabsContent value="movimentacoes" className="mt-0">
            <div className="max-h-96 overflow-y-auto">{renderList(stageNotifications)}</div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
