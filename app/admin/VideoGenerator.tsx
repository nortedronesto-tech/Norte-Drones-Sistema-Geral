"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteImageKey } from "@/lib/site-image-fields";
import type { SiteContacts } from "@/lib/content-store";
import {
  W,
  FORMATS,
  TEMPLATES,
  RICH_FIELD_TEMPLATES,
  loadImage,
  loadFonts,
  loadQrCode,
  buildWhatsAppLinkClient,
  draw,
  drawCover,
  drawWhatsappFotoOverlay,
  drawContactCard,
  type TemplateKey,
  type FormatKey,
  type MediaSource,
} from "./postCanvas";
import { PhotoPicker, resolvePhotoSrc, type PhotoSource } from "./PhotoPicker";
import { shareOrDownloadFile } from "./shareFile";
import { usePhotoAdjust, useLogoAdjust } from "./usePhotoAdjust";
import { formatPhoneBR } from "./phoneFormat";

const DURATION_S = 5.5;
// Limite de segurança bem alto (não é um limite "prático") — só pra
// evitar travar o navegador num caso extremo (ex.: duration=Infinity).
// O vídeo enviado é sempre renderizado por inteiro, do começo ao fim.
const MAX_VIDEO_DURATION_S = 600;
const REVEAL_START = 0.4;
const REVEAL_END = 1.3;
const FADE_S = 0.4;
const MAX_ZOOM = 1.12;

function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 10000): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Tempo esgotado esperando o vídeo enviado carregar (readyState=" +
            video.readyState +
            ")."
        )
      );
    }, timeoutMs);
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Não foi possível carregar o vídeo enviado."));
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    // Em alguns navegadores móveis um <video> quase invisível (1x1px,
    // opacity 0) não começa a baixar/decodificar sozinho — força aqui.
    video.load();
  });
}

type VideoWithCapture = HTMLVideoElement & {
  captureStream?: () => MediaStream;
};

/** Detecta Safari (iOS e macOS) — não dá pra usar feature detection normal
 * aqui porque o próprio bug que estamos contornando é o
 * MediaRecorder.isTypeSupported("video/webm") do Safari mentir dizendo que
 * suporta, quando na prática grava um vídeo quebrado (com pedaços pretos).
 * Precisamos saber que é Safari ANTES de confiar nesse retorno. */
function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
}

function pickMimeType(): string | null {
  const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mp4 = ["video/mp4;codecs=h264", "video/mp4"];
  // No Safari, video/webm "passa" no isTypeSupported mas a gravação sai
  // corrompida (parte da imagem preta) — força mp4 primeiro nesse caso.
  const candidates = isSafari() ? [...mp4, ...webm] : [...webm, ...mp4];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
}

function extensionFor(mimeType: string): string {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

function easeOutCubic(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

export function VideoGenerator({
  siteImages,
  contacts,
}: {
  siteImages: Record<SiteImageKey, string>;
  contacts: SiteContacts;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const [template, setTemplate] = useState<TemplateKey>("servico");
  const [format, setFormat] = useState<FormatKey>("quadrado");
  const [photoChoice, setPhotoChoice] = useState<PhotoSource>("about");
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [aiPhoto, setAiPhoto] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("Aplicação agrícola de precisão");
  const [subtitle, setSubtitle] = useState("Fale com a Norte Drones");
  const [price, setPrice] = useState("Peça seu orçamento");
  const [kicker, setKicker] = useState("Tecnologia que impulsiona");
  const [highlight, setHighlight] = useState("O seu campo");
  const [body, setBody] = useState(
    "Com planejamento e tecnologia, a Norte Drones leva precisão à sua lavoura."
  );
  const [badge1, setBadge1] = useState("Aplicação com precisão");
  const [badge2, setBadge2] = useState("Mais produtividade");
  const [badge3, setBadge3] = useState("Segurança em todas as etapas");
  const [location, setLocation] = useState("Porto Nacional, Palmas/TO e Região");
  const [signature, setSignature] = useState("Juntos por mais resultado!");
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoExt, setVideoExt] = useState<string>("webm");
  const [error, setError] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState(1);
  const [fontScale, setFontScale] = useState(1);
  const [postPhone, setPostPhone] = useState("");
  const [postAttendantName, setPostAttendantName] = useState("");
  const [contactCardQrCode, setContactCardQrCode] = useState<HTMLImageElement | null>(null);
  const [dragTarget, setDragTarget] = useState<"photo" | "logo" | "card">("photo");
  const photoAdjust = usePhotoAdjust();
  const logoAdjust = useLogoAdjust(W);
  const cardAdjust = useLogoAdjust(W);

  const activeTemplate = TEMPLATES.find((t) => t.key === template)!;
  const activeFormat = FORMATS.find((f) => f.key === format)!;

  useEffect(() => {
    const canvas = canvasRef.current;
    setSupported(
      typeof MediaRecorder !== "undefined" &&
        !!canvas &&
        typeof canvas.captureStream === "function" &&
        pickMimeType() !== null
    );
  }, []);

  // Cria/limpa a URL do vídeo enviado quando o arquivo muda.
  useEffect(() => {
    if (!videoFile) {
      setVideoObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  // volta a foto/vídeo pro centro/sem zoom sempre que a origem muda — um
  // enquadramento manual feito numa foto não faz sentido pra outra.
  useEffect(() => {
    photoAdjust.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoChoice, uploadedPhoto, aiPhoto, videoObjectUrl]);

  // gera o QR code deste post sempre que o telefone (desse post, não o de
  // Contatos) muda — some se o campo for apagado.
  useEffect(() => {
    let cancelled = false;
    const link = buildWhatsAppLinkClient(postPhone, "");
    if (!link) {
      setContactCardQrCode(null);
      return;
    }
    loadQrCode(link).then((img) => {
      if (!cancelled) setContactCardQrCode(img);
    });
    return () => {
      cancelled = true;
    };
  }, [postPhone]);

  // Static preview (settled frame) whenever not recording.
  useEffect(() => {
    if (recording) return;
    let cancelled = false;
    async function renderPreview() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        await loadFonts();
        const logo = await loadImage(siteImages.logoDark);
        let photo: MediaSource | null = null;
        if (activeTemplate.needsPhoto) {
          if (photoChoice === "video" && videoObjectUrl) {
            const video = sourceVideoRef.current;
            if (video) {
              await waitForVideoReady(video);
              photo = video;
            }
          } else {
            const src = resolvePhotoSrc(photoChoice, siteImages, uploadedPhoto, aiPhoto);
            if (src) photo = await loadImage(src);
          }
        }
        let qrCode: HTMLImageElement | null = null;
        if (template === "whatsapp" || template === "whatsapp-foto") {
          const link = buildWhatsAppLinkClient(contacts.whatsappNumber, contacts.whatsappMessage);
          if (link) qrCode = await loadQrCode(link);
        }
        if (cancelled) return;
        draw(ctx, {
          template,
          h: activeFormat.height,
          photo,
          logo,
          title,
          subtitle,
          price,
          kicker,
          highlight,
          body,
          badges: [badge1, badge2, badge3],
          location,
          signature,
          zoom: MAX_ZOOM,
          reveal: 1,
          qrCode,
          contactPhone: contacts.phone,
          contactInstagram: contacts.instagramHandle,
          photoOffsetX: photoAdjust.offsetX,
          photoOffsetY: photoAdjust.offsetY,
          photoScale: photoAdjust.scale,
          logoScale,
          fontScale,
          logoOffsetX: logoAdjust.x,
          logoOffsetY: logoAdjust.y,
          contactCardPhone: postPhone,
          contactCardName: postAttendantName,
          contactCardQrCode,
          contactCardOffsetX: cardAdjust.x,
          contactCardOffsetY: cardAdjust.y,
        });
      } catch {
        if (!cancelled) {
          setError(
            "Não foi possível carregar alguma imagem. Tente enviar a foto pelo seu dispositivo."
          );
        }
      }
    }
    renderPreview();
    return () => {
      cancelled = true;
    };
  }, [
    recording,
    template,
    format,
    activeFormat.height,
    photoChoice,
    uploadedPhoto,
    aiPhoto,
    videoObjectUrl,
    title,
    subtitle,
    price,
    kicker,
    highlight,
    body,
    badge1,
    badge2,
    badge3,
    location,
    signature,
    siteImages,
    contacts,
    activeTemplate.needsPhoto,
    photoAdjust.offsetX,
    photoAdjust.offsetY,
    photoAdjust.scale,
    logoScale,
    fontScale,
    logoAdjust.x,
    logoAdjust.y,
    postPhone,
    postAttendantName,
    contactCardQrCode,
    cardAdjust.x,
    cardAdjust.y,
  ]);

  async function handleRecord() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("Seu navegador não suporta gravação de vídeo. Tente no Chrome.");
      return;
    }

    setError(null);
    setVideoUrl(null);
    setVideoBlob(null);

    try {
      await loadFonts();
      const logo = await loadImage(siteImages.logoDark);
      let photo: MediaSource | null = null;
      let sourceVideo: HTMLVideoElement | null = null;
      if (activeTemplate.needsPhoto) {
        if (photoChoice === "video" && videoObjectUrl) {
          const video = sourceVideoRef.current;
          if (!video) throw new Error("Vídeo não carregado.");
          await waitForVideoReady(video);
          sourceVideo = video;
          photo = video;
        } else {
          const src = resolvePhotoSrc(photoChoice, siteImages, uploadedPhoto, aiPhoto);
          if (src) photo = await loadImage(src);
        }
      }

      let qrCode: HTMLImageElement | null = null;
      if (template === "whatsapp" || template === "whatsapp-foto") {
        const link = buildWhatsAppLinkClient(contacts.whatsappNumber, contacts.whatsappMessage);
        if (link) qrCode = await loadQrCode(link);
      }

      const clipDuration = sourceVideo
        ? Math.min(sourceVideo.duration || DURATION_S, MAX_VIDEO_DURATION_S)
        : DURATION_S;

      setRecording(true);
      setProgress(0);

      const canvasStream = canvas.captureStream(30);
      let audioTracks: MediaStreamTrack[] = [];
      if (sourceVideo) {
        sourceVideo.currentTime = 0;
        // navegadores móveis só deixam tocar um vídeo sem toque do
        // usuário se ele estiver "muted" (volume = 0 sozinho não basta,
        // especialmente no Safari/iOS). Isso não afeta o áudio capturado
        // pelo captureStream() abaixo — só silencia a reprodução local.
        sourceVideo.muted = true;
        sourceVideo.volume = 0;
        try {
          await sourceVideo.play();
        } catch (playErr) {
          console.warn("Autoplay do vídeo enviado foi bloqueado:", playErr);
          // segue mesmo se o autoplay for bloqueado — os frames ainda são
          // lidos de onde o vídeo estiver.
        }
        const capturable = sourceVideo as VideoWithCapture;
        if (typeof capturable.captureStream === "function") {
          audioTracks = capturable.captureStream().getAudioTracks();
        }
      }
      const stream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      const startTime = performance.now();
      const c = ctx;

      // Desenha cada frame num canvas fora da tela e só depois "cola" o
      // resultado pronto no canvas que está sendo gravado (captureStream),
      // num único drawImage. Alguns modelos fazem muitas operações de
      // desenho por frame (foto + gradientes + cartão + QR + ícones + texto)
      // e, sem esse buffer, o captureStream podia capturar o canvas gravado
      // no meio dessa sequência — daí vídeos saindo com parte da tela preta.
      const offscreen = document.createElement("canvas");
      offscreen.width = W;
      offscreen.height = activeFormat.height;
      const offCtx = offscreen.getContext("2d")!;

      // captureStream(30) grava a 30 quadros/segundo, mas o
      // requestAnimationFrame do navegador dispara bem mais rápido que isso
      // (60fps+ na maioria das telas). Desenhar (e "colar" no canvas
      // gravado) em toda chamada de rAF gera o dobro do trabalho que a
      // gravação realmente usa — em modelos com mais camadas de desenho
      // (foto + gradientes + cartão + QR + ícones + texto), isso pode
      // deixar a aba sem fôlego pra terminar um quadro antes do próximo
      // começar, e o vídeo gravado sai com pedaços de dois quadros
      // diferentes misturados. Por isso só desenhamos de fato no ritmo da
      // gravação (~30fps) — o restante das chamadas de rAF só atualiza a
      // barra de progresso.
      const FRAME_INTERVAL_S = 1 / 30;
      let lastDrawT = -Infinity;

      // No modelo "WhatsApp (com foto)", tudo além da foto (véu, logo,
      // selo, cartão, QR, contato) não muda quadro a quadro — só a foto
      // (ou o vídeo enviado) muda. Desenhar esse tanto de camada em cima
      // de um vídeo enviado (que já exige decodificar um frame novo a
      // cada quadro) deixava o navegador sem fôlego, e a gravação saía
      // com pedaço da tela preto/quadro incompleto. Por isso desenhamos
      // essa parte fixa UMA VEZ e só colamos ela por cima a cada quadro.
      let whatsappFotoOverlay: HTMLCanvasElement | null = null;
      if (template === "whatsapp-foto") {
        whatsappFotoOverlay = document.createElement("canvas");
        whatsappFotoOverlay.width = W;
        whatsappFotoOverlay.height = activeFormat.height;
        const overlayCtx = whatsappFotoOverlay.getContext("2d")!;
        drawWhatsappFotoOverlay(overlayCtx, {
          h: activeFormat.height,
          logo,
          title,
          qrCode,
          contactPhone: contacts.phone,
          contactInstagram: contacts.instagramHandle,
          logoScale,
          fontScale,
          logoOffsetX: logoAdjust.x,
          logoOffsetY: logoAdjust.y,
        });
        // o modelo "WhatsApp (com foto)" usa esse caminho rápido (desenha
        // uma vez, cola por cima a cada quadro) que passa ao largo de
        // `draw()` — por isso o cartão de contato deste post precisa ser
        // desenhado aqui também, não só dentro de `draw()`.
        drawContactCard(overlayCtx, {
          h: activeFormat.height,
          phone: postPhone,
          name: postAttendantName,
          qrCode: contactCardQrCode,
          offsetX: cardAdjust.x,
          offsetY: cardAdjust.y,
        });
      }

      await new Promise<void>((resolve) => {
        function frame(now: number) {
          const t = (now - startTime) / 1000;
          const p = Math.min(1, t / clipDuration);
          setProgress(p);

          const done = t >= clipDuration;
          if (done || t - lastDrawT >= FRAME_INTERVAL_S) {
            lastDrawT = t;

            const zoom = sourceVideo ? 1 : 1 + (MAX_ZOOM - 1) * p;
            const revealT =
              (t - REVEAL_START) / (REVEAL_END - REVEAL_START);
            const reveal = easeOutCubic(revealT);

            if (whatsappFotoOverlay) {
              if (photo) {
                drawCover(
                  offCtx,
                  photo,
                  0,
                  0,
                  W,
                  activeFormat.height,
                  zoom,
                  photoAdjust.offsetX,
                  photoAdjust.offsetY,
                  photoAdjust.scale
                );
              } else {
                offCtx.clearRect(0, 0, W, activeFormat.height);
              }
              offCtx.save();
              offCtx.globalAlpha = reveal;
              offCtx.translate(0, (1 - reveal) * 26);
              offCtx.drawImage(whatsappFotoOverlay, 0, 0);
              offCtx.restore();
            } else {
              draw(offCtx, {
                template,
                h: activeFormat.height,
                photo,
                logo,
                title,
                subtitle,
                price,
                kicker,
                highlight,
                body,
                badges: [badge1, badge2, badge3],
                location,
                signature,
                zoom,
                reveal,
                qrCode,
                contactPhone: contacts.phone,
                contactInstagram: contacts.instagramHandle,
                photoOffsetX: photoAdjust.offsetX,
                photoOffsetY: photoAdjust.offsetY,
                photoScale: photoAdjust.scale,
                logoScale,
                fontScale,
                logoOffsetX: logoAdjust.x,
                logoOffsetY: logoAdjust.y,
                contactCardPhone: postPhone,
                contactCardName: postAttendantName,
                contactCardQrCode,
                contactCardOffsetX: cardAdjust.x,
                contactCardOffsetY: cardAdjust.y,
              });
            }

            // fade from/to black at the edges
            const fadeIn = Math.max(0, 1 - t / FADE_S);
            const fadeOut = Math.max(0, 1 - (clipDuration - t) / FADE_S);
            const fade = Math.max(fadeIn, fadeOut);
            if (fade > 0) {
              offCtx.fillStyle = `rgba(0,0,0,${fade})`;
              offCtx.fillRect(0, 0, W, activeFormat.height);
            }

            c.drawImage(offscreen, 0, 0);
          }

          if (!done) {
            requestAnimationFrame(frame);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(frame);
      });

      recorder.stop();
      await stopped;
      stream.getTracks().forEach((tr) => tr.stop());
      if (sourceVideo) {
        sourceVideo.pause();
        sourceVideo.currentTime = 0;
      }

      const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      setVideoBlob(blob);
      setVideoExt(extensionFor(mimeType));
      setVideoUrl(URL.createObjectURL(blob));
    } catch (err) {
      const detail = err instanceof Error ? ` (${err.name}: ${err.message})` : "";
      setError(`Não foi possível gerar o vídeo. Tente novamente.${detail}`);
    } finally {
      setRecording(false);
    }
  }

  function handleDownload() {
    if (!videoBlob) return;
    shareOrDownloadFile(videoBlob, `norte-drones-${template}-${format}.${videoExt}`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="relative flex flex-col items-center rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5">
        {(() => {
          const hasCard = Boolean(postPhone);
          const target =
            dragTarget === "photo" && !activeTemplate.needsPhoto
              ? "logo"
              : dragTarget === "card" && !hasCard
              ? "logo"
              : dragTarget;
          const adjust = target === "logo" ? logoAdjust : target === "card" ? cardAdjust : photoAdjust;
          return (
            <canvas
              ref={canvasRef}
              width={W}
              height={activeFormat.height}
              onPointerDown={recording ? undefined : adjust.onDragStart}
              onPointerMove={recording ? undefined : adjust.onDragMove}
              onPointerUp={recording ? undefined : adjust.onDragEnd}
              onPointerCancel={recording ? undefined : adjust.onDragEnd}
              className={`h-auto touch-none rounded-xl bg-black ring-1 ring-black/10 ${
                recording ? "" : "cursor-move"
              } ${format === "story" ? "w-full max-w-[260px]" : "w-full max-w-[420px]"}`}
            />
          );
        })()}
        {!recording && (activeTemplate.needsPhoto || postPhone) && (
          <div className="mt-3 flex items-center gap-1 rounded-full bg-black/5 p-1 text-xs font-medium">
            {activeTemplate.needsPhoto && (
              <button
                type="button"
                onClick={() => setDragTarget("photo")}
                className={`rounded-full px-3 py-1 transition ${
                  dragTarget === "photo" ? "bg-white text-nd-green-dark shadow-sm" : "text-nd-graphite/60"
                }`}
              >
                Mover foto
              </button>
            )}
            <button
              type="button"
              onClick={() => setDragTarget("logo")}
              className={`rounded-full px-3 py-1 transition ${
                dragTarget === "logo" ? "bg-white text-nd-green-dark shadow-sm" : "text-nd-graphite/60"
              }`}
            >
              Mover logo
            </button>
            {postPhone && (
              <button
                type="button"
                onClick={() => setDragTarget("card")}
                className={`rounded-full px-3 py-1 transition ${
                  dragTarget === "card" ? "bg-white text-nd-green-dark shadow-sm" : "text-nd-graphite/60"
                }`}
              >
                Mover contato
              </button>
            )}
          </div>
        )}
        {activeTemplate.needsPhoto && !recording && dragTarget === "photo" && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={photoAdjust.zoomOut}
              className="h-8 w-8 rounded-full bg-black/5 text-sm font-bold text-nd-graphite hover:bg-black/10"
              aria-label="Diminuir zoom da foto"
            >
              −
            </button>
            <button
              type="button"
              onClick={photoAdjust.zoomIn}
              className="h-8 w-8 rounded-full bg-black/5 text-sm font-bold text-nd-graphite hover:bg-black/10"
              aria-label="Aumentar zoom da foto"
            >
              +
            </button>
            <button
              type="button"
              onClick={photoAdjust.reset}
              className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-nd-graphite hover:bg-black/10"
            >
              Centralizar
            </button>
            <span className="text-xs text-nd-graphite/50">Arraste a imagem pra ajustar</span>
          </div>
        )}
        {!recording && dragTarget === "logo" && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={logoAdjust.reset}
              className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-nd-graphite hover:bg-black/10"
            >
              Centralizar logo
            </button>
            <span className="text-xs text-nd-graphite/50">Arraste a imagem pra mover a logo</span>
          </div>
        )}
        {postPhone && !recording && dragTarget === "card" && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={cardAdjust.reset}
              className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-nd-graphite hover:bg-black/10"
            >
              Centralizar contato
            </button>
            <span className="text-xs text-nd-graphite/50">Arraste a imagem pra mover o cartão de contato</span>
          </div>
        )}
        {!recording && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-nd-graphite/60">Logo</span>
              <button
                type="button"
                onClick={() => setLogoScale((s) => Math.max(0.3, +(s - 0.2).toFixed(2)))}
                className="h-7 w-7 rounded-full bg-black/5 text-sm font-bold text-nd-graphite hover:bg-black/10"
                aria-label="Diminuir tamanho da logo"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setLogoScale((s) => Math.min(10, +(s + 0.2).toFixed(2)))}
                className="h-7 w-7 rounded-full bg-black/5 text-sm font-bold text-nd-graphite hover:bg-black/10"
                aria-label="Aumentar tamanho da logo"
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-nd-graphite/60">Letra</span>
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.max(0.6, +(s - 0.1).toFixed(2)))}
                className="h-7 w-7 rounded-full bg-black/5 text-sm font-bold text-nd-graphite hover:bg-black/10"
                aria-label="Diminuir tamanho da letra"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setFontScale((s) => Math.min(1.8, +(s + 0.1).toFixed(2)))}
                className="h-7 w-7 rounded-full bg-black/5 text-sm font-bold text-nd-graphite hover:bg-black/10"
                aria-label="Aumentar tamanho da letra"
              >
                +
              </button>
            </div>
            {(logoScale !== 1 || fontScale !== 1) && (
              <button
                type="button"
                onClick={() => {
                  setLogoScale(1);
                  setFontScale(1);
                }}
                className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-nd-graphite hover:bg-black/10"
              >
                Tamanho padrão
              </button>
            )}
          </div>
        )}
        {videoObjectUrl && (
          <video
            ref={sourceVideoRef}
            src={videoObjectUrl}
            playsInline
            muted
            preload="auto"
            className="absolute h-px w-px opacity-0"
            style={{ pointerEvents: "none" }}
          />
        )}

        {!supported && (
          <p className="mt-3 max-w-xs text-center text-xs font-medium text-red-600">
            Seu navegador não suporta gravação de vídeo direto na página.
            No computador, tente no Chrome ou Edge. No iPhone, isso funciona
            a partir do iOS 14.3 — atualize o sistema (trocar de navegador
            no iPhone não resolve, todos usam o mesmo motor do Safari).
          </p>
        )}
        {error && (
          <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
        )}

        {recording && (
          <div className="mt-4 w-full max-w-[300px]">
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full bg-nd-amber transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs text-nd-graphite/50">
              Gravando… {Math.round(progress * 100)}%
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={handleRecord}
            disabled={recording || !supported}
            className="rounded-full bg-nd-green-dark px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-nd-green disabled:opacity-60"
          >
            {recording
              ? "Gravando…"
              : photoChoice === "video" && videoObjectUrl
              ? "Gerar vídeo"
              : `Gerar vídeo (${DURATION_S}s)`}
          </button>
          {videoUrl && !recording && (
            <button
              onClick={handleDownload}
              className="rounded-full border-2 border-nd-green-dark px-6 py-2.5 text-sm font-semibold text-nd-green-dark transition hover:bg-nd-green-dark hover:text-white"
            >
              Salvar vídeo (.{videoExt})
            </button>
          )}
        </div>

        {videoUrl && !recording && (
          <>
            <video
              src={videoUrl}
              controls
              loop
              playsInline
              className={`mt-6 rounded-xl ring-1 ring-black/10 ${
                format === "story" ? "w-full max-w-[220px]" : "w-full max-w-[320px]"
              }`}
            />
            <p className="mt-2 text-center text-xs text-nd-graphite/50">
              No celular, se o botão não funcionar: toque e segure o vídeo acima e escolha &quot;Salvar vídeo&quot;.
            </p>
          </>
        )}
      </div>

      <div className="space-y-6 rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5">
        <div>
          <p className="mb-2 text-sm font-medium text-nd-graphite">Formato</p>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                disabled={recording}
                onClick={() => setFormat(f.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  format === f.key
                    ? "bg-nd-green-dark text-white"
                    : "bg-black/5 text-nd-graphite hover:bg-black/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-nd-graphite">Modelo</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={recording}
                onClick={() => setTemplate(t.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  template === t.key
                    ? "bg-nd-green-dark text-white"
                    : "bg-black/5 text-nd-graphite hover:bg-black/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-black/[0.03] p-4">
          <p className="mb-2 text-sm font-medium text-nd-graphite">
            Contato neste post <span className="font-normal text-nd-graphite/50">(opcional)</span>
          </p>
          <div className="space-y-3">
            <Field
              label="Telefone (WhatsApp)"
              value={postPhone}
              onChange={(v) => setPostPhone(formatPhoneBR(v))}
              placeholder="(63) 99999-9999"
              disabled={recording}
            />
            {postPhone && (
              <Field
                label="Nome de quem atende"
                value={postAttendantName}
                onChange={setPostAttendantName}
                placeholder="Ex.: João"
                disabled={recording}
              />
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-nd-graphite/50">
            Preenchendo o telefone, aparece um cartãozinho com ícone do
            WhatsApp, o número e um QR Code que aponta direto pra esse
            número — independente do telefone cadastrado em Contatos. Deixe
            em branco pra não aparecer nada.
          </p>
        </div>

        {activeTemplate.needsPhoto && (
          <PhotoPicker
            source={photoChoice}
            setSource={setPhotoChoice}
            uploadedPhoto={uploadedPhoto}
            setUploadedPhoto={setUploadedPhoto}
            aiPhoto={aiPhoto}
            setAiPhoto={setAiPhoto}
            canvasHeight={activeFormat.height}
            disabled={recording}
            allowVideo
            videoFileName={videoFile?.name ?? null}
            onVideoSelected={setVideoFile}
          />
        )}

        {RICH_FIELD_TEMPLATES.includes(template) ? (
          <>
            <Field label="Linha pequena (acima do título)" value={kicker} onChange={setKicker} disabled={recording} />
            <Field label="Título" value={title} onChange={setTitle} disabled={recording} />
            <Field label="Destaque (linha em verde-limão)" value={highlight} onChange={setHighlight} disabled={recording} />
            <Field label="Texto de apoio" value={body} onChange={setBody} disabled={recording} textarea />
            <Field label="Selo 1" value={badge1} onChange={setBadge1} disabled={recording} />
            <Field label="Selo 2" value={badge2} onChange={setBadge2} disabled={recording} />
            <Field label="Selo 3" value={badge3} onChange={setBadge3} disabled={recording} />
            <Field label="Localização" value={location} onChange={setLocation} disabled={recording} />
            <Field label="Assinatura (estilo manuscrito)" value={signature} onChange={setSignature} disabled={recording} />
          </>
        ) : (
          <>
            <Field
              label={template === "frase" ? "Frase" : "Título"}
              value={title}
              onChange={setTitle}
              disabled={recording}
              textarea={template === "frase"}
            />
            <Field
              label={template === "frase" ? "Assinatura (opcional)" : "Texto de apoio"}
              value={subtitle}
              onChange={setSubtitle}
              disabled={recording}
            />
            {(template === "promocao" || template === "contato") && (
              <Field
                label={template === "contato" ? "Texto do botão" : "Selo de destaque"}
                value={price}
                onChange={setPrice}
                disabled={recording}
              />
            )}
          </>
        )}

        <p className="text-xs leading-relaxed text-nd-graphite/50">
          {photoChoice === "video" && videoObjectUrl
            ? "O vídeo enviado é usado como base do início ao fim, com o áudio original, e sai em .webm — funciona bem no Instagram e WhatsApp. Nada é enviado nem salvo em servidor."
            : `O vídeo é gravado ao vivo no seu navegador (leva ${DURATION_S}s pra gerar) e sai em .webm — funciona bem no Instagram e WhatsApp. Nada é enviado nem salvo em servidor.`}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-nd-graphite">
      {label}
      {textarea ? (
        <textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-nd-green focus:ring-1 focus:ring-nd-green disabled:opacity-50"
        />
      ) : (
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-nd-green focus:ring-1 focus:ring-nd-green disabled:opacity-50"
        />
      )}
    </label>
  );
}
