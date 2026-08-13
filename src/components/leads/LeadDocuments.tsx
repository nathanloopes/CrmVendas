import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadDocumentsProps {
  leadId: string;
}

export function LeadDocuments({ leadId }: LeadDocumentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [totalToUpload, setTotalToUpload] = useState(0);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["lead-documents", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_documents")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const safeName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${leadId}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageError } = await supabase.storage
        .from("lead-documents")
        .upload(filePath, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("lead_documents").insert({
        lead_id: leadId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        content_type: file.type,
        uploaded_by: user?.id || null,
      });
      if (dbError) throw dbError;
      return file.name;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-documents", leadId] });
    },
    onError: (_err, file) => {
      toast.error(`Erro ao enviar ${file.name}`);
    },
    onSettled: () => {
      setUploadingCount((c) => Math.max(0, c - 1));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: { id: string; file_path: string }) => {
      await supabase.storage.from("lead-documents").remove([doc.file_path]);
      const { error } = await supabase.from("lead_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-documents", leadId] });
      toast.success("Documento removido");
    },
    onError: () => toast.error("Erro ao remover documento"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setTotalToUpload((t) => t + files.length);
      setUploadingCount((c) => c + files.length);
      let success = 0;
      let done = 0;
      files.forEach((file) => {
        uploadMutation.mutate(file, {
          onSuccess: () => { success += 1; },
          onSettled: () => {
            done += 1;
            if (done === files.length) {
              if (success > 0) toast.success(`${success} documento(s) enviado(s)`);
              setTotalToUpload(0);
            }
          },
        });
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getDownloadUrl = async (filePath: string) => {
    const { data } = await supabase.storage.from("lead-documents").createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingCount > 0}
          size="sm"
        >
          {uploadingCount > 0 ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          {uploadingCount > 0
            ? `Enviando ${totalToUpload - uploadingCount + 1} de ${totalToUpload}...`
            : "Enviar documento(s)"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento enviado.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(doc.file_size)} · {format(new Date(doc.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => getDownloadUrl(doc.file_path)}>
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deleteMutation.mutate({ id: doc.id, file_path: doc.file_path })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
