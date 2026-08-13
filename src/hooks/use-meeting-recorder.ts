import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseMeetingRecorderReturn {
  isRecording: boolean;
  duration: number;
  partialTranscription: string;
  fullTranscription: string;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
}

interface RecordingFormat {
  mimeType: string;
  extension: string;
}

const RECORDING_FORMATS: RecordingFormat[] = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  { mimeType: "audio/ogg", extension: "ogg" },
  { mimeType: "audio/mp4", extension: "m4a" },
];

function getExtensionFromMimeType(mimeType: string): string {
  const normalizedMimeType = mimeType.split(";")[0]?.toLowerCase() ?? "";

  if (normalizedMimeType.includes("ogg")) return "ogg";
  if (normalizedMimeType.includes("mp4") || normalizedMimeType.includes("m4a")) return "m4a";
  if (normalizedMimeType.includes("mpeg") || normalizedMimeType.includes("mp3") || normalizedMimeType.includes("mpga")) return "mp3";
  if (normalizedMimeType.includes("wav") || normalizedMimeType.includes("wave")) return "wav";
  return "webm";
}

function getFallbackMimeType(extension: string): string {
  if (extension === "ogg") return "audio/ogg";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  return "audio/webm";
}

function getSupportedRecordingFormat(): RecordingFormat {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "audio/webm", extension: "webm" };
  }

  return (
    RECORDING_FORMATS.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType)) ?? {
      mimeType: "audio/webm",
      extension: "webm",
    }
  );
}

function createAudioFile(audioBlob: Blob, fallbackExtension: string): File {
  const extension = audioBlob.type ? getExtensionFromMimeType(audioBlob.type) : fallbackExtension;
  const mimeType = getFallbackMimeType(extension);
  return new File([audioBlob], `audio.${extension}`, { type: mimeType });
}

export function useMeetingRecorder(): UseMeetingRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [partialTranscription, setPartialTranscription] = useState("");
  const [fullTranscription, setFullTranscription] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const transcriptionTextRef = useRef("");
  const recordingFormatRef = useRef<RecordingFormat>({
    mimeType: "audio/webm",
    extension: "webm",
  });

  const syncTranscriptionState = useCallback((text: string) => {
    transcriptionTextRef.current = text;
    setPartialTranscription(text);
    setFullTranscription(text);
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const transcribeRecording = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 1000) return "";

    const formData = new FormData();
    const file = createAudioFile(audioBlob, recordingFormatRef.current.extension);
    formData.append("file", file, file.name);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Sessão expirada");
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Meeting transcription failed:", errorText);
      let userMessage = "Erro na transcrição do áudio.";
      try {
        const errJson = JSON.parse(errorText);
        if (errJson.details) userMessage += ` Detalhes: ${errJson.details}`;
        else if (errJson.error) userMessage += ` ${errJson.error}`;
      } catch { /* keep generic message */ }
      throw new Error(userMessage);
    }

    const result = await response.json();
    return result.text?.trim() ?? "";
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredFormat = getSupportedRecordingFormat();
      let mediaRecorder: MediaRecorder;

      try {
        mediaRecorder = preferredFormat.mimeType
          ? new MediaRecorder(stream, { mimeType: preferredFormat.mimeType })
          : new MediaRecorder(stream);
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      transcriptionTextRef.current = "";
      setPartialTranscription("");
      setFullTranscription("");
      setDuration(0);

      const resolvedMimeType = mediaRecorder.mimeType || preferredFormat.mimeType || "audio/webm";
      const resolvedExtension = getExtensionFromMimeType(resolvedMimeType);
      recordingFormatRef.current = {
        mimeType: getFallbackMimeType(resolvedExtension),
        extension: resolvedExtension,
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err: any) {
      console.error("Microphone error:", err);
      if (err.name === "NotAllowedError") {
        toast.error("Permissão do microfone negada. Habilite nas configurações do navegador.");
      } else {
        toast.error("Erro ao acessar o microfone.");
      }
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      return transcriptionTextRef.current;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setPartialTranscription("Processando transcrição...");

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(recordedChunksRef.current, {
            type: recordingFormatRef.current.mimeType,
          });

          if (audioBlob.size < 1000) {
            syncTranscriptionState("");
            resolve("");
            return;
          }

          const transcription = await transcribeRecording(audioBlob);
          syncTranscriptionState(transcription);
          resolve(transcription);
        } catch (err) {
          console.error("Recording transcription error:", err);
          setPartialTranscription("");
          toast.error("Erro ao transcrever gravação.");
          resolve("");
        } finally {
          cleanup();
        }
      };

      recorder.stop();
    });
  }, [cleanup, syncTranscriptionState, transcribeRecording]);

  return {
    isRecording,
    duration,
    partialTranscription,
    fullTranscription,
    startRecording,
    stopRecording,
  };
}
