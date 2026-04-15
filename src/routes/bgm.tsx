import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Music,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  FileVideo,
  PlayCircle,
} from "lucide-react";
import { apiBase, apiGet, apiPost } from "../lib/api";

interface BgmTrack {
  path: string;
  filename: string;
  size: number;
}

interface VideoSource {
  file_path: string;
  filename: string;
  duration: number;
}

interface MixJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: {
    output_path?: string;
    duration?: number;
  };
  error?: string | null;
}

export default function BgmPage() {
  const [video, setVideo] = useState<VideoSource | null>(null);
  const [bgm, setBgm] = useState<BgmTrack | null>(null);
  const [volume, setVolume] = useState(0.4);
  const [fadeIn, setFadeIn] = useState(1.0);
  const [fadeOut, setFadeOut] = useState(1.5);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const bgmInputRef = useRef<HTMLInputElement>(null);

  const { data: library, refetch: refetchLibrary } = useQuery<BgmTrack[]>({
    queryKey: ["bgm-library"],
    queryFn: () => apiGet<BgmTrack[]>("/bgm/library"),
    refetchInterval: 10000,
  });

  const { data: job } = useQuery<MixJob>({
    queryKey: ["bgm-job", jobId],
    queryFn: () => apiGet<MixJob>(`/bgm/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "done" || s === "failed" ? false : 1500;
    },
  });

  const isRunning = job?.status === "queued" || job?.status === "running";

  const uploadVideo = async (f: File) => {
    try {
      const base = await apiBase();
      const form = new FormData();
      form.append("file", f);
      form.append("session_id", "bgm");
      const r = await fetch(`${base}/bgm/upload_video`, { method: "POST", body: form });
      if (!r.ok) throw new Error(`Upload failed ${r.status}`);
      setVideo(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const uploadBgm = async (f: File) => {
    try {
      const base = await apiBase();
      const form = new FormData();
      form.append("file", f);
      const r = await fetch(`${base}/bgm/upload`, { method: "POST", body: form });
      if (!r.ok) throw new Error(`Upload failed ${r.status}`);
      await refetchLibrary();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const startMix = async () => {
    if (!video || !bgm) return;
    setJobId(null);
    setError(null);
    try {
      const resp = await apiPost<{ job_id: string }>("/bgm/mix", {
        video_path: video.file_path,
        bgm_path: bgm.path,
        bgm_volume: volume,
        fade_in: fadeIn,
        fade_out: fadeOut,
      });
      setJobId(resp.job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submit failed");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(263,50%,50%)]/20">
          <Music className="h-5 w-5 text-[hsl(263,50%,70%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">背景音乐</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            为视频添加 BGM · 音量混音 · 淡入淡出
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
        />
        <input
          ref={bgmInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadBgm(e.target.files[0])}
        />

        <div
          onClick={() => !video && videoInputRef.current?.click()}
          className={`rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4 ${
            video ? "" : "cursor-pointer border-dashed hover:border-[hsl(217,33%,32%)]"
          }`}
        >
          <div className="flex items-center gap-3">
            <FileVideo className="h-5 w-5 text-[hsl(210,70%,60%)]" />
            {video ? (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{video.filename}</div>
                  <div className="text-xs text-[hsl(215,20%,55%)]">
                    时长 {video.duration.toFixed(1)}s
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideo(null);
                  }}
                  className="text-xs text-[hsl(215,20%,55%)] hover:text-white"
                >
                  更换
                </button>
              </>
            ) : (
              <div className="flex-1">
                <div className="text-sm font-medium text-white">选择视频</div>
                <div className="text-xs text-[hsl(215,20%,55%)]">点击选择要混入 BGM 的视频</div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">BGM 素材库</h3>
            <button
              onClick={() => bgmInputRef.current?.click()}
              className="flex items-center gap-1 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-2 py-1 text-xs text-white hover:bg-[hsl(222,47%,12%)]"
            >
              <Upload className="h-3 w-3" /> 添加曲目
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {library && library.length > 0 ? (
              <div className="space-y-1">
                {library.map((t) => (
                  <button
                    key={t.path}
                    onClick={() => setBgm(t)}
                    className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs transition-colors ${
                      bgm?.path === t.path
                        ? "bg-[hsl(263,50%,30%)] text-white"
                        : "bg-[hsl(222,47%,9%)] text-[hsl(215,20%,70%)] hover:bg-[hsl(222,47%,11%)]"
                    }`}
                  >
                    <PlayCircle className="h-3 w-3 shrink-0 text-[hsl(263,50%,70%)]" />
                    <span className="flex-1 truncate">{t.filename}</span>
                    <span className="text-[10px] text-[hsl(215,20%,45%)]">
                      {(t.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[hsl(217,33%,22%)] p-4 text-center text-xs text-[hsl(215,20%,45%)]">
                BGM 库为空。点击右上角"添加曲目"上传素材。
              </div>
            )}
          </div>
        </div>

        {video && bgm && (
          <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">混音参数</h3>
            <div className="space-y-3">
              <SliderRow
                label="BGM 音量"
                value={volume}
                min={0}
                max={2}
                step={0.05}
                suffix={`${(volume * 100).toFixed(0)}%`}
                onChange={setVolume}
              />
              <SliderRow
                label="淡入"
                value={fadeIn}
                min={0}
                max={5}
                step={0.1}
                suffix={`${fadeIn.toFixed(1)}s`}
                onChange={setFadeIn}
              />
              <SliderRow
                label="淡出"
                value={fadeOut}
                min={0}
                max={5}
                step={0.1}
                suffix={`${fadeOut.toFixed(1)}s`}
                onChange={setFadeOut}
              />
            </div>
          </div>
        )}

        <button
          onClick={startMix}
          disabled={!video || !bgm || isRunning}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(263,50%,50%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(263,50%,55%)] disabled:opacity-40"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
          {isRunning ? "混音中..." : "开始混音"}
        </button>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {jobId && isRunning && (
          <div className="rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[hsl(215,20%,70%)]">
              <span>混音中...</span>
              <span>{job?.progress ?? 0}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(222,47%,9%)]">
              <div
                className="h-full bg-[hsl(263,50%,50%)] transition-all"
                style={{ width: `${job?.progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {job?.status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg bg-[hsl(0,50%,20%)] p-3 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">混音失败</div>
              <div className="mt-1 text-xs">{job.error}</div>
            </div>
          </div>
        )}

        {job?.status === "done" && job.result?.output_path && (
          <div className="rounded-xl border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,12%)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,55%)]" />
              <span className="text-sm font-medium text-white">
                混音完成 · {job.result.duration?.toFixed(1)}s
              </span>
            </div>
            <a
              href={`file://${job.result.output_path}`}
              className="flex w-fit items-center gap-1 rounded border border-[hsl(150,40%,30%)] px-2 py-1 text-xs text-[hsl(150,60%,75%)] hover:bg-[hsl(150,40%,20%)]"
            >
              <Download className="h-3 w-3" /> 打开文件
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[hsl(215,20%,70%)]">{label}</span>
        <span className="text-white">{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[hsl(263,50%,60%)]"
      />
    </div>
  );
}
