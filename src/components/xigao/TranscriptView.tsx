import { FileText, Clock, Smile, Copy, Check } from "lucide-react";
import { useState } from "react";

export function TranscriptView({
  transcript,
  emotion,
  duration,
}: {
  transcript: string;
  emotion?: string | null;
  duration?: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[hsl(263,70%,60%)]" />
          <h3 className="text-sm font-semibold text-white">转录文案</h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-2 py-1 text-xs text-[hsl(215,20%,70%)] hover:text-white"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[hsl(215,20%,55%)]">
        {duration !== undefined && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {duration.toFixed(1)}s
          </span>
        )}
        {emotion && (
          <span className="flex items-center gap-1">
            <Smile className="h-3 w-3" />
            情绪: {emotion}
          </span>
        )}
      </div>

      <div className="max-h-60 overflow-y-auto rounded bg-[hsl(222,47%,9%)] p-3 text-sm leading-relaxed text-[hsl(215,20%,85%)] whitespace-pre-wrap">
        {transcript}
      </div>
    </div>
  );
}
