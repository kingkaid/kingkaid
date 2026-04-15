import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw,
  Cpu,
  Server,
  KeyRound,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { fetchHealth } from "../lib/api";
import { useAppStore } from "../stores/appStore";

export default function SettingsPage() {
  const { licenseKey, remainingCalls, resetWizard } = useAppStore();

  const { data: health, refetch, isFetching } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 5000,
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">设置</h1>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] px-3 py-1.5 text-sm text-white hover:bg-[hsl(222,47%,18%)]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      <section className="mb-4 rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[hsl(263,70%,60%)]" />
          <h2 className="text-sm font-semibold text-white">许可证</h2>
        </div>
        {licenseKey ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(215,20%,55%)]">密钥</span>
              <span className="font-mono text-white">{licenseKey}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(215,20%,55%)]">剩余调用次数（本月）</span>
              <span className="text-white">{remainingCalls}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[hsl(215,20%,55%)]">未激活</div>
        )}
      </section>

      <section className="mb-4 rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-[hsl(150,60%,55%)]" />
          <h2 className="text-sm font-semibold text-white">服务状态</h2>
        </div>
        <div className="space-y-2 text-sm">
          <StatusRow
            label="Python Sidecar"
            value={health?.sidecar || "loading..."}
            ok={health?.sidecar === "ok"}
          />
          <StatusRow
            label="SenseVoice ASR"
            value={health?.sensevoice || "loading..."}
            ok={health?.sensevoice === "loaded"}
            warn={health?.sensevoice === "not-loaded"}
          />
          <StatusRow
            label="HeyGem Docker"
            value={health?.heygem || "loading..."}
            ok={health?.heygem === "running"}
          />
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-[hsl(30,80%,55%)]" />
          <h2 className="text-sm font-semibold text-white">系统信息</h2>
        </div>
        <div className="text-sm text-[hsl(215,20%,55%)]">
          GPU 信息需通过 `nvidia-smi` 命令查看。
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-[hsl(0,40%,35%)] bg-[hsl(0,30%,15%)] p-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[hsl(0,80%,85%)]">危险操作</h2>
        </div>
        <button
          onClick={resetWizard}
          className="rounded-lg bg-[hsl(0,63%,50%)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[hsl(0,63%,55%)]"
        >
          重置应用（清除许可证）
        </button>
      </section>
    </div>
  );
}

function StatusRow({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  const color = ok
    ? "text-[hsl(150,60%,55%)]"
    : warn
    ? "text-[hsl(45,80%,55%)]"
    : "text-[hsl(0,65%,60%)]";
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="flex justify-between">
      <span className="text-[hsl(215,20%,55%)]">{label}</span>
      <span className={`flex items-center gap-1.5 ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {value}
      </span>
    </div>
  );
}
