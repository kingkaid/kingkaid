import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, AlertCircle } from "lucide-react";
import { apiBase } from "../../lib/api";
import { useAppStore } from "../../stores/appStore";

const STYLES = [
  { value: "自然流畅", label: "自然流畅" },
  { value: "幽默风趣", label: "幽默风趣" },
  { value: "专业严谨", label: "专业严谨" },
  { value: "激情澎湃", label: "激情澎湃" },
  { value: "平淡叙事", label: "平淡叙事" },
];

export function RewriteStream({
  transcript,
  emotion,
}: {
  transcript: string;
  emotion?: string | null;
}) {
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState("自然流畅");
  const [copied, setCopied] = useState(false);

  const { licenseKey, deviceFingerprint } = useAppStore();

  const startRewrite = async () => {
    if (!licenseKey || !deviceFingerprint) {
      setError("请先在设置页激活许可证");
      return;
    }

    setOutput("");
    setError(null);
    setStreaming(true);

    try {
      const base = await apiBase();
      const resp = await fetch(`${base}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          style,
          emotion,
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

        // Parse SSE lines. Each event: "data: ...\n\n"
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: error")) {
            // next line is data
            continue;
          }
          if (line.startsWith("data: [DONE]")) {
            setStreaming(false);
            return;
          }
          if (line.startsWith("data: ")) {
            const chunk = line.slice(6).replace(/\\n/g, "\n");
            setOutput((prev) => prev + chunk);
          }
        }
      }
      setStreaming(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Network error");
      setStreaming(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[hsl(45,80%,55%)]" />
          <h3 className="text-sm font-semibold text-white">AI 洗稿</h3>
        </div>
        {output && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-2 py-1 text-xs text-[hsl(215,20%,70%)] hover:text-white"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "已复制" : "复制"}
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-[hsl(215,20%,55%)]">风格</label>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          disabled={streaming}
          className="rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-2 py-1 text-xs text-white focus:border-[hsl(263,70%,60%)] focus:outline-none disabled:opacity-50"
        >
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={startRewrite}
          disabled={streaming}
          className="ml-auto flex items-center gap-1.5 rounded bg-[hsl(45,80%,55%)] px-3 py-1 text-xs font-medium text-[hsl(222,47%,9%)] hover:bg-[hsl(45,80%,60%)] disabled:opacity-40"
        >
          {streaming && <Loader2 className="h-3 w-3 animate-spin" />}
          {streaming ? "生成中..." : "开始洗稿"}
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded bg-[hsl(0,50%,20%)] px-3 py-2 text-xs text-[hsl(0,80%,85%)]">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="min-h-[120px] max-h-80 overflow-y-auto rounded bg-[hsl(222,47%,9%)] p-3 text-sm leading-relaxed text-[hsl(215,20%,85%)] whitespace-pre-wrap">
        {output || (
          <span className="text-[hsl(215,20%,35%)]">点击「开始洗稿」生成改写文案...</span>
        )}
      </div>
    </div>
  );
}
