import { useRef, useState } from "react";
import { Upload, FileVideo, Loader2, X } from "lucide-react";
import { apiBase } from "../../lib/api";

export interface ClipSource {
  file_path: string;
  filename: string;
  size: number;
  duration: number;
}

export function VideoUploader({
  source,
  onUploaded,
  onClear,
}: {
  source: ClipSource | null;
  onUploaded: (s: ClipSource) => void;
  onClear: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const base = await apiBase();
      const form = new FormData();
      form.append("file", file);
      form.append("session_id", "clip");
      const r = await fetch(`${base}/clip/upload`, { method: "POST", body: form });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onUploaded(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!source) {
    return (
      <div
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] px-6 py-10 text-center hover:border-[hsl(217,33%,32%)]"
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        {uploading ? (
          <Loader2 className="mb-2 h-7 w-7 animate-spin text-[hsl(150,60%,45%)]" />
        ) : (
          <Upload className="mb-2 h-7 w-7 text-[hsl(215,20%,45%)]" />
        )}
        <div className="text-sm font-medium text-white">
          {uploading ? "上传中..." : "选择视频文件"}
        </div>
        <div className="mt-1 text-xs text-[hsl(215,20%,55%)]">支持 MP4/MOV</div>
        {error && (
          <div className="mt-2 rounded bg-[hsl(0,50%,20%)] px-2 py-1 text-xs text-[hsl(0,80%,85%)]">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
      <div className="flex items-center gap-3">
        <FileVideo className="h-5 w-5 shrink-0 text-[hsl(150,60%,55%)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{source.filename}</div>
          <div className="text-xs text-[hsl(215,20%,55%)]">
            {source.duration.toFixed(1)}s · {(source.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
        <button
          onClick={onClear}
          className="rounded p-1 text-[hsl(215,20%,45%)] hover:bg-[hsl(217,33%,22%)] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
