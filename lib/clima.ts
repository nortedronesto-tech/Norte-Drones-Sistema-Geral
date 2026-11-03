// Semáforo de clima para aplicação com drone — PURO (sem rede), testado em tests/clima.test.ts.
// Faixas de REFERÊNCIA GERAL (as mesmas do tira-dúvidas). Bula, receituário e agrônomo sempre valem mais.

export type Level = "bom" | "atencao" | "nao";
export const LEVEL_LABEL: Record<Level, string> = { bom: "Bom para aplicar", atencao: "Atenção", nao: "Não aplique" };

export type ClimaInput = {
  windKmh?: number | null;
  gustKmh?: number | null;
  tempC?: number | null;
  humidityPct?: number | null;
  rainNowMm?: number | null;
  rainProbNext?: number | null; // maior chance de chuva (%) nas próximas horas
};

export type ClimaFactor = { id: "vento" | "rajada" | "temperatura" | "umidade" | "chuva"; level: Level; text: string };
export type ClimaResult = { level: Level; factors: ClimaFactor[] };

const n = (v: number, d = 0) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });
const worst = (a: Level, b: Level): Level => (a === "nao" || b === "nao" ? "nao" : a === "atencao" || b === "atencao" ? "atencao" : "bom");
const has = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function evaluateClima(i: ClimaInput): ClimaResult {
  const f: ClimaFactor[] = [];

  if (has(i.windKmh)) {
    const w = i.windKmh;
    if (w > 15) f.push({ id: "vento", level: "nao", text: `Vento forte (${n(w, 1)} km/h): a calda vai para fora do alvo.` });
    else if (w > 10) f.push({ id: "vento", level: "atencao", text: `Vento um pouco forte (${n(w, 1)} km/h): risco de deriva.` });
    else if (w < 3) f.push({ id: "vento", level: "atencao", text: `Quase sem vento (${n(w, 1)} km/h): atenção à inversão térmica e à calda parada no ar.` });
    else f.push({ id: "vento", level: "bom", text: `Vento bom (${n(w, 1)} km/h).` });
  }
  if (has(i.gustKmh) && i.gustKmh > 20) {
    f.push({ id: "rajada", level: "nao", text: `Rajadas de ${n(i.gustKmh)} km/h: espere acalmar.` });
  }
  if (has(i.tempC)) {
    const t = i.tempC;
    if (t > 35) f.push({ id: "temperatura", level: "nao", text: `Muito quente (${n(t, 1)} °C): a calda evapora antes de chegar.` });
    else if (t > 30) f.push({ id: "temperatura", level: "atencao", text: `Quente (${n(t, 1)} °C): evaporação alta, prefira cedo ou fim do dia.` });
    else f.push({ id: "temperatura", level: "bom", text: `Temperatura boa (${n(t, 1)} °C).` });
  }
  if (has(i.humidityPct)) {
    const h = i.humidityPct;
    if (h < 50) f.push({ id: "umidade", level: "nao", text: `Ar muito seco (${n(h)}%): evaporação e deriva.` });
    else if (h < 60) f.push({ id: "umidade", level: "atencao", text: `Ar um pouco seco (${n(h)}%).` });
    else f.push({ id: "umidade", level: "bom", text: `Umidade boa (${n(h)}%).` });
  }
  if (has(i.rainNowMm) && i.rainNowMm > 0) {
    f.push({ id: "chuva", level: "nao", text: "Chovendo agora." });
  } else if (has(i.rainProbNext)) {
    const p = i.rainProbNext;
    if (p >= 70) f.push({ id: "chuva", level: "nao", text: `Chance alta de chuva nas próximas horas (${n(p)}%): a calda pode ser lavada.` });
    else if (p >= 40) f.push({ id: "chuva", level: "atencao", text: `Pode chover nas próximas horas (${n(p)}%).` });
    else f.push({ id: "chuva", level: "bom", text: `Pouca chance de chuva (${n(p)}%).` });
  }

  const level = f.reduce<Level>((acc, x) => worst(acc, x.level), "bom");
  return { level, factors: f };
}

/** Resposta da Open-Meteo (current + hourly de precipitação) → dados do semáforo. */
export function parseOpenMeteo(json: unknown): ClimaInput | null {
  const j = json as { current?: Record<string, unknown>; hourly?: { precipitation_probability?: unknown } } | null;
  const c = j?.current;
  if (!c || typeof c !== "object") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const probs = Array.isArray(j?.hourly?.precipitation_probability) ? (j!.hourly!.precipitation_probability as unknown[]).map(num).filter((x): x is number => x !== null) : [];
  const out: ClimaInput = {
    windKmh: num(c.wind_speed_10m), gustKmh: num(c.wind_gusts_10m), tempC: num(c.temperature_2m),
    humidityPct: num(c.relative_humidity_2m), rainNowMm: num(c.precipitation), rainProbNext: probs.length ? Math.max(...probs) : null,
  };
  return out.windKmh == null && out.tempC == null && out.humidityPct == null ? null : out;
}

/** Local padrão (Palmas-TO) quando o aparelho não libera a localização. */
export const DEFAULT_PLACE = { lat: -10.2491, lon: -48.3243, label: "Palmas-TO" };

export function openMeteoUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4), longitude: lon.toFixed(4),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation",
    hourly: "precipitation_probability", forecast_hours: "4", wind_speed_unit: "kmh", timezone: "America/Araguaina",
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}
