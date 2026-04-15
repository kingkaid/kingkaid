import { Scissors, Plus, Trash2 } from "lucide-react";

export interface Segment {
  start: number;
  end: number;
}

export function ClipTimeline({
  duration,
  segments,
  onSegmentsChange,
}: {
  duration: number;
  segments: Segment[];
  onSegmentsChange: (s: Segment[]) => void;
}) {
  const addSegment = () => {
    const lastEnd = segments.length > 0 ? segments[segments.length - 1].end : 0;
    const start = Math.min(lastEnd, duration - 1);
    const end = Math.min(start + 5, duration);
    onSegmentsChange([...segments, { start, end }]);
  };

  const removeSegment = (i: number) => {
    onSegmentsChange(segments.filter((_, idx) => idx !== i));
  };

  const updateSegment = (i: number, patch: Partial<Segment>) => {
    const next = segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onSegmentsChange(next);
  };

  return (
    <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-[hsl(150,60%,55%)]" />
          <h3 className="text-sm font-semibold text-white">剪辑片段</h3>
          <span className="text-xs text-[hsl(215,20%,55%)]">({segments.length})</span>
        </div>
        <button
          onClick={addSegment}
          disabled={duration === 0}
          className="flex items-center gap-1 rounded bg-[hsl(150,60%,45%)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[hsl(150,60%,50%)] disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> 添加
        </button>
      </div>

      <div className="mb-3 text-xs text-[hsl(215,20%,55%)]">
        视频总长：{duration.toFixed(1)}s
      </div>

      {/* Timeline track visualization */}
      {duration > 0 && (
        <div className="relative mb-4 h-8 overflow-hidden rounded bg-[hsl(222,47%,9%)]">
          {segments.map((seg, i) => {
            const left = (seg.start / duration) * 100;
            const width = ((seg.end - seg.start) / duration) * 100;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 rounded bg-[hsl(150,60%,45%)]/40 ring-1 ring-[hsl(150,60%,55%)]"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s`}
              />
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg bg-[hsl(222,47%,9%)] p-2 text-xs"
          >
            <span className="w-10 shrink-0 text-center text-[hsl(215,20%,55%)]">#{i + 1}</span>
            <label className="flex items-center gap-1 text-[hsl(215,20%,55%)]">
              起始
              <input
                type="number"
                min={0}
                max={duration}
                step={0.1}
                value={seg.start.toFixed(2)}
                onChange={(e) =>
                  updateSegment(i, { start: Math.max(0, parseFloat(e.target.value) || 0) })
                }
                className="w-16 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] px-1 py-0.5 text-white focus:border-[hsl(150,60%,45%)] focus:outline-none"
              />
              s
            </label>
            <label className="flex items-center gap-1 text-[hsl(215,20%,55%)]">
              结束
              <input
                type="number"
                min={0}
                max={duration}
                step={0.1}
                value={seg.end.toFixed(2)}
                onChange={(e) =>
                  updateSegment(i, {
                    end: Math.min(duration, parseFloat(e.target.value) || 0),
                  })
                }
                className="w-16 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] px-1 py-0.5 text-white focus:border-[hsl(150,60%,45%)] focus:outline-none"
              />
              s
            </label>
            <span className="ml-auto mr-1 text-[hsl(215,20%,55%)]">
              {(seg.end - seg.start).toFixed(1)}s
            </span>
            <button
              onClick={() => removeSegment(i)}
              className="rounded p-1 text-[hsl(215,20%,45%)] hover:bg-[hsl(217,33%,22%)] hover:text-[hsl(0,65%,60%)]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {segments.length === 0 && (
          <div className="rounded-lg border border-dashed border-[hsl(217,33%,22%)] p-4 text-center text-xs text-[hsl(215,20%,45%)]">
            还没有片段，点击"添加"创建第一段
          </div>
        )}
      </div>
    </div>
  );
}
