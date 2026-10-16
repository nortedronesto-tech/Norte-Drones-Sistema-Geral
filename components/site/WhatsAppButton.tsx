"use client";

type Props = {
  whatsappLink: string | null;
  label?: string;
  className?: string;
  variant?: "solid" | "outline";
};

export function WhatsAppButton({
  whatsappLink,
  label = "Solicitar orçamento",
  className = "",
  variant = "solid",
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const solid =
    "bg-nd-amber text-nd-green-dark hover:bg-nd-amber/90 focus-visible:ring-nd-amber shadow-card";
  const outline =
    "border-2 border-white/80 text-white hover:bg-white hover:text-nd-green-dark focus-visible:ring-white";

  const style = variant === "solid" ? solid : outline;

  if (!whatsappLink) {
    return (
      <span
        title="Número de WhatsApp ainda não configurado"
        className={`${base} ${style} cursor-not-allowed opacity-60 ${className}`}
      >
        <WhatsAppIcon />
        {label}
      </span>
    );
  }

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${style} ${className}`}
    >
      <WhatsAppIcon />
      {label}
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-current"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.87.5 3.63 1.44 5.17L2 22l5.09-1.53a9.87 9.87 0 0 0 4.95 1.33h.01c5.46 0 9.9-4.45 9.9-9.9C21.96 6.45 17.5 2 12.04 2zm5.8 14.13c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.11a13.6 13.6 0 0 1-1.66-.62c-2.92-1.26-4.83-4.2-4.98-4.4-.15-.2-1.19-1.58-1.19-3.02s.76-2.15 1.03-2.44c.27-.29.6-.36.79-.36h.57c.18 0 .43-.07.67.51.24.58.83 2.01.9 2.16.07.15.11.32.02.51-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.29.29-.12.57.17.29.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.15.46.13.63-.08.17-.2.72-.83.91-1.12.19-.29.38-.24.63-.14.26.1 1.66.78 1.94.92.29.15.48.22.55.34.07.13.07.72-.17 1.4z" />
    </svg>
  );
}
