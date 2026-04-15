import { useRef, useState, useEffect } from "react";

export interface PipBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Visual canvas for positioning the PIP window over the main video.
 * Uses percentages so it scales with the preview box; parent converts to
 * absolute pixel coords (at the main video's native resolution).
 */
export function PipCanvas({
  mainWidth,
  mainHeight,
  pipBox,
  onChange,
}: {
  mainWidth: number;
  mainHeight: number;
  pipBox: PipBox;
  onChange: (box: PipBox) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState({ w: 640, h: 360 });
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const [dragStart, setDragStart] = useState<{
    px: number;
    py: number;
    box: PipBox;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setPreviewSize({ w: rect.width, h: rect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const scaleX = mainWidth > 0 ? previewSize.w / mainWidth : 1;
  const scaleY = mainHeight > 0 ? previewSize.h / mainHeight : 1;

  const handleMouseDown = (mode: "move" | "resize") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(mode);
    setDragStart({ px: e.clientX, py: e.clientY, box: { ...pipBox } });
  };

  useEffect(() => {
    if (!dragging || !dragStart) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.px) / scaleX;
      const dy = (e.clientY - dragStart.py) / scaleY;
      if (dragging === "move") {
        onChange({
          ...dragStart.box,
          x: Math.max(0, Math.min(mainWidth - dragStart.box.w, Math.round(dragStart.box.x + dx))),
          y: Math.max(0, Math.min(mainHeight - dragStart.box.h, Math.round(dragStart.box.y + dy))),
        });
      } else {
        onChange({
          ...dragStart.box,
          w: Math.max(40, Math.min(mainWidth - dragStart.box.x, Math.round(dragStart.box.w + dx))),
          h: Math.max(40, Math.min(mainHeight - dragStart.box.y, Math.round(dragStart.box.h + dy))),
        });
      }
    };
    const onUp = () => {
      setDragging(null);
      setDragStart(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, dragStart, scaleX, scaleY, mainWidth, mainHeight, onChange]);

  const aspect = mainWidth > 0 ? mainHeight / mainWidth : 0.5625;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg border border-[hsl(217,33%,22%)] bg-black"
      style={{ aspectRatio: `${mainWidth} / ${mainHeight || 360}`, paddingBottom: mainWidth ? undefined : `${aspect * 100}%` }}
    >
      {/* Faux main video area — gray grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, hsl(217,33%,15%), hsl(217,33%,15%) 10px, hsl(217,33%,12%) 10px, hsl(217,33%,12%) 20px)",
        }}
      >
        <div className="flex h-full items-center justify-center text-xs text-[hsl(215,20%,35%)]">
          主视频画布 {mainWidth}×{mainHeight}
        </div>
      </div>

      {/* PIP rectangle (draggable) */}
      <div
        onMouseDown={handleMouseDown("move")}
        className="absolute cursor-move rounded border-2 border-[hsl(180,60%,45%)] bg-[hsl(180,60%,45%)]/20 backdrop-blur-sm"
        style={{
          left: pipBox.x * scaleX,
          top: pipBox.y * scaleY,
          width: pipBox.w * scaleX,
          height: pipBox.h * scaleY,
        }}
      >
        <div className="pointer-events-none flex h-full items-center justify-center text-xs font-medium text-white">
          PIP {pipBox.w}×{pipBox.h}
        </div>
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown("resize")}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-[hsl(180,60%,45%)]"
        />
      </div>
    </div>
  );
}
