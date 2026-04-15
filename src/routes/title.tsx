import { useState, useEffect } from "react";
import { Hash, Loader2, AlertCircle, Copy, Check } from "lucide-react";
import { apiBase } from "../lib/api";
import { useAppStore } from "../stores/appStore";

export default function TitlePage() {
  const shared = useAppStore((s) => s.sharedTranscript);
  const clearShared = useAppStore((s) => s.setSharedTranscript);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    if (shared) {
      setTranscript(shared);
      clearShared(null);
    }
  }, [shared, clearShared]);
  const [count, setCount] = useState(10);
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const licenseKey = useAppStore((s) => s.licenseKey);
  const deviceFingerprint = useAppStore((s) => s.deviceFingerprint);

  const startGenerate = async () => {
    if (!licenseKey || !deviceFingerprint) {
      setError("请先在设置页激活许可证");
      return;
    }
    setOutput("");
    setError(null);
    setStreaming(true);

    try {
      const base = await apiBase();
      const resp = await fetch(`${base}/title/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          count,
          license_key: licenseKey,
          device_fingerprint: deviceFingerprint,
        }),
      });
      if (!resp.ok || !resp.body) {
        setError(`HTTP ${resp.status}`);
        setStreaming(false);
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: error")) continue;
          if (line.startsWith("data: [DONE]")) {
            setStreaming(false);
            return;
          }
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6).replace(/\\n/g, "\n");
            setOutput((p) => p + chunk);
          }
        }
      }
      setStreaming(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Stream failed");
      setStreaming(false);
    }
  };

  const titles = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line));

  const copyTitle = async (idx: number, text: string) => {
    await navigator.clipboard.writeText(text.replace(/^\d+\.\s*/, ""));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(120,50%,45%)]/20">
          <Hash className="h-5 w-5 text-[hsl(120,50%,65%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">标题话题</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            AI 生成爆款标题 + 话题标签（流式输出）
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <label className="mb-2 block text-xs text-[hsl(215,20%,55%)]">口播文案</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value.slice(0, 2000))}
            placeholder="粘贴或输入视频文案，AI 会据此生成候选标题..."
            rows={6}
            className="w-full resize-none rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] p-3 text-sm text-white focus:border-[hsl(120,50%,45%)] focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[hsl(215,20%,55%)]">
              生成
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="w-16 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-2 py-1 text-white focus:border-[hsl(120,50%,45%)] focus:outline-none"
              />
              条候选
            </label>
          </div>
        </div>

        <button
          onClick={startGenerate}
          disabled={!transcript.trim() || streaming}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(120,50%,45%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(120,50%,50%)] disabled:opacity-40"
        >
          {streaming && <Loader2 className="h-4 w-4 animate-spin" />}
          {streaming ? "生成中..." : "生成标题"}
        </button>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {(titles.length > 0 || streaming) && (
          <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">
              候选标题{titles.length > 0 && ` (${titles.length})`}
            </h3>
            <div className="space-y-2">
              {titles.map((line, idx) => (
                <div
                  key={idx}
                  className="group flex items-start gap-2 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] p-3"
                >
                  <div className="min-w-0 flex-1 text-sm leading-relaxed text-[hsl(215,20%,85%)]">
                    {line}
                  </div>
                  <button
                    onClick={() => copyTitle(idx, line)}
                    className="shrink-0 rounded p-1 text-[hsl(215,20%,45%)] opacity-0 hover:text-white group-hover:opacity-100"
                  >
                    {copiedIdx === idx ? (
                      <Check className="h-3.5 w-3.5 text-[hsl(150,60%,55%)]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
              {streaming && titles.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-[hsl(215,20%,55%)]">
                  <Loader2 className="h-3 w-3 animate-spin" /> 等待流式响应...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
