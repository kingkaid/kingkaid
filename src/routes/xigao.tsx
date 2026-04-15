import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scissors, AlertCircle } from "lucide-react";
import { UrlInput } from "../components/xigao/UrlInput";
import { TranscriptView } from "../components/xigao/TranscriptView";
import { RewriteStream } from "../components/xigao/RewriteStream";
import { apiPost, apiGet } from "../lib/api";
import { useAppStore } from "../stores/appStore";

interface TranscribeJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: {
    transcript?: string;
    emotion?: string | null;
    duration?: number;
  };
  error?: string | null;
}

export default function XigaoPage() {
  const shared = useAppStore((s) => s.sharedTranscript);
  const clearShared = useAppStore((s) => s.setSharedTranscript);
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [directTranscript, setDirectTranscript] = useState<string | null>(null);

  useEffect(() => {
    if (shared) {
      setDirectTranscript(shared);
      setJobId(null);
      clearShared(null);
    }
  }, [shared, clearShared]);

  const { data: job } = useQuery<TranscribeJob>({
    queryKey: ["transcribe-job", jobId],
    queryFn: () => apiGet<TranscribeJob>(`/transcribe/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed" ? false : 1500;
    },
  });

  const startTranscribe = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setJobId(null);
    try {
      const resp = await apiPost<{ job_id: string }>("/transcribe", { url: url.trim() });
      setJobId(resp.job_id);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const isRunning = job?.status === "queued" || job?.status === "running";
  const hasTranscript = job?.status === "done" && job.result?.transcript;
  const effectiveTranscript = directTranscript || (hasTranscript ? job!.result.transcript! : null);
  const effectiveEmotion = hasTranscript ? job?.result?.emotion : null;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(263,70%,60%)]/20">
          <Scissors className="h-5 w-5 text-[hsl(263,70%,60%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">口播文案 · 洗稿</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            抖音视频 → SenseVoice 本地转录 → Claude AI 改写
          </p>
        </div>
      </div>

      <div className="mb-4">
        <UrlInput
          value={url}
          onChange={setUrl}
          onSubmit={startTranscribe}
          loading={submitting || isRunning}
        />
      </div>

      {submitError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
          <AlertCircle className="h-4 w-4" />
          {submitError}
        </div>
      )}

      {jobId && isRunning && (
        <div className="mb-4 rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-[hsl(215,20%,70%)]">
            <span>{job?.status === "queued" ? "排队中..." : "处理中..."}</span>
            <span>{job?.progress ?? 0}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(222,47%,9%)]">
            <div
              className="h-full rounded-full bg-[hsl(263,70%,60%)] transition-all"
              style={{ width: `${job?.progress ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-[hsl(0,50%,20%)] p-3 text-sm text-[hsl(0,80%,85%)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">转录失败</div>
            <div className="mt-1 text-xs text-[hsl(0,80%,75%)]">{job.error}</div>
          </div>
        </div>
      )}

      {effectiveTranscript && (
        <div className="space-y-4">
          <TranscriptView
            transcript={effectiveTranscript}
            emotion={effectiveEmotion}
            duration={hasTranscript ? job?.result?.duration : undefined}
          />
          <RewriteStream transcript={effectiveTranscript} emotion={effectiveEmotion} />
        </div>
      )}
    </div>
  );
}
