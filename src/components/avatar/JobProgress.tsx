import { Loader2 } from "lucide-react";

export function JobProgress({
  status,
  progress,
}: {
  status: "queued" | "running" | "done" | "failed";
  progress: number;
}) {
  const stageLabel = (() => {
    if (status === "queued") return "任务排队中...";
    if (progress < 25) return "初始化任务";
    if (progress < 35) return "语音合成中";
    if (progress < 95) return "数字人视频合成中";
    return "即将完成";
  })();

  return (
    <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[hsl(210,70%,60%)]" />
          <span className="text-sm font-medium text-white">{stageLabel}</span>
        </div>
        <span className="text-sm text-[hsl(215,20%,70%)]">{progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[hsl(222,47%,9%)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[hsl(210,70%,60%)] to-[hsl(263,70%,60%)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
