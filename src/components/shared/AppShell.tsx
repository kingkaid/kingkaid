import { Link, useLocation } from "@tanstack/react-router";
import {
  Scissors,
  Users,
  Film,
  Layers,
  PictureInPicture2,
  Subtitles,
  ImageIcon,
  Music,
  Mic,
  Hash,
  ShieldAlert,
  Search,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/cn";

const NAV_ITEMS = [
  { path: "/xigao", icon: Scissors, label: "洗稿" },
  { path: "/avatar", icon: Users, label: "数字人" },
  { path: "/clip", icon: Film, label: "视频剪辑" },
  { path: "/mashup", icon: Layers, label: "混剪视频" },
  { path: "/pip", icon: PictureInPicture2, label: "画中画" },
  { path: "/subtitle", icon: Subtitles, label: "字幕生成" },
  { path: "/cover", icon: ImageIcon, label: "封面制作" },
  { path: "/bgm", icon: Music, label: "背景音乐" },
  { path: "/voice", icon: Mic, label: "声音克隆" },
  { path: "/title", icon: Hash, label: "标题话题" },
  { path: "/compliance", icon: ShieldAlert, label: "违规词检测" },
  { path: "/analyze", icon: Search, label: "竞品分析" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[hsl(222,47%,11%)]">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col items-center gap-1 border-r border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] py-3">
        {/* Logo */}
        <Link to="/" className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(263,70%,60%)]">
          <Zap className="h-5 w-5 text-white" />
        </Link>

        {/* Nav items */}
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              title={label}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                isActive
                  ? "bg-[hsl(263,70%,60%)] text-white"
                  : "text-[hsl(215,20%,55%)] hover:bg-[hsl(217,33%,22%)] hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-md bg-[hsl(222,47%,9%)] px-2 py-1 text-xs text-white opacity-0 shadow-lg ring-1 ring-[hsl(217,33%,22%)] transition-opacity group-hover:opacity-100">
                {label}
              </span>
            </Link>
          );
        })}

        {/* Settings at bottom */}
        <div className="mt-auto">
          <Link
            to="/settings"
            title="设置"
            className={cn(
              "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
              location.pathname === "/settings"
                ? "bg-[hsl(263,70%,60%)] text-white"
                : "text-[hsl(215,20%,55%)] hover:bg-[hsl(217,33%,22%)] hover:text-white"
            )}
          >
            <Settings className="h-5 w-5" />
            <span className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-md bg-[hsl(222,47%,9%)] px-2 py-1 text-xs text-white opacity-0 shadow-lg ring-1 ring-[hsl(217,33%,22%)] transition-opacity group-hover:opacity-100">
              设置
            </span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
