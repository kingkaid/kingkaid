import { useState, useRef } from "react";
import { Upload, FileVideo, CheckCircle2, Loader2, X } from "lucide-react";
import { apiBase } from "../../lib/api";

export interface UploadedFile {
  file_path: string;
  filename: string;
  size: number;
}

export function ReferenceUploader({
  uploaded,
  onUploaded,
  onClear,
  onVoiceRegistered,
  voiceId,
}: {
  uploaded: UploadedFile | null;
  onUploaded: (file: UploadedFile) => void;
  onClear: () => void;
  onVoiceRegistered: (voiceId: string) => void;
  voiceId: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const base = await apiBase();
      const form = new FormData();
      form.append("file", file);
      form.append("session_id", "default");
      const resp = await fetch(`${base}/avatar/upload`, { method: "POST", body: form });
      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      const data = (await resp.json()) as UploadedFile;
      onUploaded(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRegister = async () => {
    if (!uploaded) return;
    setRegistering(true);
    setError(null);
    try {
      const base = await apiBase();
      const resp = await fetch(`${base}/avatar/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_path: uploaded.file_path }),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        throw new Error(`Register failed: ${detail}`);
      }
      const data = await resp.json();
      onVoiceRegistered(data.voice_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Register failed");
    } finally {
      setRegistering(false);
    }
  };

  if (!uploaded) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleUpload(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver
            ? "border-[hsl(263,70%,60%)] bg-[hsl(263,70%,60%)]/10"
            : "border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] hover:border-[hsl(217,33%,32%)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading ? (
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-[hsl(263,70%,60%)]" />
        ) : (
          <Upload className="mb-3 h-8 w-8 text-[hsl(215,20%,45%)]" />
        )}
        <div className="mb-1 text-sm font-medium text-white">
          {uploading ? "上传中..." : "拖拽参考视频到此处，或点击选择"}
        </div>
        <div className="text-xs text-[hsl(215,20%,55%)]">
          支持 MP4/MOV 视频（≥1 秒）或单张照片
        </div>
        {error && (
          <div className="mt-3 rounded bg-[hsl(0,50%,20%)] px-3 py-1.5 text-xs text-[hsl(0,80%,85%)]">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(210,70%,60%)]/20">
          <FileVideo className="h-5 w-5 text-[hsl(210,70%,60%)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{uploaded.filename}</div>
          <div className="text-xs text-[hsl(215,20%,55%)]">
            {(uploaded.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
        <button
          onClick={onClear}
          className="rounded p-1 text-[hsl(215,20%,45%)] hover:bg-[hsl(217,33%,22%)] hover:text-white"
          aria-label="移除"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {voiceId ? (
        <div className="flex items-center gap-2 rounded-lg bg-[hsl(150,40%,15%)] px-3 py-2 text-xs text-[hsl(150,60%,75%)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          已注册 · voice_id: <span className="font-mono">{voiceId}</span>
        </div>
      ) : (
        <button
          onClick={handleRegister}
          disabled={registering}
          className="flex items-center justify-center gap-2 rounded-lg bg-[hsl(263,70%,60%)] px-3 py-2 text-xs font-medium text-white hover:bg-[hsl(263,70%,65%)] disabled:opacity-50"
        >
          {registering && <Loader2 className="h-3 w-3 animate-spin" />}
          {registering ? "注册中..." : "注册到 HeyGem"}
        </button>
      )}

      {error && (
        <div className="mt-2 rounded bg-[hsl(0,50%,20%)] px-3 py-1.5 text-xs text-[hsl(0,80%,85%)]">
          {error}
        </div>
      )}
    </div>
  );
}
