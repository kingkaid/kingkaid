import { useState, useMemo } from "react";
import { ShieldAlert, Loader2, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiPost } from "../lib/api";

interface FlaggedWord {
  word: string;
  category: string;
  start: number;
  end: number;
}

interface CheckResponse {
  risk_level: "safe" | "warning" | "high";
  flagged_words: FlaggedWord[];
  suggestion: string;
  total_categories: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  medical: "医疗",
  absolute: "极限词",
  finance: "金融承诺",
  gambling: "赌博",
  sensitive: "敏感词",
};

const LEVEL_META = {
  safe: {
    color: "hsl(150,60%,55%)",
    bg: "hsl(150,40%,12%)",
    border: "hsl(150,40%,30%)",
    icon: CheckCircle2,
    label: "安全",
  },
  warning: {
    color: "hsl(45,80%,55%)",
    bg: "hsl(45,40%,12%)",
    border: "hsl(45,40%,30%)",
    icon: AlertTriangle,
    label: "警告",
  },
  high: {
    color: "hsl(0,65%,60%)",
    bg: "hsl(0,40%,12%)",
    border: "hsl(0,40%,30%)",
    icon: AlertCircle,
    label: "高风险",
  },
} as const;

export default function CompliancePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const resp = await apiPost<CheckResponse>("/compliance/check", { text });
      setResult(resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setChecking(false);
    }
  };

  const highlighted = useMemo(() => {
    if (!result || result.flagged_words.length === 0) return null;
    const sorted = [...result.flagged_words].sort((a, b) => a.start - b.start);
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    sorted.forEach((f, i) => {
      if (f.start > cursor) parts.push(text.slice(cursor, f.start));
      parts.push(
        <mark
          key={i}
          className="rounded bg-[hsl(0,65%,40%)] px-0.5 text-white"
          title={CATEGORY_LABELS[f.category] || f.category}
        >
          {text.slice(f.start, f.end)}
        </mark>
      );
      cursor = f.end;
    });
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
  }, [result, text]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(15,70%,50%)]/20">
          <ShieldAlert className="h-5 w-5 text-[hsl(15,70%,60%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">违规词检测</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            本地词库匹配 · 识别极限词 / 医疗 / 金融承诺等风险内容
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <label className="mb-2 block text-xs text-[hsl(215,20%,55%)]">待检测文案</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 10000))}
            placeholder="粘贴或输入需要检测的文案..."
            rows={8}
            className="w-full resize-none rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] p-3 text-sm leading-relaxed text-white focus:border-[hsl(15,70%,50%)] focus:outline-none"
          />
          <div className="mt-2 text-right text-xs text-[hsl(215,20%,55%)]">
            {text.length} / 10000
          </div>
        </div>

        <button
          onClick={check}
          disabled={!text.trim() || checking}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(15,70%,50%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(15,70%,55%)] disabled:opacity-40"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          {checking ? "检测中..." : "开始检测"}
        </button>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {result && (
          <>
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: LEVEL_META[result.risk_level].border,
                backgroundColor: LEVEL_META[result.risk_level].bg,
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                {(() => {
                  const Icon = LEVEL_META[result.risk_level].icon;
                  return (
                    <Icon className="h-5 w-5" style={{ color: LEVEL_META[result.risk_level].color }} />
                  );
                })()}
                <span
                  className="text-base font-semibold"
                  style={{ color: LEVEL_META[result.risk_level].color }}
                >
                  {LEVEL_META[result.risk_level].label}
                </span>
                <span className="ml-auto text-xs text-[hsl(215,20%,70%)]">
                  命中 {result.flagged_words.length} 处 · {result.total_categories.length} 类
                </span>
              </div>
              {result.suggestion && (
                <div className="text-sm leading-relaxed text-[hsl(215,20%,85%)]">
                  {result.suggestion}
                </div>
              )}
            </div>

            {highlighted && (
              <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
                <h3 className="mb-3 text-sm font-semibold text-white">命中高亮</h3>
                <div className="rounded bg-[hsl(222,47%,9%)] p-3 text-sm leading-relaxed text-[hsl(215,20%,85%)] whitespace-pre-wrap">
                  {highlighted}
                </div>
                <h4 className="mt-4 mb-2 text-xs font-semibold text-[hsl(215,20%,70%)]">分类汇总</h4>
                <div className="flex flex-wrap gap-2">
                  {result.flagged_words.map((f, i) => (
                    <span
                      key={i}
                      className="rounded border border-[hsl(0,40%,30%)] bg-[hsl(0,40%,15%)] px-2 py-0.5 text-xs text-[hsl(0,80%,85%)]"
                    >
                      {CATEGORY_LABELS[f.category] || f.category} · {f.word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
