import { Link2, Loader2 } from "lucide-react";

export function UrlInput({
  value,
  onChange,
  onSubmit,
  loading,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(215,20%,45%)]" />
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading && !disabled && value.trim()) {
              onSubmit();
            }
          }}
          placeholder="粘贴抖音视频链接（https://v.douyin.com/... 或 https://www.douyin.com/video/...）"
          disabled={disabled}
          className="w-full rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] py-2.5 pl-10 pr-3 text-sm text-white placeholder-[hsl(215,20%,35%)] focus:border-[hsl(263,70%,60%)] focus:outline-none disabled:opacity-50"
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={loading || !value.trim() || disabled}
        className="flex items-center gap-2 rounded-lg bg-[hsl(263,70%,60%)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(263,70%,65%)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "转录中..." : "开始转录"}
      </button>
    </div>
  );
}
