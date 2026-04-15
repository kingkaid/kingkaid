import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Link2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Scissors,
  Hash,
  ShieldAlert,
  Eye,
  ThumbsUp,
  Clock,
  User,
} from "lucide-react";
import { apiGet, apiPost } from "../lib/api";
import { useAppStore } from "../stores/appStore";

interface AnalyzeJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: {
    title?: string;
    description?: string;
    tags?: string[];
    transcript?: string;
    thumbnail_url?: string;
    uploader?: string;
    upload_date?: string;
    like_count?: number | null;
    view_count?: number | null;
    duration?: number;
    source_url?: string;
  };
  error?: string | null;
}

export default function AnalyzePage() {
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { setSharedTranscript } = useAppStore();

  const { data: job } = useQuery<AnalyzeJob>({
    queryKey: ["analyze-job", jobId],
    queryFn: () => apiGet<AnalyzeJob>(`/analyze/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "done" || s === "failed" ? false : 1500;
    },
  });

  const isRunning = job?.status === "queued" || job?.status === "running";
  const hasResult = job?.status === "done" && job.result;

  const analyze = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setJobId(null);
    try {
      const resp = await apiPost<{ job_id: string }>("/analyze/video", { url: url.trim() });
      setJobId(resp.job_id);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const sendTo = (path: "/xigao" | "/title" | "/compliance") => {
    if (!job?.result?.transcript) return;
    setSharedTranscript(job.result.transcript);
    navigate({ to: path });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(195,70%,50%)]/20">
          <Search className="h-5 w-5 text-[hsl(195,70%,60%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">竞品分析</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            抖音视频 URL → 一键提取标题 / 话题 / 口播文案 / 封面
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(215,20%,45%)]" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isRunning && url.trim()) analyze();
              }}
              placeholder="粘贴抖音视频链接"
              className="w-full rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] py-2.5 pl-10 pr-3 text-sm text-white placeholder-[hsl(215,20%,35%)] focus:border-[hsl(195,70%,50%)] focus:outline-none"
            />
          </div>
          <button
            onClick={analyze}
            disabled={!url.trim() || submitting || isRunning}
            className="flex items-center gap-2 rounded-lg bg-[hsl(195,70%,50%)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[hsl(195,70%,55%)] disabled:opacity-40"
          >
            {(submitting || isRunning) && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting || isRunning ? "分析中..." : "开始分析"}
          </button>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {submitError}
          </div>
        )}

        {jobId && isRunning && (
          <div className="rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[hsl(215,20%,70%)]">
              <span>
                {(job?.progress ?? 0) < 20
                  ? "提取元数据..."
                  : (job?.progress ?? 0) < 55
                    ? "下载视频..."
                    : "语音转录..."}
              </span>
              <span>{job?.progress ?? 0}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(222,47%,9%)]">
              <div
                className="h-full bg-[hsl(195,70%,50%)] transition-all"
                style={{ width: `${job?.progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {job?.status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg bg-[hsl(0,50%,20%)] p-3 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">分析失败</div>
              <div className="mt-1 text-xs">{job.error}</div>
            </div>
          </div>
        )}

        {hasResult && (
          <>
            <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,55%)]" />
                <h3 className="text-sm font-semibold text-white">视频信息</h3>
              </div>

              {job!.result.thumbnail_url && (
                <img
                  src={job!.result.thumbnail_url}
                  alt="cover"
                  className="mb-3 max-h-48 rounded-lg object-cover"
                  loading="lazy"
                />
              )}

              <div className="mb-3">
                <div className="text-xs text-[hsl(215,20%,55%)]">标题</div>
                <div className="mt-1 text-sm leading-relaxed text-white">
                  {job!.result.title || "(无标题)"}
                </div>
              </div>

              {(job!.result.tags?.length ?? 0) > 0 && (
                <div className="mb-3">
                  <div className="mb-1 text-xs text-[hsl(215,20%,55%)]">话题标签</div>
                  <div className="flex flex-wrap gap-1">
                    {job!.result.tags!.map((t, i) => (
                      <span
                        key={i}
                        className="rounded bg-[hsl(195,70%,25%)] px-2 py-0.5 text-xs text-[hsl(195,70%,85%)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-[hsl(215,20%,70%)]">
                {job!.result.uploader && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {job!.result.uploader}
                  </div>
                )}
                {job!.result.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {job!.result.duration.toFixed(1)}s
                  </div>
                )}
                {job!.result.like_count != null && (
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" /> {job!.result.like_count}
                  </div>
                )}
                {job!.result.view_count != null && (
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {job!.result.view_count}
                  </div>
                )}
              </div>
            </div>

            {job!.result.transcript && (
              <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
                <h3 className="mb-3 text-sm font-semibold text-white">口播文案</h3>
                <div className="mb-3 max-h-64 overflow-y-auto rounded bg-[hsl(222,47%,9%)] p-3 text-sm leading-relaxed text-[hsl(215,20%,85%)] whitespace-pre-wrap">
                  {job!.result.transcript}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => sendTo("/xigao")}
                    className="flex items-center gap-1 rounded bg-[hsl(263,70%,60%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(263,70%,65%)]"
                  >
                    <Scissors className="h-3 w-3" /> 发送到洗稿
                  </button>
                  <button
                    onClick={() => sendTo("/title")}
                    className="flex items-center gap-1 rounded bg-[hsl(120,50%,45%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(120,50%,50%)]"
                  >
                    <Hash className="h-3 w-3" /> 发送到标题生成
                  </button>
                  <button
                    onClick={() => sendTo("/compliance")}
                    className="flex items-center gap-1 rounded bg-[hsl(15,70%,50%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(15,70%,55%)]"
                  >
                    <ShieldAlert className="h-3 w-3" /> 发送到违规词检测
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
