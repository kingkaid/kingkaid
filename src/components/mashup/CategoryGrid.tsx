import {
  Package,
  Users,
  Store,
  Settings2,
  HandHelping,
  Folder,
  Upload,
  Loader2,
} from "lucide-react";
import { useRef, useState } from "react";
import { apiBase } from "../../lib/api";

export interface Category {
  name: string;
  count: number;
  files: { path: string; filename: string; size: number }[];
}

const ICONS: Record<string, typeof Package> = {
  产品: Package,
  人物: Users,
  门店展示: Store,
  操作过程: Settings2,
  服务过程: HandHelping,
  其他: Folder,
};

const COLORS: Record<string, string> = {
  产品: "hsl(30,80%,55%)",
  人物: "hsl(210,70%,60%)",
  门店展示: "hsl(150,60%,55%)",
  操作过程: "hsl(263,70%,60%)",
  服务过程: "hsl(45,80%,55%)",
  其他: "hsl(215,20%,55%)",
};

export function CategoryGrid({
  categories,
  selected,
  onSelect,
  onUploadComplete,
}: {
  categories: Category[];
  selected: string | null;
  onSelect: (name: string) => void;
  onUploadComplete: () => void;
}) {
  const [uploadingCat, setUploadingCat] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetCat = useRef<string | null>(null);

  const triggerUpload = (cat: string) => {
    targetCat.current = cat;
    inputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    const cat = targetCat.current;
    if (!cat) return;
    setUploadingCat(cat);
    try {
      const base = await apiBase();
      const form = new FormData();
      form.append("file", file);
      form.append("category", cat);
      await fetch(`${base}/mashup/upload`, { method: "POST", body: form });
      onUploadComplete();
    } finally {
      setUploadingCat(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {categories.map((cat) => {
          const Icon = ICONS[cat.name] || Folder;
          const color = COLORS[cat.name] || "hsl(215,20%,55%)";
          const isSelected = selected === cat.name;
          return (
            <div
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                isSelected
                  ? "border-[hsl(30,80%,55%)] bg-[hsl(30,80%,55%)]/10"
                  : "border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] hover:border-[hsl(217,33%,32%)]"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${color}22` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <span className="rounded bg-[hsl(222,47%,9%)] px-2 py-0.5 text-xs text-white">
                  {cat.count}
                </span>
              </div>
              <div className="mb-1 text-sm font-medium text-white">{cat.name}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerUpload(cat.name);
                }}
                className="flex items-center gap-1 text-xs text-[hsl(215,20%,55%)] hover:text-white"
                disabled={uploadingCat === cat.name}
              >
                {uploadingCat === cat.name ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {uploadingCat === cat.name ? "上传中..." : "添加素材"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
