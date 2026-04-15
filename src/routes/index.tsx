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
  ChevronRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

const MODULES = [
  {
    path: "/xigao",
    icon: Scissors,
    label: "口播文案 / 洗稿",
    desc: "抖音视频转录 + Claude AI 智能改写",
    color: "hsl(263,70%,60%)",
    ready: true,
  },
  {
    path: "/avatar",
    icon: Users,
    label: "数字人视频",
    desc: "参考视频一键生成 4K 数字人口播",
    color: "hsl(210,70%,60%)",
    ready: true,
  },
  {
    path: "/clip",
    icon: Film,
    label: "视频剪辑",
    desc: "时间轴裁剪、多段合并导出",
    color: "hsl(150,60%,45%)",
    ready: true,
  },
  {
    path: "/mashup",
    icon: Layers,
    label: "混剪视频",
    desc: "按类别智能混剪，自动添加 BGM",
    color: "hsl(30,80%,55%)",
    ready: true,
  },
  {
    path: "/pip",
    icon: PictureInPicture2,
    label: "画中画",
    desc: "拖拽定位 PIP 素材，精确到帧",
    color: "hsl(180,60%,45%)",
    ready: true,
  },
  {
    path: "/subtitle",
    icon: Subtitles,
    label: "字幕生成",
    desc: "SenseVoice 极速转录，导出 SRT/ASS",
    color: "hsl(320,60%,55%)",
    ready: true,
  },
  {
    path: "/cover",
    icon: ImageIcon,
    label: "封面制作",
    desc: "9 款专业模板，文字叠加，一键导出",
    color: "hsl(45,80%,55%)",
    ready: true,
  },
  {
    path: "/bgm",
    icon: Music,
    label: "背景音乐",
    desc: "内置 27 首曲目，淡入淡出混音",
    color: "hsl(263,50%,50%)",
    ready: true,
  },
  {
    path: "/voice",
    icon: Mic,
    label: "声音克隆",
    desc: "5 秒参考音频，完美克隆音色",
    color: "hsl(0,60%,55%)",
    ready: true,
  },
  {
    path: "/title",
    icon: Hash,
    label: "标题话题",
    desc: "AI 生成 10 条爆款标题 + 话题标签",
    color: "hsl(120,50%,45%)",
    ready: true,
  },
  {
    path: "/compliance",
    icon: ShieldAlert,
    label: "违规词检测",
    desc: "本地词库 + AI 上下文判断风险等级",
    color: "hsl(15,70%,50%)",
    ready: true,
  },
  {
    path: "/analyze",
    icon: Search,
    label: "竞品分析",
    desc: "一键提取任意抖音视频的文案与数据",
    color: "hsl(195,70%,50%)",
    ready: true,
  },
];

export default function IndexPage() {
  return (
    <div className="min-h-full p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">短视频 AI 工具</h1>
        <p className="mt-1 text-sm text-[hsl(215,20%,55%)]">选择模块开始创作</p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {MODULES.map(({ path, icon: Icon, label, desc, color, ready }) => (
          <Link
            key={path}
            to={ready ? path : "/"}
            className="group flex items-start gap-4 rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-4 transition-all hover:border-[hsl(263,70%,60%)] hover:bg-[hsl(222,47%,16%)]"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}22` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{label}</span>
                {ready && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(215,20%,45%)] transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                )}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-[hsl(215,20%,55%)]">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
