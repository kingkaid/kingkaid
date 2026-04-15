import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PictureInPicture2,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
} from "lucide-react";
import { PipCanvas, PipBox } from "../components/pip/PipCanvas";
import { apiBase, apiGet, apiPost } from "../lib/api";

interface VideoSource {
  file_path: string;
  filename: string;
  size: number;
  duration: number;
}

interface PipJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: {
    output_path?: string;
    duration?: number;
  };
  error?: string | null;
}

const DEFAULT_MAIN_WIDTH = 1920;
const DEFAULT_MAIN_HEIGHT = 1080;

export default function PipPage() {
  const [main, setMain] = useState<VideoSource | null>(null);
  const [pip, setPip] = useState<VideoSource | null>(null);
  const [pipBox, setPipBox] = useState<PipBox>({ x: 80, y: 80, w: 480, h: 270 });
  const [timeStart, setTimeStart] = useState(0);
  const [timeEnd, setTimeEnd] = useState(10);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mainInputRef = useRef<HTMLInputElement>(null);
  const pipInputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File, role: "main" | "pip"): Promise<void> => {
    const base = await apiBase();
    const form = new FormData();
    form.append("file", file);
    form.append("role", role);
    const r = await fetch(`${base}/pip/upload`, { method: "POST", body: form });
    if (!r.ok) throw new Error(`Upload failed ${r.status}`);
    const data: VideoSource = await r.json();
    if (role === "main") {
      setMain(data);
      setTimeEnd(Math.min(10, data.duration));
    } else {
      setPip(data);
    }
  };

  const { data: job } = useQuery<PipJob>({
    queryKey: ["pip-job", jobId],
    queryFn: () => apiGet<PipJob>(`/pip/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "done" || s === "failed" ? false : 1500;
    },
  });

  const isRunning = job?.status === "queued" || job?.status === "running";
  const canCompose =
    main && pip && pipBox.w > 0 && pipBox.h > 0 && timeEnd > timeStart && !isRunning;

  const startCompose = async () => {
    if (!main || !pip) return;
    setSubmitError(null);
    setJobId(null);
    try {
      const resp = await apiPost<{ job_id: string }>("/pip/compose", {
        main_path: main.file_path,
        pip_path: pip.file_path,
        x: pipBox.x,
        y: pipBox.y,
        w: pipBox.w,
        h: pipBox.h,
        start: timeStart,
        end: timeEnd,
      });
      setJobId(resp.job_id);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(180,60%,45%)]/20">
          <PictureInPicture2 className="h-5 w-5 text-[hsl(180,60%,55%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">画中画</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            在主视频上叠加 PIP 画面 · 拖拽定位 + 精确时间段控制
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <UploadCard
            title="主视频"
            source={main}
            onClick={() => mainInputRef.current?.click()}
            color="hsl(210,70%,60%)"
          />
          <UploadCard
            title="PIP 画面"
            source={pip}
            onClick={() => pipInputRef.current?.click()}
            color="hsl(180,60%,55%)"
          />
        </div>
        <input
          ref={mainInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) =>
            e.target.files?.[0] && upload(e.target.files[0], "main").catch(console.error)
          }
        />
        <input
          ref={pipInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) =>
            e.target.files?.[0] && upload(e.target.files[0], "pip").catch(console.error)
          }
        />

        {main && (
          <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <div className="mb-2 text-xs text-[hsl(215,20%,55%)]">
              拖拽 PIP 框移动 · 拖拽右下角调整大小
            </div>
            <PipCanvas
              mainWidth={DEFAULT_MAIN_WIDTH}
              mainHeight={DEFAULT_MAIN_HEIGHT}
              pipBox={pipBox}
              onChange={setPipBox}
            />
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <NumField label="X" value={pipBox.x} onChange={(v) => setPipBox({ ...pipBox, x: v })} />
              <NumField label="Y" value={pipBox.y} onChange={(v) => setPipBox({ ...pipBox, y: v })} />
              <NumField label="宽" value={pipBox.w} onChange={(v) => setPipBox({ ...pipBox, w: v })} />
              <NumField label="高" value={pipBox.h} onChange={(v) => setPipBox({ ...pipBox, h: v })} />
            </div>
          </div>
        )}

        {main && (
          <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">PIP 显示时段</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="起始 (s)"
                value={timeStart}
                step={0.1}
                onChange={setTimeStart}
              />
              <NumField label="结束 (s)" value={timeEnd} step={0.1} onChange={setTimeEnd} />
            </div>
          </div>
        )}

        <button
          onClick={startCompose}
          disabled={!canCompose}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(180,60%,45%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(180,60%,50%)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isRunning ? "合成中..." : "开始合成"}
        </button>

        {submitError && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {submitError}
          </div>
        )}

        {jobId && isRunning && (
          <div className="rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[hsl(215,20%,70%)]">
              <span>合成中...</span>
              <span>{job?.progress ?? 0}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(222,47%,9%)]">
              <div
                className="h-full bg-[hsl(180,60%,45%)] transition-all"
                style={{ width: `${job?.progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {job?.status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg bg-[hsl(0,50%,20%)] p-3 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">合成失败</div>
              <div className="mt-1 text-xs">{job.error}</div>
            </div>
          </div>
        )}

        {job?.status === "done" && job.result?.output_path && (
          <div className="rounded-xl border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,12%)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,55%)]" />
              <span className="text-sm font-medium text-white">合成完成</span>
            </div>
            <div className="mb-2 text-xs text-[hsl(150,60%,75%)]">
              时长 {job.result.duration?.toFixed(1)}s
            </div>
            <a
              href={`file://${job.result.output_path}`}
              className="flex w-fit items-center gap-1 rounded border border-[hsl(150,40%,30%)] px-2 py-1 text-xs text-[hsl(150,60%,75%)] hover:bg-[hsl(150,40%,20%)]"
            >
              <Download className="h-3 w-3" /> 打开输出
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadCard({
  title,
  source,
  onClick,
  color,
}: {
  title: string;
  source: VideoSource | null;
  onClick: () => void;
  color: string;
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4 hover:border-[hsl(217,33%,32%)]"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}22` }}
      >
        <Upload className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{title}</div>
        {source ? (
          <div className="truncate text-xs text-[hsl(215,20%,55%)]">
            {source.filename} · {source.duration.toFixed(1)}s
          </div>
        ) : (
          <div className="text-xs text-[hsl(215,20%,45%)]">点击选择视频</div>
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[hsl(215,20%,55%)]">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-2 py-1 text-white focus:border-[hsl(180,60%,45%)] focus:outline-none"
      />
    </label>
  );
}
