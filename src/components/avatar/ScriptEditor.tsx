import { FileText } from "lucide-react";

export function ScriptEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const count = value.length;
  return (
    <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[hsl(210,70%,60%)]" />
          <h3 className="text-sm font-semibold text-white">口播文案</h3>
        </div>
        <span className="text-xs text-[hsl(215,20%,55%)]">{count} / 5000</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 5000))}
        placeholder="请输入要让数字人说的文字内容..."
        rows={6}
        disabled={disabled}
        className="w-full resize-none rounded-lg border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] p-3 text-sm leading-relaxed text-white placeholder-[hsl(215,20%,35%)] focus:border-[hsl(210,70%,60%)] focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
