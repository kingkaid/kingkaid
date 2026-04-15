import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { ReferenceUploader, UploadedFile } from "../components/avatar/ReferenceUploader";
import { ScriptEditor } from "../components/avatar/ScriptEditor";
import { JobProgress } from "../components/avatar/JobProgress";
import { ResultPlayer } from "../components/avatar/ResultPlayer";
import { apiGet, apiPost } from "../lib/api";

interface AvatarJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: {
    video_url?: string;
    audio_url?: string;
    voice_id?: string;
  };
  error?: string | null;
}

export default function AvatarPage() {
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: job } = useQuery<AvatarJob>({
    queryKey: ["avatar-job", jobId],
    queryFn: () => apiGet<AvatarJob>(`/avatar/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed" ? false : 2000;
    },
  });

  const isRunning = job?.status === "queued" || job?.status === "running";
  const hasResult = job?.status === "done" && job.result?.video_url;

  const startGenerate = async () => {
    if (!voiceId || !script.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    setJobId(null);
    try {
      const resp = await apiPost<{ job_id: string }>("/avatar/generate", {
        text: script.trim(),
        voice_id: voiceId,
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
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(210,70%,60%)]/20">
          <Users className="h-5 w-5 text-[hsl(210,70%,60%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">数字人视频</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            参考视频 → HeyGem 声音克隆 + 口型同步 → 4K 数字人视频
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <ReferenceUploader
          uploaded={uploaded}
          onUploaded={(f) => {
            setUploaded(f);
            setVoiceId(null);
          }}
          onClear={() => {
            setUploaded(null);
            setVoiceId(null);
          }}
          voiceId={voiceId}
          onVoiceRegistered={setVoiceId}
        />

        <ScriptEditor value={script} onChange={setScript} disabled={isRunning} />

        <button
          onClick={startGenerate}
          disabled={!voiceId || !script.trim() || submitting || isRunning}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(210,70%,60%)] to-[hsl(263,70%,60%)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting || isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {submitting ? "提交中..." : isRunning ? "生成中..." : "开始生成数字人视频"}
        </button>

        {submitError && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" />
            {submitError}
          </div>
        )}

        {jobId && isRunning && (
          <JobProgress status={job?.status ?? "queued"} progress={job?.progress ?? 0} />
        )}

        {job?.status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg bg-[hsl(0,50%,20%)] p-3 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">生成失败</div>
              <div className="mt-1 text-xs text-[hsl(0,80%,75%)]">{job.error}</div>
            </div>
          </div>
        )}

        {hasResult && <ResultPlayer videoUrl={job!.result.video_url!} />}
      </div>
    </div>
  );
}
