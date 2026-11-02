"use client";

import { useEffect, useState } from "react";
import type { SiteContacts } from "@/lib/content-store";
import { SITE_IMAGE_FIELDS, SiteImageKey } from "@/lib/site-image-fields";
import { PostGenerator } from "./PostGenerator";
import { VideoGenerator } from "./VideoGenerator";
import { UsersManager } from "./UsersManager";
import { BackupPanel } from "./BackupPanel";
import { IntegrationsPanel } from "./IntegrationsPanel";
import { formatPhoneBR } from "./phoneFormat";

const EMPTY: SiteContacts = {
  whatsappNumber: "",
  whatsappMessage: "",
  phone: "",
  email: "",
  instagramHandle: "",
  instagramUrl: "",
  address: "",
  areaServed: "",
};

type TabKey = "contatos" | "imagens" | "posts" | "video" | "usuarios" | "integracoes" | "backup";

export type { TabKey };

// A aba vem da rota (/gestao/marketing/[aba] e /gestao/sistema/[aba]); o menu lateral substitui a barra de abas.
export default function AdminDashboard({
  siteImages,
  isAdmin = false,
  tab,
}: {
  siteImages: Record<SiteImageKey, string>;
  isAdmin?: boolean;
  tab: TabKey;
}) {
  const [form, setForm] = useState<SiteContacts>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/content")
      .then((res) => res.json())
      .then((data) => {
        if (data?.contacts) setForm(data.contacts);
      })
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof SiteContacts>(key: K, value: SiteContacts[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro ao salvar." });
        return;
      }
      setForm(data.content.contacts);
      setMessage({ type: "ok", text: "Contatos atualizados com sucesso." });
    } catch {
      setMessage({ type: "error", text: "Erro de conexão ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-nd-graphite/60">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      {tab === "contatos" && (
      <form onSubmit={handleSubmit} className="mt-2 space-y-6 rounded-2xl bg-white p-6 md:p-8 shadow-card ring-1 ring-black/5">
        <Field
          label="Número de WhatsApp (com DDI e DDD, apenas números)"
          placeholder="Ex.: 5563999999999"
          value={form.whatsappNumber}
          onChange={(v) => update("whatsappNumber", v)}
        />
        <Field
          label="Mensagem padrão do WhatsApp"
          placeholder="Olá! Vim pelo site da Norte Drones..."
          value={form.whatsappMessage}
          onChange={(v) => update("whatsappMessage", v)}
          textarea
        />
        <Field
          label="Telefone"
          placeholder="(63) 99999-9999"
          value={form.phone}
          onChange={(v) => update("phone", formatPhoneBR(v))}
        />
        <Field
          label="E-mail"
          placeholder="contato@nortedrones.com.br"
          type="email"
          value={form.email}
          onChange={(v) => update("email", v)}
        />
        <Field
          label="Instagram (usuário)"
          placeholder="@nortedrones"
          value={form.instagramHandle}
          onChange={(v) => update("instagramHandle", v)}
        />
        <Field
          label="Instagram (link completo)"
          placeholder="https://instagram.com/nortedrones"
          value={form.instagramUrl}
          onChange={(v) => update("instagramUrl", v)}
        />
        <Field
          label="Endereço"
          placeholder="Porto Nacional - TO"
          value={form.address}
          onChange={(v) => update("address", v)}
        />
        <Field
          label="Área de atuação (texto exibido no site)"
          placeholder="Porto Nacional, Palmas e região (Tocantins)"
          value={form.areaServed}
          onChange={(v) => update("areaServed", v)}
        />

        {message && (
          <p
            className={`text-sm font-medium ${
              message.type === "ok" ? "text-nd-green" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-nd-green-dark px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-nd-green disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </form>
      )}

      {tab === "imagens" && (
      <div className="mt-8 rounded-2xl bg-white p-8 shadow-card ring-1 ring-black/5">
        <h2 className="text-lg font-bold text-nd-green-dark">Imagens do site</h2>
        <p className="mt-1 text-sm text-nd-graphite/70">
          Envie uma nova imagem para substituir a atual. A troca aparece no
          site após a página recarregar.
        </p>
        <div className="mt-6 space-y-6">
          {SITE_IMAGE_FIELDS.map((field) => (
            <ImageUploader key={field.key} imageKey={field.key} label={field.label} accept={field.accept} />
          ))}
        </div>
      </div>
      )}

      {tab === "posts" && (
        <div className="mt-8">
          <PostGenerator siteImages={siteImages} contacts={form} />
        </div>
      )}

      {isAdmin && tab === "usuarios" && <UsersManager />}
      {isAdmin && tab === "integracoes" && <IntegrationsPanel />}
      {isAdmin && tab === "backup" && <BackupPanel />}

      {tab === "video" && (
        <div className="mt-8">
          <VideoGenerator siteImages={siteImages} contacts={form} />
        </div>
      )}
    </div>
  );
}

function ImageUploader({
  imageKey,
  label,
  accept,
}: {
  imageKey: string;
  label: string;
  accept: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("key", imageKey);
      formData.append("file", file);
      const res = await fetch("/api/admin/images", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Erro ao enviar imagem." });
        return;
      }
      setMessage({ type: "ok", text: "Imagem atualizada com sucesso." });
    } catch {
      setMessage({ type: "error", text: "Erro de conexão ao enviar imagem." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-black/5 pb-6 last:border-none last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-nd-graphite">{label}</p>
        {message && (
          <p
            className={`mt-1 text-xs font-medium ${
              message.type === "ok" ? "text-nd-green" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
      <label className="inline-flex w-fit cursor-pointer items-center rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-nd-graphite hover:bg-black/5">
        {uploading ? "Enviando..." : "Trocar imagem"}
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-nd-graphite">
      {label}
      {textarea ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-nd-green focus:ring-1 focus:ring-nd-green"
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-nd-green focus:ring-1 focus:ring-nd-green"
        />
      )}
    </label>
  );
}
