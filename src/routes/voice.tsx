import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Mic,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Play,
  Volume2,
} from "lucide-react";
import { apiBase, apiGet, apiPost } from "../lib/api";

interface VoiceProfile {
  name: string;
  voice_id: string;
  source_path: string;
}

interface SynthResponse {
  output_path: string;
  voice_id: string;
  text_length: number;
}

export default function VoicePage() {
  const [sampleName, setSampleName] = useState("");
  const [sampleFile, setSampleFile] = useState<{ file_path: string; filename: string } | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<VoiceProfile | null>(null);
  const [text, setText] = useState("");
  const [synthResult, setSynthResult] = useState<SynthResponse | null>(null);
  const [cloning, setCloning] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: profiles, refetch: refetchProfiles } = useQuery<VoiceProfile[]>({
    queryKey: ["voice-profiles"],
    queryFn: () => apiGet<VoiceProfile[]>("/voice/profiles"),
  });

  const uploadSample = async (f: File) => {
    setError(null);
    try {
      const base = await apiBase();
      const form = new FormData();
      form.append("file", f);
      const r = await fetch(`${base}/voice/upload`, { method: "POST", body: form });
      if (!r.ok) throw new Error(`Upload failed ${r.status}`);
      const data = await r.json();
      setSampleFile(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const cloneVoice = async () => {
    if (!sampleFile || !sampleName.trim()) return;
    setCloning(true);
    setError(null);
    try {
      await apiPost<VoiceProfile>("/voice/clone", {
        audio_path: sampleFile.file_path,
        name: sampleName.trim(),
      });
      await refetchProfiles();
      setSampleFile(null);
      setSampleName("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setCloning(false);
    }
  };

  const deleteProfile = async (name: string) => {
    const base = await apiBase();
    await fetch(`${base}/voice/profiles/${name}`, { method: "DELETE" });
    await refetchProfiles();
    if (selectedProfile?.name === name) setSelectedProfile(null);
  };

  const synthesize = async () => {
    if (!selectedProfile || !text.trim()) return;
    setSynthesizing(true);
    setError(null);
    setSynthResult(null);
    try {
      const resp = await apiPost<SynthResponse>("/voice/synthesize", {
        voice_id: selectedProfile.voice_id,
        text: text.trim(),
      });
      setSynthResult(resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Synthesize failed");
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(0,60%,55%)]/20">
          <Mic className="h-5 w-5 text-[hsl(0,60%,65%)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">声音克隆</h1>
          <p className="text-xs text-[hsl(215,20%,55%)]">
            上传 5 秒参考音频 → HeyGem 声音克隆 → 文本合成
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadSample(e.target.files[0])}
        />

        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">克隆新音色</h3>
          <input
            type="text"
            value={sampleName}
            onChange={(e) => setSampleName(e.target.value.slice(0, 40))}
            placeholder="音色名称（例如：温柔女声）"
            className="mb-3 w-full rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] px-3 py-2 text-sm text-white focus:border-[hsl(0,60%,55%)] focus:outline-none"
          />
          {sampleFile ? (
            <div className="mb-3 flex items-center gap-2 rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] p-2 text-xs">
              <Volume2 className="h-3 w-3 text-[hsl(0,60%,65%)]" />
              <span className="flex-1 truncate text-white">{sampleFile.filename}</span>
              <button
                onClick={() => setSampleFile(null)}
                className="text-[hsl(215,20%,55%)] hover:text-white"
              >
                清除
              </button>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] py-3 text-xs text-[hsl(215,20%,70%)] hover:border-[hsl(217,33%,32%)]"
            >
              <Upload className="h-3 w-3" /> 上传参考音频（5 秒以上）
            </button>
          )}
          <button
            onClick={cloneVoice}
            disabled={!sampleFile || !sampleName.trim() || cloning}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(0,60%,55%)] px-3 py-2 text-xs font-medium text-white hover:bg-[hsl(0,60%,60%)] disabled:opacity-40"
          >
            {cloning && <Loader2 className="h-3 w-3 animate-spin" />}
            {cloning ? "克隆中..." : "克隆并保存"}
          </button>
        </div>

        <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">音色库</h3>
          {profiles && profiles.length > 0 ? (
            <div className="space-y-1">
              {profiles.map((p) => (
                <div
                  key={p.name}
                  onClick={() => setSelectedProfile(p)}
                  className={`flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-xs transition-colors ${
                    selectedProfile?.name === p.name
                      ? "bg-[hsl(0,60%,30%)] text-white"
                      : "bg-[hsl(222,47%,9%)] text-[hsl(215,20%,70%)] hover:bg-[hsl(222,47%,11%)]"
                  }`}
                >
                  <Mic className="h-3 w-3 text-[hsl(0,60%,65%)]" />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="font-mono text-[10px] text-[hsl(215,20%,45%)]">
                    {p.voice_id.slice(0, 12)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProfile(p.name);
                    }}
                    className="text-[hsl(215,20%,45%)] hover:text-[hsl(0,65%,60%)]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[hsl(217,33%,22%)] p-4 text-center text-xs text-[hsl(215,20%,45%)]">
              音色库为空。先克隆一个音色。
            </div>
          )}
        </div>

        {selectedProfile && (
          <div className="rounded-xl border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,14%)] p-5">
            <div className="mb-2 text-xs text-[hsl(215,20%,55%)]">
              当前音色: <span className="text-white">{selectedProfile.name}</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 3000))}
              placeholder="输入要合成的文字..."
              rows={4}
              className="mb-3 w-full resize-none rounded border border-[hsl(217,33%,22%)] bg-[hsl(222,47%,9%)] p-2 text-sm text-white focus:border-[hsl(0,60%,55%)] focus:outline-none"
            />
            <div className="mb-3 text-right text-xs text-[hsl(215,20%,55%)]">
              {text.length} / 3000
            </div>
            <button
              onClick={synthesize}
              disabled={!text.trim() || synthesizing}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(0,60%,55%)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[hsl(0,60%,60%)] disabled:opacity-40"
            >
              {synthesizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {synthesizing ? "合成中..." : "合成语音"}
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(0,50%,20%)] px-3 py-2 text-sm text-[hsl(0,80%,85%)]">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {synthResult && (
          <div className="rounded-xl border border-[hsl(150,40%,30%)] bg-[hsl(150,40%,12%)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,55%)]" />
              <span className="text-sm font-medium text-white">合成完成</span>
            </div>
            <audio src={`file://${synthResult.output_path}`} controls className="w-full" />
            <div className="mt-2 truncate text-xs text-[hsl(150,60%,75%)]">
              {synthResult.output_path}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
