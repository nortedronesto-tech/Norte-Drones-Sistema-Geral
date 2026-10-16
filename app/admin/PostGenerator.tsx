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
  type TemplateKey,
  type FormatKey,
} from "./postCanvas";
import { PhotoPicker, resolvePhotoSrc, type PhotoSource } from "./PhotoPicker";
import { shareOrDownloadFile, dataUrlToBlob } from "./shareFile";
import { usePhotoAdjust, useLogoAdjust } from "./usePhotoAdjust";
import { formatPhoneBR } from "./phoneFormat";

export function PostGenerator({
  siteImages,
  contacts,
}: {
  siteImages: Record<SiteImageKey, string>;
  contacts: SiteContacts;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState<TemplateKey>("servico");
  const [format, setFormat] = useState<FormatKey>("quadrado");
  const [photoChoice, setPhotoChoice] = useState<PhotoSource>("about");
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [aiPhoto, setAiPhoto] = useState<string | null>(null);
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
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  // volta a foto pro centro/sem zoom sempre que a origem da foto muda —
  // um enquadramento manual feito numa foto não faz sentido pra outra.
  useEffect(() => {
    photoAdjust.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoChoice, uploadedPhoto, aiPhoto]);

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

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      setRendering(true);
      setError(null);
      try {
        await loadFonts();

        const logo = await loadImage(siteImages.logoDark);

        let photo: HTMLImageElement | null = null;
        if (activeTemplate.needsPhoto) {
          const src = resolvePhotoSrc(photoChoice, siteImages, uploadedPhoto, aiPhoto);
          if (src) photo = await loadImage(src);
        }

        let qrCode: HTMLImageElement | null = null;
        if (template === "whatsapp" || template === "whatsapp-foto") {
          const link = buildWhatsAppLinkClient(contacts.whatsappNumber, contacts.whatsappMessage);
          if (link) {
            qrCode = await loadQrCode(link);
          } else if (!cancelled) {
            setError(
              "Cadastre o número de WhatsApp na aba Contatos pra gerar o QR code."
            );
          }
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
        if (!cancelled) setPreviewUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        if (!cancelled) {
          const detail = err instanceof Error ? ` (${err.name}: ${err.message})` : "";
          setError(
            `Não foi possível carregar alguma imagem para o post. Tente enviar a foto pelo seu dispositivo.${detail}`
          );
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [
    template,
    format,
    activeFormat.height,
    photoChoice,
    uploadedPhoto,
    aiPhoto,
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

  function handleDownload() {
    if (!previewUrl) return;
    // toDataURL é síncrono (ao contrário de toBlob), então o clique do
    // usuário ainda "conta" quando chega no navigator.share — em alguns
    // celulares o compartilhar/baixar falha silenciosamente se isso vier
    // de um callback assíncrono.
    const blob = dataUrlToBlob(previewUrl);
    shareOrDownloadFile(blob, `norte-drones-${template}-${format}.png`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5">
        <canvas ref={canvasRef} width={W} height={activeFormat.height} className="hidden" />
        {previewUrl && (() => {
          const hasCard = Boolean(postPhone);
          const target =
            dragTarget === "photo" && !activeTemplate.needsPhoto
              ? "logo"
              : dragTarget === "card" && !hasCard
              ? "logo"
              : dragTarget;
          const adjust = target === "logo" ? logoAdjust : target === "card" ? cardAdjust : photoAdjust;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Prévia do post"
              onPointerDown={adjust.onDragStart}
              onPointerMove={adjust.onDragMove}
              onPointerUp={adjust.onDragEnd}
              onPointerCancel={adjust.onDragEnd}
              className={`h-auto touch-none cursor-move select-none rounded-xl ring-1 ring-black/10 ${
                format === "story" ? "w-full max-w-[260px]" : "w-full max-w-[420px]"
              }`}
            />
          );
        })()}
        {previewUrl && (activeTemplate.needsPhoto || postPhone) && (
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
        {activeTemplate.needsPhoto && previewUrl && dragTarget === "photo" && (
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
        {previewUrl && dragTarget === "logo" && (
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
        {postPhone && previewUrl && dragTarget === "card" && (
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
        {previewUrl && (
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
        {rendering && (
          <p className="mt-3 text-xs text-nd-graphite/50">Gerando prévia…</p>
        )}
        {error && (
          <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
        )}
        <button
          onClick={handleDownload}
          disabled={rendering || !previewUrl}
          className="mt-6 rounded-full bg-nd-green-dark px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-nd-green disabled:opacity-60"
        >
          Salvar imagem ({W}×{activeFormat.height})
        </button>
        <p className="mt-2 text-center text-xs text-nd-graphite/50">
          No celular, se o botão não funcionar: toque e segure a imagem acima e escolha &quot;Salvar imagem&quot;.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5">
        <div>
          <p className="mb-2 text-sm font-medium text-nd-graphite">Formato</p>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormat(f.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
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
                onClick={() => setTemplate(t.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
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
            />
            {postPhone && (
              <Field
                label="Nome de quem atende"
                value={postAttendantName}
                onChange={setPostAttendantName}
                placeholder="Ex.: João"
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
          />
        )}

        {RICH_FIELD_TEMPLATES.includes(template) ? (
          <>
            <Field label="Linha pequena (acima do título)" value={kicker} onChange={setKicker} />
            <Field label="Título" value={title} onChange={setTitle} />
            <Field label="Destaque (linha em verde-limão)" value={highlight} onChange={setHighlight} />
            <Field label="Texto de apoio" value={body} onChange={setBody} textarea />
            <Field label="Selo 1" value={badge1} onChange={setBadge1} />
            <Field label="Selo 2" value={badge2} onChange={setBadge2} />
            <Field label="Selo 3" value={badge3} onChange={setBadge3} />
            <Field label="Localização" value={location} onChange={setLocation} />
            <Field label="Assinatura (estilo manuscrito)" value={signature} onChange={setSignature} />
          </>
        ) : (
          <>
            <Field
              label={template === "frase" ? "Frase" : "Título"}
              value={title}
              onChange={setTitle}
              textarea={template === "frase"}
            />
            <Field
              label={template === "frase" ? "Assinatura (opcional)" : "Texto de apoio"}
              value={subtitle}
              onChange={setSubtitle}
            />
            {(template === "promocao" || template === "contato") && (
              <Field
                label={template === "contato" ? "Texto do botão" : "Selo de destaque"}
                value={price}
                onChange={setPrice}
              />
            )}
          </>
        )}

        <p className="text-xs leading-relaxed text-nd-graphite/50">
          A imagem é gerada no seu navegador — nada é enviado nem salvo. Baixe
          e poste onde quiser.
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-nd-graphite">
      {label}
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-nd-green focus:ring-1 focus:ring-nd-green"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-nd-green focus:ring-1 focus:ring-nd-green"
        />
      )}
    </label>
  );
}
