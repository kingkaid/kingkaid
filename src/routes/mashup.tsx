import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Shuffle, Loader2, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { CategoryGrid, Category } from "../components/mashup/CategoryGrid";
import { apiGet, apiPost } from "../lib/api";

interface MashupJob {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  result: {
    output_path?: string;
    duration?: number;
    category?: string;
    clips_used?: string[];
    clips_count?: number;
  };
  error?: string | null;
}

export default function MashupPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [count, setCount] = useState(3);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: categories, refetch: refetchCategories } = useQuery<Category[]>({
    queryKey: ["mashup-categories"],
    queryFn: () => apiGet<Category[]>("/mashup/categories"),
    refetchInterval: 10000,
  });

  const { data: job } = useQuery<MashupJob>({
    queryKey: ["mashup-job", jobId],
    queryFn: () => apiGet<MashupJob>(`/mashup/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "done" || s === "failed" ? false : 1500;
    },
  });

  const isRunning = job?.status === "queued" || job?.status === "running";
  const selectedCat = categories?.find((c) => c.name === selected);
  const canBuild = selected && (selectedCat?.count ?? 0) > 0 && !isRunning;

  const startBuild = async () => {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    setJobId(null);
    try {
      const resp = await apiPost<{ job_id: string }>("/mashup/build", {
        category: selected,
        count,
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
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(30,80%,55%)]/20">
          <Layers className="h-5 w-5 text-[hsl(30,80%,55%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">混剪视频</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            6 个类别素材库 → 随机抽取 → 自动拼接导出
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">素材库类别</h3>
          {categories ? (
            <CategoryGrid
              categories={categories}
              selected={selected}
              onSelect={setSelected}
              onUploadComplete={() => refetchCategories()}
            />
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-[hsl(215,20%,55%)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
            </div>
          )}
        </div>

        {selected && (
          <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                已选 <span className="text-[hsl(30,80%,55%)]">{selected}</span>
                <span className="ml-2 text-xs font-normal text-[hsl(215,20%,55%)]">
                  （库内 {selectedCat?.count ?? 0} 个素材）
                </span>
              </h3>
            </div>
            <label className="flex items-center gap-3">
              <span className="text-xs text-[hsl(215,20%,55%)]">随机抽取</span>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="w-20 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-2 py-1 text-sm text-white focus:border-[hsl(30,80%,55%)] focus:outline-none"
              />
              <span className="text-xs text-[hsl(215,20%,55%)]">段（1-20）</span>
            </label>
          </div>
        )}

        <button
          onClick={startBuild}
          disabled={!canBuild || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(30,80%,55%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(30,80%,60%)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting || isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shuffle className="h-4 w-4" />
          )}
          {submitting ? "提交中..." : isRunning ? "混剪中..." : "开始混剪"}
        </button>

        {submitError && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {submitError}
          </div>
        )}

        {jobId && isRunning && (
          <div className="rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-[hsl(215,20%,70%)]">
              <span>混剪中...</span>
              <span>{job?.progress ?? 0}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(222,47%,9%)]">
              <div
                className="h-full bg-[hsl(30,80%,55%)] transition-all"
                style={{ width: `${job?.progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {job?.status === "failed" && (
          <div className="flex items-start gap-2 rounded-lg bg-[hsl(0,50%,20%)] p-3 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">混剪失败</div>
              <div className="mt-1 text-xs">{job.error}</div>
            </div>
          </div>
        )}

        {job?.status === "done" && job.result?.output_path && (
          <div className="rounded-xl border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,12%)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,55%)]" />
              <span className="text-sm font-medium text-white">混剪完成</span>
            </div>
            <div className="mb-2 text-xs text-[hsl(150,60%,75%)]">
              总时长 {job.result.duration?.toFixed(1)}s · 使用 {job.result.clips_count} 段素材
            </div>
            <details className="mb-2">
              <summary className="cursor-pointer text-xs text-[hsl(150,60%,75%)]">
                查看使用的素材
              </summary>
              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs text-[hsl(150,60%,65%)]">
                {job.result.clips_used?.map((name, i) => <li key={i}>{name}</li>)}
              </ul>
            </details>
            <a
              href={`file://${job.result.output_path}`}
              className="flex w-fit items-center gap-1 rounded border border-[hsl(150,40%,30%)] px-2 py-1 text-xs text-[hsl(150,60%,75%)] hover:bg-[hsl(150,40%,20%)]"
            >
              <Download className="h-3 w-3" /> 打开输出文件
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
