"use client";

import { useState } from "react";
import type { SiteImageKey } from "@/lib/site-image-fields";

export type PhotoSource = "hero" | "about" | "upload" | "ai" | "video";

export function resolvePhotoSrc(
  source: PhotoSource,
  siteImages: Record<SiteImageKey, string>,
  uploadedPhoto: string | null,
  aiPhoto: string | null
): string | null {
  if (source === "video") return null;
  if (source === "upload") return uploadedPhoto;
  if (source === "ai") return aiPhoto;
  if (source === "about") return siteImages.about;
  return siteImages.hero;
}

export function PhotoPicker({
  source,
  setSource,
  uploadedPhoto,
  setUploadedPhoto,
  aiPhoto,
  setAiPhoto,
  canvasHeight,
  disabled = false,
  allowVideo = false,
  videoFileName,
  onVideoSelected,
}: {
  source: PhotoSource;
  setSource: (s: PhotoSource) => void;
  uploadedPhoto: string | null;
  setUploadedPhoto: (v: string | null) => void;
  aiPhoto: string | null;
  setAiPhoto: (v: string | null) => void;
  canvasHeight: number;
  disabled?: boolean;
  /** Vídeo mostra um botão extra "Enviar vídeo" (só faz sentido no gerador de vídeo). */
  allowVideo?: boolean;
  videoFileName?: string | null;
  onVideoSelected?: (file: File) => void;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedPhoto(reader.result as string);
      setSource("upload");
    };
    reader.readAsDataURL(file);
  }

  function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onVideoSelected?.(file);
    setSource("video");
  }

  async function callAi(
    mode: "generate" | "edit",
    fileForEdit?: string | null
  ) {
    if (!prompt.trim()) {
      setError("Descreva a imagem que a IA deve gerar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("prompt", prompt.trim());
      formData.append("height", String(canvasHeight));
      if (mode === "edit" && fileForEdit) {
        const blob = await (await fetch(fileForEdit)).blob();
        formData.append("file", blob, "foto.png");
      }
      const res = await fetch("/api/admin/ai/image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível gerar a imagem.");
        return;
      }
      setAiPhoto(data.dataUrl);
      setSource("ai");
      setAiOpen(false);
      setPrompt("");
    } catch {
      setError("Erro de conexão ao gerar a imagem.");
    } finally {
      setLoading(false);
    }
  }

  const canImprove = source === "upload" && uploadedPhoto;

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-nd-graphite">
        {allowVideo ? "Foto ou vídeo" : "Foto"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setSource("about")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            source === "about"
              ? "bg-nd-green-dark text-white"
              : "bg-black/5 text-nd-graphite hover:bg-black/10"
          }`}
        >
          Imagem da "Sobre"
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setSource("hero")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            source === "hero"
              ? "bg-nd-green-dark text-white"
              : "bg-black/5 text-nd-graphite hover:bg-black/10"
          }`}
        >
          Imagem do topo
        </button>
        <label
          className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
            disabled ? "pointer-events-none opacity-50" : ""
          } ${
            source === "upload"
              ? "bg-nd-green-dark text-white"
              : "bg-black/5 text-nd-graphite hover:bg-black/10"
          }`}
        >
          Enviar do dispositivo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={disabled}
            className="hidden"
          />
        </label>
        {allowVideo && (
          <label
            className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
              disabled ? "pointer-events-none opacity-50" : ""
            } ${
              source === "video"
                ? "bg-nd-green-dark text-white"
                : "bg-black/5 text-nd-graphite hover:bg-black/10"
            }`}
          >
            {source === "video" && videoFileName
              ? `🎬 ${videoFileName}`
              : "🎬 Enviar vídeo"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleVideoUpload}
              disabled={disabled}
              className="hidden"
            />
          </label>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAiOpen((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            source === "ai"
              ? "bg-nd-green-dark text-white"
              : "bg-black/5 text-nd-graphite hover:bg-black/10"
          }`}
        >
          ✨ Gerar com IA
        </button>
      </div>

      {aiOpen && (
        <div className="mt-3 space-y-2 rounded-xl bg-nd-mist p-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex.: drone agrícola pulverizando lavoura de soja ao pôr do sol, vista de baixo"
            rows={2}
            disabled={loading}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-nd-green focus:ring-1 focus:ring-nd-green disabled:opacity-50"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => callAi("generate")}
              disabled={loading}
              className="rounded-full bg-nd-green-dark px-4 py-2 text-xs font-semibold text-white transition hover:bg-nd-green disabled:opacity-60"
            >
              {loading ? "Gerando…" : "Gerar imagem nova"}
            </button>
            {canImprove && (
              <button
                type="button"
                onClick={() => callAi("edit", uploadedPhoto)}
                disabled={loading}
                className="rounded-full border border-nd-green-dark px-4 py-2 text-xs font-semibold text-nd-green-dark transition hover:bg-nd-green-dark hover:text-white disabled:opacity-60"
              >
                {loading ? "Melhorando…" : "Melhorar a foto enviada"}
              </button>
            )}
          </div>
          {error && (
            <p className="text-xs font-medium text-red-600">{error}</p>
          )}
          <p className="text-xs text-nd-graphite/50">
            Leva ~10-20s e tem um custo pequeno por geração na conta OpenAI
            conectada ao site.
          </p>
        </div>
      )}
    </div>
  );
}
