import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Subtitles,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
} from "lucide-react";
import { apiBase, apiGet, apiPost } from "../lib/api";

interface VideoSource {
  file_path: string;
  filename: string;
  duration: number;
}

interface SubtitleJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: {
    output_path?: string;
    format?: string;
    segments_count?: number;
    duration?: number;
    transcript?: string;
  };
  error?: string | null;
}

export default function SubtitlePage() {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [format, setFormat] = useState<"srt" | "ass">("srt");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setSubmitError(null);
    try {
      const base = await apiBase();
      const form = new FormData();
      form.append("file", file);
      form.append("session_id", "subtitle");
      const r = await fetch(`${base}/subtitle/upload`, { method: "POST", body: form });
      if (!r.ok) throw new Error(`Upload failed ${r.status}`);
      setSource(await r.json());
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const { data: job } = useQuery<SubtitleJob>({
    queryKey: ["subtitle-job", jobId],
    queryFn: () => apiGet<SubtitleJob>(`/subtitle/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "done" || s === "failed" ? false : 1500;
    },
  });

  const isRunning = job?.status === "queued" || job?.status === "running";
  const hasResult = job?.status === "done" && job.result?.output_path;

  const startGenerate = async () => {
    if (!source) return;
    setJobId(null);
    setSubmitError(null);
    try {
      const resp = await apiPost<{ job_id: string }>("/subtitle/generate", {
        video_path: source.file_path,
        format,
      });
      setJobId(resp.job_id);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    }
  };

  const openDownload = async () => {
    const base = await apiBase();
    window.open(`${base}/subtitle/${jobId}/download`, "_blank");
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(320,60%,55%)]/20">
          <Subtitles className="h-5 w-5 text-[hsl(320,60%,65%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">字幕生成</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            SenseVoice 本地转录 → 带时间戳的 SRT / ASS 字幕文件
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />

        {!source ? (
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-10 text-center hover:border-[hsl(217,33%,32%)]"
          >
            <Upload className="mb-2 h-7 w-7 text-[hsl(320,60%,55%)]" />
            <div className="text-sm font-medium text-white">选择视频或音频文件</div>
            <div className="mt-1 text-xs text-[hsl(215,20%,55%)]">支持 MP4/MOV/WAV/MP3</div>
          </div>
        ) : (
          <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[hsl(320,60%,65%)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{source.filename}</div>
                <div className="text-xs text-[hsl(215,20%,55%)]">
                  时长 {source.duration.toFixed(1)}s
                </div>
              </div>
              <button
                onClick={() => {
                  setSource(null);
                  setJobId(null);
                }}
                className="text-xs text-[hsl(215,20%,55%)] hover:text-white"
              >
                更换
              </button>
            </div>
          </div>
        )}

        {source && (
          <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <label className="mb-2 block text-xs text-[hsl(215,20%,55%)]">导出格式</label>
            <div className="flex gap-2">
              {(["srt", "ass"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    format === f
                      ? "bg-[hsl(320,60%,55%)] text-white"
                      : "bg-[hsl(222,47%,9%)] text-[hsl(215,20%,70%)] hover:bg-[hsl(222,47%,12%)]"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {source && (
          <button
            onClick={startGenerate}
            disabled={isRunning}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(320,60%,55%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(320,60%,60%)] disabled:opacity-40"
          >
            {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRunning ? "生成中..." : "生成字幕"}
          </button>
        )}

        {submitError && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {submitError}
          </div>
        )}

        {jobId && isRunning && (
          <div className="rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[hsl(215,20%,70%)]">
              <span>
                {job?.progress && job.progress < 35 ? "提取音轨..." : "转录 + 生成字幕..."}
              </span>
              <span>{job?.progress ?? 0}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(222,47%,9%)]">
              <div
                className="h-full bg-[hsl(320,60%,55%)] transition-all"
                style={{ width: `${job?.progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {job?.status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg bg-[hsl(0,50%,20%)] p-3 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">生成失败</div>
              <div className="mt-1 text-xs">{job.error}</div>
            </div>
          </div>
        )}

        {hasResult && (
          <div className="rounded-xl border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,12%)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,55%)]" />
              <span className="text-sm font-medium text-white">
                生成完成 · {job!.result.segments_count} 行字幕
              </span>
            </div>
            {job!.result.transcript && (
              <details className="mb-3">
                <summary className="cursor-pointer text-xs text-[hsl(150,60%,75%)]">预览全文</summary>
                <div className="mt-1 max-h-48 overflow-y-auto rounded bg-[hsl(222,47%,9%)] p-2 text-xs leading-relaxed text-[hsl(215,20%,85%)] whitespace-pre-wrap">
                  {job!.result.transcript}
                </div>
              </details>
            )}
            <button
              onClick={openDownload}
              className="flex items-center gap-1 rounded border border-[hsl(150,40%,30%)] px-2 py-1 text-xs text-[hsl(150,60%,75%)] hover:bg-[hsl(150,40%,20%)]"
            >
              <Download className="h-3 w-3" /> 下载 .{job!.result.format?.toUpperCase()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
