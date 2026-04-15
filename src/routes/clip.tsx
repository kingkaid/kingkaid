import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Loader2, AlertCircle, Download, CheckCircle2 } from "lucide-react";
import { VideoUploader, ClipSource } from "../components/clip/VideoUploader";
import { ClipTimeline, Segment } from "../components/clip/ClipTimeline";
import { apiGet, apiPost } from "../lib/api";

interface ClipJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: {
    output_path?: string;
    duration?: number;
    segments_count?: number;
  };
  error?: string | null;
}

export default function ClipPage() {
  const [source, setSource] = useState<ClipSource | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: job } = useQuery<ClipJob>({
    queryKey: ["clip-job", jobId],
    queryFn: () => apiGet<ClipJob>(`/clip/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed" ? false : 1000;
    },
  });

  const isRunning = job?.status === "queued" || job?.status === "running";
  const canExport = source && segments.length > 0 && !isRunning;

  const startCut = async () => {
    if (!source) return;
    setSubmitting(true);
    setSubmitError(null);
    setJobId(null);
    try {
      const invalid = segments.find((s) => s.end <= s.start);
      if (invalid) {
        throw new Error("存在无效片段（end ≤ start）");
      }
      const resp = await apiPost<{ job_id: string }>("/clip/cut", {
        input_path: source.file_path,
        segments,
      });
      setJobId(resp.job_id);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(150,60%,45%)]/20">
          <Film className="h-5 w-5 text-[hsl(150,60%,55%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">视频剪辑</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            上传视频 → 定义多个片段 → 自动裁剪并拼接导出
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <VideoUploader
          source={source}
          onUploaded={(s) => {
            setSource(s);
            setSegments([]);
            setJobId(null);
          }}
          onClear={() => {
            setSource(null);
            setSegments([]);
            setJobId(null);
          }}
        />

        {source && (
          <ClipTimeline
            duration={source.duration}
            segments={segments}
            onSegmentsChange={setSegments}
          />
        )}

        {source && (
          <button
            onClick={startCut}
            disabled={!canExport || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(150,60%,45%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(150,60%,50%)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {(submitting || isRunning) && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting || isRunning ? "处理中..." : "开始裁剪并导出"}
          </button>
        )}

        {submitError && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" />
            {submitError}
          </div>
        )}

        {jobId && isRunning && (
          <div className="rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[hsl(215,20%,70%)]">
              <span>处理中...</span>
              <span>{job?.progress ?? 0}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(222,47%,9%)]">
              <div
                className="h-full rounded-full bg-[hsl(150,60%,45%)] transition-all"
                style={{ width: `${job?.progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {job?.status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg bg-[hsl(0,50%,20%)] p-3 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">处理失败</div>
              <div className="mt-1 text-xs">{job.error}</div>
            </div>
          </div>
        )}

        {job?.status === "done" && job.result?.output_path && (
          <div className="rounded-xl border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,12%)] p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[hsl(150,60%,55%)]" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">导出完成</div>
                <div className="truncate text-xs text-[hsl(150,60%,75%)]">
                  {job.result.output_path} · 时长 {job.result.duration?.toFixed(1)}s
                </div>
              </div>
              <a
                href={`file://${job.result.output_path}`}
                className="flex items-center gap-1 rounded border border-[hsl(150,40%,30%)] px-2 py-1 text-xs text-[hsl(150,60%,75%)] hover:bg-[hsl(150,40%,20%)]"
              >
                <Download className="h-3 w-3" /> 打开
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
