export type SiteImageKey = "hero" | "about" | "logoLight" | "logoDark";

export const SITE_IMAGE_FIELDS: {
  key: SiteImageKey;
  label: string;
  accept: string;
}[] = [
  {
    key: "hero",
    label: "Imagem principal (topo do site)",
    accept: "image/jpeg,image/png,image/webp",
  },
  {
    key: "about",
    label: 'Imagem da seção "Sobre"',
    accept: "image/jpeg,image/png,image/webp",
  },
  {
    key: "logoLight",
    label: "Logo (versão clara, usada no cabeçalho)",
    accept: "image/png,image/svg+xml,image/webp",
  },
  {
    key: "logoDark",
    label: "Logo (versão escura, usada no rodapé)",
    accept: "image/png,image/svg+xml,image/webp",
  },
];
