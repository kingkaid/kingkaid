import { useState } from "react";
import {
  ShieldCheck,
  Monitor,
  KeyRound,
  Download,
  Server,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { getDeviceFingerprint, checkDocker } from "../../lib/tauri";
import { fetchHealth } from "../../lib/api";
import { cn } from "../../lib/cn";

const STEPS = [
  { key: "disclaimer", icon: ShieldCheck, label: "声明" },
  { key: "system", icon: Monitor, label: "系统检查" },
  { key: "license", icon: KeyRound, label: "许可证" },
  { key: "model", icon: Download, label: "模型下载" },
  { key: "heygem", icon: Server, label: "数字人服务" },
] as const;

export function SetupWizard() {
  const { wizardStep, setWizardStep, completeWizard, setLicense } = useAppStore();
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(false);

  const currentStepIdx = STEPS.findIndex((s) => s.key === wizardStep);

  const goNext = () => {
    const next = STEPS[currentStepIdx + 1];
    if (next) {
      setWizardStep(next.key);
    } else {
      completeWizard();
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[hsl(222,47%,9%)] p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] shadow-2xl">
        {/* Step indicator */}
        <div className="flex items-center justify-between border-b border-[hsl(217,33%,22%)] px-8 py-5">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStepIdx;
            const isDone = idx < currentStepIdx;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                    isActive
                      ? "bg-[hsl(263,70%,60%)] text-white"
                      : isDone
                      ? "bg-[hsl(150,60%,45%)] text-white"
                      : "bg-[hsl(217,33%,22%)] text-[hsl(215,20%,55%)]"
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    isActive ? "text-white" : "text-[hsl(215,20%,55%)]"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step body */}
        <div className="min-h-[280px] p-8">
          {wizardStep === "disclaimer" && (
            <DisclaimerStep
              agreed={disclaimerAgreed}
              onChange={setDisclaimerAgreed}
              onNext={goNext}
            />
          )}
          {wizardStep === "system" && <SystemCheckStep onNext={goNext} />}
          {wizardStep === "license" && (
            <LicenseStep
              onActivated={(key, fp, remaining) => {
                setLicense(key, fp, remaining);
                goNext();
              }}
            />
          )}
          {wizardStep === "model" && <ModelDownloadStep onNext={goNext} />}
          {wizardStep === "heygem" && <HeyGemStep onNext={goNext} />}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Step 1: Disclaimer
// =========================================================================
function DisclaimerStep({
  agreed,
  onChange,
  onNext,
}: {
  agreed: boolean;
  onChange: (v: boolean) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold text-white">使用免责声明</h2>
      <div className="mb-6 space-y-3 text-sm leading-relaxed text-[hsl(215,20%,70%)]">
        <p>KingKaid 是一款短视频创作辅助工具。使用前请确认：</p>
        <ul className="space-y-2 pl-5">
          <li className="list-disc">本工具仅供用户处理<strong className="text-white">自有或已获授权</strong>的内容。</li>
          <li className="list-disc">不得用于侵犯他人版权、肖像权或隐私权。</li>
          <li className="list-disc">生成内容的合规性由用户自行负责，请遵守当地法律法规及抖音平台政策。</li>
          <li className="list-disc">数字人视频严禁用于伪造、诈骗、名誉损害等不当用途。</li>
        </ul>
      </div>
      <label className="mb-6 flex items-center gap-2 text-sm text-[hsl(215,20%,80%)]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)]"
        />
        我已阅读并同意上述声明
      </label>
      <WizardButton disabled={!agreed} onClick={onNext}>
        同意并继续
      </WizardButton>
    </div>
  );
}

// =========================================================================
// Step 2: System check
// =========================================================================
function SystemCheckStep({ onNext }: { onNext: () => void }) {
  const [checks, setChecks] = useState<{
    sidecar: "pending" | "ok" | "fail";
    docker: "pending" | "ok" | "fail";
    gpu: "pending" | "ok" | "warn";
  }>({ sidecar: "pending", docker: "pending", gpu: "pending" });

  const [checking, setChecking] = useState(false);

  const runChecks = async () => {
    setChecking(true);
    const next = { ...checks };

    try {
      const health = await fetchHealth();
      next.sidecar = health.sidecar === "ok" ? "ok" : "fail";
    } catch {
      next.sidecar = "fail";
    }

    try {
      next.docker = (await checkDocker()) ? "ok" : "fail";
    } catch {
      next.docker = "fail";
    }

    // GPU check is informational (can't detect reliably from webview)
    next.gpu = "warn";

    setChecks(next);
    setChecking(false);
  };

  const allPassed = checks.sidecar === "ok";

  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold text-white">系统环境检查</h2>
      <p className="mb-6 text-sm text-[hsl(215,20%,70%)]">
        确认运行所需的组件是否就绪。
      </p>

      <div className="mb-6 space-y-3">
        <CheckItem
          label="Python Sidecar 服务"
          state={checks.sidecar}
          hint="本地 FastAPI 服务，处理 AI 推理"
        />
        <CheckItem
          label="Docker + NVIDIA Container"
          state={checks.docker}
          hint="用于运行 HeyGem 数字人服务（可稍后安装）"
        />
        <CheckItem
          label="NVIDIA GPU (CUDA 12.1+)"
          state={checks.gpu}
          hint="需手动确认。SenseVoice 和 HeyGem 需要 GPU"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={runChecks}
          disabled={checking}
          className="flex-1 rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(217,33%,22%)] disabled:opacity-50"
        >
          {checking ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> 检查中...
            </span>
          ) : (
            "开始检查"
          )}
        </button>
        <WizardButton disabled={!allPassed} onClick={onNext}>
          继续
        </WizardButton>
      </div>
    </div>
  );
}

function CheckItem({
  label,
  state,
  hint,
}: {
  label: string;
  state: "pending" | "ok" | "fail" | "warn";
  hint: string;
}) {
  const icon = {
    pending: <span className="h-4 w-4 rounded-full border-2 border-[hsl(217,33%,35%)]" />,
    ok: <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,55%)]" />,
    fail: <AlertCircle className="h-4 w-4 text-[hsl(0,65%,60%)]" />,
    warn: <AlertCircle className="h-4 w-4 text-[hsl(45,80%,55%)]" />,
  }[state];
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-4 py-3">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-[hsl(215,20%,55%)]">{hint}</div>
      </div>
    </div>
  );
}

// =========================================================================
// Step 3: License activation
// =========================================================================
function LicenseStep({
  onActivated,
}: {
  onActivated: (key: string, fp: string, remaining: number) => void;
}) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = async () => {
    setLoading(true);
    setError(null);
    try {
      const fp = await getDeviceFingerprint();
      // Call cloud directly in dev. In production this routes through sidecar.
      const cloudBase = "http://127.0.0.1:8090";
      const r = await fetch(`${cloudBase}/license/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: key.trim(), device_fingerprint: fp }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.detail || `HTTP ${r.status}`);
      } else {
        onActivated(key.trim(), fp, data.remaining_calls);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold text-white">许可证激活</h2>
      <p className="mb-6 text-sm text-[hsl(215,20%,70%)]">
        请输入您购买时获得的许可证密钥。
      </p>

      <input
        type="text"
        placeholder="SVTOOL-XXXX-XXXX-XXXX-XXXX"
        value={key}
        onChange={(e) => setKey(e.target.value.toUpperCase())}
        className="mb-3 w-full rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-4 py-3 font-mono text-sm text-white placeholder-[hsl(215,20%,35%)] focus:border-[hsl(263,70%,60%)] focus:outline-none"
      />

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <WizardButton disabled={!key || loading} onClick={activate}>
        {loading ? "激活中..." : "激活并继续"}
      </WizardButton>
    </div>
  );
}

// =========================================================================
// Step 4: Model download
// =========================================================================
function ModelDownloadStep({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold text-white">下载 AI 模型</h2>
      <p className="mb-6 text-sm text-[hsl(215,20%,70%)]">
        SenseVoice Small（~900MB）将在首次使用语音转录时自动下载到本地缓存。
      </p>
      <div className="mb-6 rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white">SenseVoice Small</span>
          <span className="text-[hsl(215,20%,55%)]">按需下载</span>
        </div>
        <div className="mt-2 text-xs text-[hsl(215,20%,55%)]">
          中文口语识别专用模型，比 Whisper-large 快 15 倍
        </div>
      </div>
      <WizardButton onClick={onNext}>跳过并继续</WizardButton>
    </div>
  );
}

// =========================================================================
// Step 5: HeyGem
// =========================================================================
function HeyGemStep({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold text-white">数字人服务（可选）</h2>
      <p className="mb-6 text-sm text-[hsl(215,20%,70%)]">
        HeyGem Docker 镜像（~15GB）用于生成数字人视频。可稍后在设置页安装。
      </p>
      <div className="mb-6 rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] p-4">
        <div className="text-sm text-white">HeyGem (Duix.Avatar)</div>
        <div className="mt-1 text-xs text-[hsl(215,20%,55%)]">
          TTS + 口型同步，4K 数字人视频生成
        </div>
      </div>
      <WizardButton onClick={onNext}>完成设置</WizardButton>
    </div>
  );
}

// =========================================================================
// Reusable button
// =========================================================================
function WizardButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex-1 rounded-lg bg-[hsl(263,70%,60%)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(263,70%,65%)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
