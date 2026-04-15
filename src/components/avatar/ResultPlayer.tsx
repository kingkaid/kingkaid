import { Download, PlayCircle } from "lucide-react";

export function ResultPlayer({
  videoUrl,
}: {
  videoUrl: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,12%)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-[hsl(150,60%,55%)]" />
          <h3 className="text-sm font-semibold text-white">生成结果</h3>
        </div>
        <a
          href={videoUrl}
          download
          className="flex items-center gap-1.5 rounded border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,15%)] px-2 py-1 text-xs text-[hsl(150,60%,75%)] hover:bg-[hsl(150,40%,20%)]"
        >
          <Download className="h-3 w-3" />
          下载 MP4
        </a>
      </div>
      <video
        src={videoUrl}
        controls
        playsInline
        className="w-full rounded-lg border border-[hsl(150,40%,30%)] bg-black"
      />
    </div>
  );
}
