import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ImageIcon,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
} from "lucide-react";
import { apiBase, apiGet, apiPost } from "../lib/api";

interface Template {
  id: number;
  name: string;
  description: string;
  thumbnail_b64: string;
}

interface GenerateResponse {
  cover_path: string;
  template_id: number;
  size_bytes: number;
}

export default function CoverPage() {
  const [selected, setSelected] = useState<number>(1);
  const [title, setTitle] = useState("爆款标题在这里");
  const [subtitle, setSubtitle] = useState("副标题补充说明");
  const [bgPath, setBgPath] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: templates } = useQuery<Template[]>({
    queryKey: ["cover-templates"],
    queryFn: () => apiGet<Template[]>("/cover/templates"),
    staleTime: 1000 * 60 * 60,
  });

  const uploadBackground = async (file: File) => {
    try {
      const base = await apiBase();
      const form = new FormData();
      form.append("file", file);
      form.append("session_id", "cover");
      const r = await fetch(`${base}/cover/upload`, { method: "POST", body: form });
      if (!r.ok) throw new Error(`Upload failed ${r.status}`);
      const data = await r.json();
      setBgPath(data.file_path);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const resp = await apiPost<GenerateResponse>("/cover/generate", {
        template_id: selected,
        title,
        subtitle,
        background_path: bgPath,
      });
      setResult(resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(45,80%,55%)]/20">
          <ImageIcon className="h-5 w-5 text-[hsl(45,80%,55%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">封面制作</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            9 款专业模板 · 标题文字叠加 · 一键导出 PNG
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">选择模板</h3>
          {templates ? (
            <div className="grid grid-cols-3 gap-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setSelected(tpl.id)}
                  className={`cursor-pointer overflow-hidden rounded-lg border-2 transition ${
                    selected === tpl.id
                      ? "border-[hsl(45,80%,55%)]"
                      : "border-[hsl(217,33%,22%)] hover:border-[hsl(217,33%,32%)]"
                  }`}
                >
                  <img
                    src={`data:image/png;base64,${tpl.thumbnail_b64}`}
                    alt={tpl.name}
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <div className="bg-[hsl(222,47%,9%)] px-2 py-1.5">
                    <div className="text-xs font-medium text-white">
                      {tpl.id}. {tpl.name}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-[hsl(215,20%,55%)]">
                      {tpl.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-6 text-sm text-[hsl(215,20%,55%)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载模板...
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">文字内容</h3>
          <label className="mb-3 block">
            <div className="mb-1 text-xs text-[hsl(215,20%,55%)]">主标题（最多 40 字）</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 40))}
              className="w-full rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-3 py-2 text-sm text-white focus:border-[hsl(45,80%,55%)] focus:outline-none"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs text-[hsl(215,20%,55%)]">副标题（可选，最多 30 字）</div>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value.slice(0, 30))}
              className="w-full rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-3 py-2 text-sm text-white focus:border-[hsl(45,80%,55%)] focus:outline-none"
            />
          </label>
        </div>

        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">背景图（可选）</h3>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadBackground(e.target.files[0])}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-3 py-2 text-xs text-white hover:bg-[hsl(222,47%,12%)]"
            >
              <Upload className="h-3 w-3" /> 上传背景
            </button>
            {bgPath && (
              <>
                <span className="flex-1 truncate text-xs text-[hsl(215,20%,55%)]">
                  {bgPath.split("/").pop()}
                </span>
                <button
                  onClick={() => setBgPath(null)}
                  className="text-xs text-[hsl(215,20%,55%)] hover:text-white"
                >
                  清除
                </button>
              </>
            )}
          </div>
        </div>

        <button
          onClick={generate}
          disabled={generating || !title.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(45,80%,55%)] px-4 py-3 text-sm font-semibold text-[hsl(222,47%,9%)] hover:bg-[hsl(45,80%,60%)] disabled:opacity-40"
        >
          {generating && <Loader2 className="h-4 w-4 animate-spin" />}
          {generating ? "生成中..." : "生成封面"}
        </button>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,12%)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,55%)]" />
              <span className="text-sm font-medium text-white">封面已生成</span>
              <span className="ml-auto text-xs text-[hsl(150,60%,75%)]">
                {(result.size_bytes / 1024).toFixed(1)} KB
              </span>
            </div>
            <div className="mb-3 truncate text-xs text-[hsl(150,60%,75%)]">
              {result.cover_path}
            </div>
            <a
              href={`file://${result.cover_path}`}
              className="flex w-fit items-center gap-1 rounded border border-[hsl(150,40%,30%)] px-2 py-1 text-xs text-[hsl(150,60%,75%)] hover:bg-[hsl(150,40%,20%)]"
            >
              <Download className="h-3 w-3" /> 打开文件
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
