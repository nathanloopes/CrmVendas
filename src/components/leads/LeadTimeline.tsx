import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  ArrowRightLeft,
  Send,
  Loader2,
  CheckCircle,
  ListTodo,
  Paperclip,
  FileUp,
  Mic,
  Square,
  Volume2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { findDuplicateTasks, type DuplicateTask } from "@/lib/task-duplicates";
import { DuplicateTaskDialog } from "@/components/tasks/DuplicateTaskDialog";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";

interface LeadTimelineProps {
  leadId: string;
}

type TimelineItem = {
  id: string;
  type: "note" | "stage_change" | "task_completed" | "task_created" | "material_added" | "document_uploaded";
  content: string;
  created_at: string;
  created_by?: string | null;
  old_stage?: string;
  new_stage?: string;
  note_type?: string | null;
  audio_url?: string | null;
};

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [showActivities, setShowActivities] = useState(true);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  // Task creation from note
  const [createTask, setCreateTask] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");

  // Dialog: create task from existing note
  const [noteToTask, setNoteToTask] = useState<string | null>(null);
  const [noteToTaskHidden, setNoteToTaskHidden] = useState(false);
  const [dialogTaskTitle, setDialogTaskTitle] = useState("");
  const [dialogTaskDescription, setDialogTaskDescription] = useState("");
  const [dialogTaskDueDate, setDialogTaskDueDate] = useState("");
  const [dialogTaskAssignedTo, setDialogTaskAssignedTo] = useState("");
  const [dialogTaskPriority, setDialogTaskPriority] = useState("medium");

  // Duplicate detection
  const [duplicates, setDuplicates] = useState<DuplicateTask[]>([]);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [pendingFlow, setPendingFlow] = useState<"note" | "dialog" | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);
  const [viewingDupTask, setViewingDupTask] = useState<any>(null);

  // Mention autocomplete state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("id, content, type, created_at, created_by, audio_url, mentioned_user_ids")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["lead-stage-history", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_stage_history")
        .select("id, old_stage, new_stage, changed_at, changed_by")
        .eq("lead_id", leadId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["lead-tasks-timeline", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, created_at, completed_at, created_by, assigned_to")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: materials = [], isLoading: materialsLoading } = useQuery({
    queryKey: ["lead-materials-timeline", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_materials")
        .select("id, title, type, created_at, created_by")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["lead-documents-timeline", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_documents")
        .select("id, file_name, created_at, uploaded_by")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: usersMap = {} } = useQuery({
    queryKey: ["users-map"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name");
      const map: Record<string, string> = {};
      data?.forEach((u) => (map[u.id] = u.name));
      return map;
    },
  });

  // Users list for task assignment and mentions
  const { data: activeUsers = [] } = useQuery({
    queryKey: ["users-select"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  // Users list for mention autocomplete
  const usersList = Object.entries(usersMap).map(([id, name]) => ({ id, name }));

  const filteredMentionUsers = usersList.filter((u) =>
    u.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // Handle textarea changes for @mention detection
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewNote(value);

    // Detect @ pattern
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Only show if no space before @ (or start of string) and no newline in filter
      const charBeforeAt = lastAtIndex > 0 ? value[lastAtIndex - 1] : " ";
      if ((charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) && !textAfterAt.includes("\n")) {
        setShowMentionDropdown(true);
        setMentionFilter(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setSelectedMentionIndex(0);
        return;
      }
    }
    setShowMentionDropdown(false);
    setMentionStartIndex(null);
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionDropdown || filteredMentionUsers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedMentionIndex((prev) => Math.min(prev + 1, filteredMentionUsers.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedMentionIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && showMentionDropdown) {
      e.preventDefault();
      selectMention(filteredMentionUsers[selectedMentionIndex]);
    } else if (e.key === "Escape") {
      setShowMentionDropdown(false);
    }
  };

  const selectMention = (mentionUser: { id: string; name: string }) => {
    if (mentionStartIndex === null) return;

    const before = newNote.substring(0, mentionStartIndex);
    const cursorPos = textareaRef.current?.selectionStart || newNote.length;
    const after = newNote.substring(cursorPos);
    const mentionText = `@${mentionUser.name} `;
    const newText = before + mentionText + after;

    setNewNote(newText);
    setShowMentionDropdown(false);
    setMentionStartIndex(null);

    if (!mentionedUserIds.includes(mentionUser.id)) {
      setMentionedUserIds((prev) => [...prev, mentionUser.id]);
    }

    // Focus textarea and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = before.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMentionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "txt") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setNewNote((prev) => (prev ? prev + "\n\n" : "") + text);
        toast.success("Conteúdo do arquivo carregado na nota");
      };
      reader.readAsText(file);
    } else if (["doc", "docx", "pdf"].includes(ext || "")) {
      // Upload file to storage and add reference
      const filePath = `${leadId}/transcription-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("lead-audio-notes")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) {
        toast.error("Erro ao enviar arquivo: " + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("lead-audio-notes")
        .getPublicUrl(filePath);

      const fileRef = `📎 Transcrição anexada: [${file.name}](${urlData.publicUrl})`;
      setNewNote((prev) => (prev ? prev + "\n\n" : "") + fileRef);
      toast.success("Arquivo enviado e referência adicionada à nota");
    } else {
      toast.error("Formato não suportado. Use .txt, .doc, .docx ou .pdf");
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const lastMentionedIdsRef = useRef<string[]>([]);

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      // Extract mentioned user IDs from note text matching @Name patterns
      const finalMentionedIds = [...mentionedUserIds];
      usersList.forEach((u) => {
        if (newNote.includes(`@${u.name}`) && !finalMentionedIds.includes(u.id)) {
          finalMentionedIds.push(u.id);
        }
      });

      // Store for onSuccess
      lastMentionedIdsRef.current = finalMentionedIds;

      const { error } = await supabase.from("lead_notes").insert({
        lead_id: leadId,
        content: newNote,
        type: pendingAudioUrl ? "audio" : "note",
        audio_url: pendingAudioUrl || null,
        created_by: user?.id || null,
        mentioned_user_ids: finalMentionedIds.length > 0 ? finalMentionedIds : [],
      });
      if (error) throw error;

      // Create task from note if toggled
      if (createTask && user) {
        const taskTitle = newNote.length > 100 ? newNote.substring(0, 100) + "..." : newNote;
        const assignee = taskAssignedTo || user.id;
        const { data: newTask, error: taskError } = await supabase.from("tasks").insert({
          title: taskTitle,
          description: newNote,
          lead_id: leadId,
          due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
          assigned_to: assignee,
          created_by: user.id,
          priority: taskPriority,
        }).select("id").single();
        if (taskError) throw taskError;

        await supabase.from("task_history").insert({
          task_id: newTask.id,
          user_id: user.id,
          action: "created",
          details: "Tarefa criada a partir de nota",
        });

        if (assignee !== user.id) {
          await supabase.rpc("create_notification", {
            p_user_id: assignee,
            p_type: "task_assigned",
            p_message: `Você recebeu uma nova tarefa: ${taskTitle}`,
            p_source_id: newTask.id,
            p_metadata: { leadId, taskId: newTask.id } as any,
          });
        }
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      if (createTask) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["lead-tasks-timeline", leadId] });
      }
      const hadAudio = !!pendingAudioUrl;
      const hadTask = createTask;
      setNewNote("");
      setPendingAudioBlob(null);
      setPendingAudioUrl(null);
      setMentionedUserIds([]);
      setCreateTask(false);
      setTaskDueDate("");
      setTaskAssignedTo("");
      setTaskPriority("medium");
      toast.success(hadTask ? "Nota e tarefa criadas" : hadAudio ? "Nota de áudio adicionada" : "Nota adicionada");

      // Send mention notifications
      const idsToNotify = lastMentionedIdsRef.current.filter((id) => id !== user?.id);
      if (idsToNotify.length > 0 && user) {
        const senderName = usersMap[user.id] || "Alguém";
        const { data: lead } = await supabase
          .from("leads")
          .select("name")
          .eq("id", leadId)
          .single();
        const leadName = lead?.name || "Lead";

        for (const mentionedId of idsToNotify) {
          await supabase.rpc("create_notification", {
            p_user_id: mentionedId,
            p_type: "mention",
            p_message: `@${senderName} mencionou você em uma nota do lead "${leadName}"`,
            p_source_id: leadId,
            p_metadata: { lead_id: leadId, mentioned_by: user.id },
          });
        }
      }
      lastMentionedIdsRef.current = [];
    },
    onError: () => toast.error("Erro ao adicionar nota"),
  });

  const openNoteToTaskDialog = (noteContent: string) => {
    setNoteToTask(noteContent);
    setDialogTaskTitle(noteContent.length > 100 ? noteContent.substring(0, 100) + "..." : noteContent);
    setDialogTaskDescription(noteContent);
    setDialogTaskDueDate("");
    setDialogTaskAssignedTo("");
    setDialogTaskPriority("medium");
  };

  const createTaskFromNoteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const assignee = dialogTaskAssignedTo || user.id;
      const { data: newTask, error: taskError } = await supabase.from("tasks").insert({
        title: dialogTaskTitle,
        description: dialogTaskDescription,
        lead_id: leadId,
        due_date: dialogTaskDueDate ? new Date(dialogTaskDueDate).toISOString() : null,
        assigned_to: assignee,
        created_by: user.id,
        priority: dialogTaskPriority,
      }).select("id").single();
      if (taskError) throw taskError;

      await supabase.from("task_history").insert({
        task_id: newTask.id,
        user_id: user.id,
        action: "created",
        details: "Tarefa criada a partir de nota existente",
      });

      if (assignee !== user.id) {
        await supabase.rpc("create_notification", {
          p_user_id: assignee,
          p_type: "task_assigned",
          p_message: `Você recebeu uma nova tarefa: ${dialogTaskTitle}`,
          p_source_id: newTask.id,
          p_metadata: { leadId, taskId: newTask.id } as any,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["lead-tasks-timeline", leadId] });
      setNoteToTask(null);
      setNoteToTaskHidden(false);
      setShowDupDialog(false);
      toast.success("Tarefa criada com sucesso");
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const handleSendNoteClick = async () => {
    if (!newNote.trim()) return;
    if (createTask) {
      const candidateTitle = newNote.length > 100 ? newNote.substring(0, 100) + "..." : newNote;
      setCheckingDup(true);
      try {
        const dups = await findDuplicateTasks({ leadId, title: candidateTitle });
        if (dups.length > 0) {
          setDuplicates(dups);
          setPendingFlow("note");
          setShowDupDialog(true);
          return;
        }
      } finally {
        setCheckingDup(false);
      }
    }
    addNoteMutation.mutate();
  };

  const handleCreateTaskFromNoteClick = async () => {
    if (!dialogTaskTitle.trim()) return;
    setCheckingDup(true);
    try {
      const dups = await findDuplicateTasks({ leadId, title: dialogTaskTitle });
      if (dups.length > 0) {
        setDuplicates(dups);
        setPendingFlow("dialog");
        // Fecha o dialog "criar tarefa a partir da nota" para que o aviso fique sozinho em primeiro plano
        setNoteToTaskHidden(true);
        setShowDupDialog(true);
        return;
      }
      createTaskFromNoteMutation.mutate();
    } finally {
      setCheckingDup(false);
    }
  };

  const handleDupDialogChange = (open: boolean) => {
    setShowDupDialog(open);
    if (!open && pendingFlow === "dialog") {
      // Reabre o dialog principal preservando os dados se o usuário cancelar
      setNoteToTaskHidden(false);
    }
  };

  const handleDupCreateAnyway = () => {
    if (pendingFlow === "note") addNoteMutation.mutate();
    else if (pendingFlow === "dialog") createTaskFromNoteMutation.mutate();
  };

  const handleDupViewExisting = async (task: DuplicateTask) => {
    if (user && task.assigned_to && task.assigned_to !== user.id) {
      const { data: lead } = await supabase.from("leads").select("name").eq("id", leadId).single();
      await supabase.rpc("create_notification", {
        p_user_id: task.assigned_to,
        p_type: "task_assigned",
        p_message: `Outro usuário tentou criar uma tarefa parecida no lead "${lead?.name || "Lead"}"`,
        p_source_id: task.id,
        p_metadata: { leadId, taskId: task.id, duplicate_attempt: true } as any,
      });
    }
    const { data: fullTask } = await supabase.from("tasks").select("*").eq("id", task.id).single();
    setShowDupDialog(false);
    if (fullTask) setViewingDupTask(fullTask);
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return new Promise<Blob>((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        mediaRecorderRef.current!.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        resolve(blob);
      };
      mediaRecorderRef.current!.stop();
    });
  }, []);

  const processAudio = useCallback(async () => {
    setIsProcessingAudio(true);
    try {
      const audioBlob = await stopRecording();
      if (!audioBlob || audioBlob.size === 0) {
        toast.error("Nenhum áudio gravado");
        return;
      }

      const filePath = `${leadId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("lead-audio-notes")
        .upload(filePath, audioBlob, { contentType: "audio/webm" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("lead-audio-notes")
        .getPublicUrl(filePath);

      const audioUrl = urlData.publicUrl;

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      const { data: transcription, error: fnError } = await supabase.functions.invoke(
        "transcribe-audio",
        { body: formData }
      );

      if (fnError) throw fnError;

      const transcriptionText = transcription?.text || "";

      setNewNote(transcriptionText);
      setPendingAudioBlob(audioBlob);
      setPendingAudioUrl(audioUrl);
      toast.success("Transcrição pronta! Edite se necessário e clique em enviar.");
    } catch (err: any) {
      console.error("Audio processing error:", err);
      toast.error("Erro ao processar áudio: " + (err.message || "erro desconhecido"));
    } finally {
      setIsProcessingAudio(false);
      setRecordingTime(0);
    }
  }, [leadId, stopRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const timeline: TimelineItem[] = [
    ...notes.map((n) => ({
      id: n.id,
      type: "note" as const,
      content: n.content,
      created_at: n.created_at,
      created_by: n.created_by,
      note_type: n.type,
      audio_url: n.audio_url,
    })),
    ...history.map((h) => ({
      id: h.id,
      type: "stage_change" as const,
      content: "",
      created_at: h.changed_at,
      created_by: h.changed_by,
      old_stage: h.old_stage,
      new_stage: h.new_stage,
    })),
    ...tasks.map((t) => ({
      id: `task-created-${t.id}`,
      type: "task_created" as const,
      content: t.title,
      created_at: t.created_at!,
      created_by: t.created_by,
    })),
    ...tasks
      .filter((t) => t.status === "completed" && t.completed_at)
      .map((t) => ({
        id: `task-completed-${t.id}`,
        type: "task_completed" as const,
        content: t.title,
        created_at: t.completed_at!,
        created_by: t.assigned_to,
      })),
    ...materials.map((m) => ({
      id: `material-${m.id}`,
      type: "material_added" as const,
      content: m.title,
      created_at: m.created_at,
      created_by: m.created_by,
    })),
    ...documents.map((d) => ({
      id: `document-${d.id}`,
      type: "document_uploaded" as const,
      content: d.file_name,
      created_at: d.created_at,
      created_by: d.uploaded_by,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredTimeline = showActivities
    ? timeline
    : timeline.filter((item) => item.type === "note");

  const formatStage = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const isLoading = notesLoading || historyLoading || tasksLoading || materialsLoading || documentsLoading;

  const getIcon = (type: TimelineItem["type"], noteType?: string | null) => {
    if (type === "note" && noteType === "audio") {
      return <Volume2 className="h-4 w-4 text-orange-500" />;
    }
    switch (type) {
      case "note":
        return <MessageSquare className="h-4 w-4 text-primary" />;
      case "stage_change":
        return <ArrowRightLeft className="h-4 w-4 text-warning" />;
      case "task_completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "task_created":
        return <ListTodo className="h-4 w-4 text-muted-foreground" />;
      case "material_added":
        return <Paperclip className="h-4 w-4 text-purple-500" />;
      case "document_uploaded":
        return <FileUp className="h-4 w-4 text-blue-500" />;
    }
  };

  // Render note content with highlighted mentions
  const renderNoteContent = (content: string) => {
    // Replace @Name patterns with highlighted spans
    const parts = content.split(/(@\w[\w\s]*?)(?=\s|$|@|\n)/g);
    const mentionNames = usersList.map((u) => u.name);

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            p: ({ children }) => {
              if (typeof children === "string" || (Array.isArray(children) && children.every((c) => typeof c === "string"))) {
                const text = Array.isArray(children) ? children.join("") : children;
                const mentionRegex = new RegExp(`(@(?:${mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");

                if (mentionNames.length > 0 && mentionRegex.test(text)) {
                  const segments = text.split(mentionRegex);
                  return (
                    <p>
                      {segments.map((seg, i) =>
                        mentionNames.some((n) => seg === `@${n}`) ? (
                          <span key={i} className="font-semibold text-primary bg-primary/10 rounded px-0.5">
                            {seg}
                          </span>
                        ) : (
                          <span key={i}>{seg}</span>
                        )
                      )}
                    </p>
                  );
                }
              }
              return <p>{children}</p>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  const renderContent = (item: TimelineItem) => {
    switch (item.type) {
      case "note":
        if (item.note_type === "audio") {
          return (
            <div className="space-y-2">
              {item.audio_url && (
                <audio controls src={item.audio_url} className="w-full max-w-sm h-8" />
              )}
              {renderNoteContent(item.content)}
            </div>
          );
        }
        return renderNoteContent(item.content);
      case "stage_change":
        return (
          <p className="text-muted-foreground">
            Movido de{" "}
            <Badge variant="outline" className="text-xs mx-0.5">{formatStage(item.old_stage!)}</Badge>
            {" "}para{" "}
            <Badge variant="secondary" className="text-xs mx-0.5">{formatStage(item.new_stage!)}</Badge>
          </p>
        );
      case "task_completed":
        return <p className="text-muted-foreground">Concluiu tarefa: <span className="font-medium text-foreground">{item.content}</span></p>;
      case "task_created":
        return <p className="text-muted-foreground">Tarefa criada: <span className="font-medium text-foreground">{item.content}</span></p>;
      case "material_added":
        return <p className="text-muted-foreground">Adicionou material: <span className="font-medium text-foreground">{item.content}</span></p>;
      case "document_uploaded":
        return <p className="text-muted-foreground">Enviou documento: <span className="font-medium text-foreground">{item.content}</span></p>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.doc,.docx,.pdf"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Input area */}
      {isRecording || isProcessingAudio ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          {isProcessingAudio ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Processando áudio...</span>
            </>
          ) : (
            <>
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive">Gravando</span>
              <span className="text-sm font-mono text-muted-foreground">{formatTime(recordingTime)}</span>
              <div className="flex-1" />
              <Button size="sm" variant="destructive" onClick={processAudio}>
                <Square className="h-3 w-3 mr-1 fill-current" />
                Parar
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {pendingAudioBlob && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted border text-sm">
              <Volume2 className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="text-muted-foreground">Áudio anexado</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 ml-auto"
                onClick={() => {
                  setPendingAudioBlob(null);
                  setPendingAudioUrl(null);
                }}
              >
                <span className="text-xs">✕</span>
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                placeholder="Adicionar nota... Use @ para mencionar alguém"
                value={newNote}
                onChange={handleNoteChange}
                onKeyDown={handleKeyDown}
                rows={2}
                className="w-full"
              />
              {/* Mention dropdown */}
              {showMentionDropdown && filteredMentionUsers.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 mt-1 w-64 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-md z-50"
                >
                  {filteredMentionUsers.map((u, idx) => (
                    <button
                      key={u.id}
                      className={`w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors ${
                        idx === selectedMentionIndex ? "bg-accent text-accent-foreground" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMention(u);
                      }}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 self-end">
              <Button
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                title="Enviar transcrição (arquivo)"
              >
                <FileUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={startRecording}
                title="Gravar nota de áudio"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={handleSendNoteClick}
                disabled={!newNote.trim() || addNoteMutation.isPending || checkingDup}
              >
                {addNoteMutation.isPending || checkingDup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Create task from note */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="create-task-from-note"
              checked={createTask}
              onCheckedChange={(checked) => setCreateTask(checked === true)}
            />
            <Label htmlFor="create-task-from-note" className="text-sm cursor-pointer">
              Criar tarefa a partir desta nota
            </Label>
          </div>

          {createTask && (
            <div className="grid grid-cols-3 gap-2 p-3 rounded-md border bg-muted/50">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vencimento</Label>
                <Input
                  type="datetime-local"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Responsável</Label>
                <Select value={taskAssignedTo} onValueChange={setTaskAssignedTo}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Eu mesmo" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prioridade</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          id="show-activities"
          checked={showActivities}
          onCheckedChange={setShowActivities}
        />
        <Label htmlFor="show-activities" className="text-sm text-muted-foreground cursor-pointer">
          Mostrar movimentações
        </Label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTimeline.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada.</p>
      ) : (
        <div className="space-y-3">
          {filteredTimeline.map((item) => (
            <div key={item.id} className="flex gap-3 text-sm">
              <div className="mt-1 shrink-0">{getIcon(item.type, item.note_type)}</div>
              <div className="flex-1 min-w-0">
                {renderContent(item)}
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {item.created_by && usersMap[item.created_by] ? `${usersMap[item.created_by]} · ` : ""}
                    {format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </p>
                  {item.type === "note" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => openNoteToTaskDialog(item.content)}
                      title="Criar tarefa a partir desta nota"
                    >
                      <ListTodo className="h-3 w-3 mr-1" />
                      Tarefa
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog: create task from existing note */}
      <Dialog open={noteToTask !== null && !noteToTaskHidden} onOpenChange={(open) => !open && !noteToTaskHidden && setNoteToTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar tarefa a partir da nota</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Título</Label>
              <Input
                value={dialogTaskTitle}
                onChange={(e) => setDialogTaskTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Descrição</Label>
              <Textarea
                value={dialogTaskDescription}
                onChange={(e) => setDialogTaskDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vencimento</Label>
              <Input
                type="datetime-local"
                value={dialogTaskDueDate}
                onChange={(e) => setDialogTaskDueDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Responsável</Label>
                <Select value={dialogTaskAssignedTo} onValueChange={setDialogTaskAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Eu mesmo" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prioridade</Label>
                <Select value={dialogTaskPriority} onValueChange={setDialogTaskPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteToTask(null)}>Cancelar</Button>
            <Button
              onClick={handleCreateTaskFromNoteClick}
              disabled={!dialogTaskTitle.trim() || createTaskFromNoteMutation.isPending || checkingDup}
            >
              {createTaskFromNoteMutation.isPending || checkingDup ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {checkingDup ? "Verificando..." : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateTaskDialog
        open={showDupDialog}
        onOpenChange={handleDupDialogChange}
        duplicates={duplicates}
        onViewExisting={handleDupViewExisting}
        onCreateAnyway={handleDupCreateAnyway}
        isCreating={addNoteMutation.isPending || createTaskFromNoteMutation.isPending}
      />

      {viewingDupTask && (
        <TaskDetailSheet task={viewingDupTask} onClose={() => setViewingDupTask(null)} />
      )}
    </div>
  );
}
