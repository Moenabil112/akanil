import { createHash } from "node:crypto";

export const TAADEN_PARSER_VERSION = "TAADEN_HTML_V1";

export type TaadeenAssetType =
  | "RECONNAISSANCE_LICENCE"
  | "EXPLORATION_LICENCE"
  | "EXPLOITATION_LICENCE"
  | "MINING_LICENCE"
  | "UNKNOWN";

export interface TaadeenLicenceRecord {
  license_number: string;
  license_type_label: string;
  asset_type: TaadeenAssetType;
  investor_name: string | null;
  cr_number: string | null;
  unified_number: string | null;
  issuance_date: string | null;
  expiry_date: string | null;
  total_area_km2: number | null;
  region: string | null;
  mineral_class: string | null;
  coordinates: Array<{ longitude: number; latitude: number }>;
  geometry_geojson: {
    type: "Polygon";
    coordinates: number[][][];
  } | null;
  source_updated_at: string | null;
}

export interface TaadeenParseResult {
  ok: boolean;
  record: TaadeenLicenceRecord | null;
  errors: string[];
  warnings: string[];
  normalized_hash: string | null;
}

const TYPE_MAP: Array<[RegExp, TaadeenAssetType, string]> = [
  [/\bExploration License\b/i, "EXPLORATION_LICENCE", "Exploration License"],
  [/\bReconnaissance License\b/i, "RECONNAISSANCE_LICENCE", "Reconnaissance License"],
  [/\bExploitation License\b/i, "EXPLOITATION_LICENCE", "Exploitation License"],
  [/\bMining License\b/i, "MINING_LICENCE", "Mining License"],
];

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&deg;/gi, "°")
    .replace(/&sup2;/gi, "²")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_match, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    );
}

export function htmlToTaadeenText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr|td|th)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function firstMatch(text: string, regex: RegExp): string | null {
  const match = text.match(regex);
  return match?.[1]?.trim() || null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function dmsToDecimal(value: string): number | null {
  const match = value
    .trim()
    .match(/^(-?\d{1,3})\s*[-°:]\s*(\d{1,2})\s*[-':]\s*(\d{1,2}(?:\.\d+)?)$/);
  if (!match) return null;

  const degrees = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (
    !Number.isFinite(degrees) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    minutes >= 60 ||
    seconds >= 60
  ) {
    return null;
  }

  const sign = degrees < 0 ? -1 : 1;
  return sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
}

function parseCoordinates(text: string): Array<{ longitude: number; latitude: number }> {
  const coordinates: Array<{ longitude: number; latitude: number }> = [];
  const regex =
    /X:\s*(-?\d{1,3}\s*[-°:]\s*\d{1,2}\s*[-':]\s*\d{1,2}(?:\.\d+)?)\s*Y:\s*(-?\d{1,3}\s*[-°:]\s*\d{1,2}\s*[-':]\s*\d{1,2}(?:\.\d+)?)/gi;

  for (const match of text.matchAll(regex)) {
    const longitude = dmsToDecimal(match[1]);
    const latitude = dmsToDecimal(match[2]);
    if (
      longitude !== null &&
      latitude !== null &&
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90
    ) {
      coordinates.push({ longitude, latitude });
    }
  }

  return coordinates;
}

function polygonFromCoordinates(
  coordinates: Array<{ longitude: number; latitude: number }>,
): TaadeenLicenceRecord["geometry_geojson"] {
  if (coordinates.length < 3) return null;
  const ring = coordinates.map((point) => [point.longitude, point.latitude]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

function parseTaadeenDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  );
  if (!match) return null;

  const [, day, month, year, hourRaw, minute, meridiem] = match;
  let hour = Number(hourRaw) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;

  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${String(
    hour,
  ).padStart(2, "0")}:${minute}:00+03:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeSimpleDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? value : null;
}

function assetType(text: string): {
  type: TaadeenAssetType;
  label: string;
} {
  for (const [pattern, type, label] of TYPE_MAP) {
    if (pattern.test(text)) return { type, label };
  }
  return { type: "UNKNOWN", label: "Unknown License" };
}

function extractInvestorName(text: string): string | null {
  const match = text.match(
    /Class:\s*[A-D]\s+([\s\S]{1,300}?)\s+License Details\b/i,
  );
  if (!match) return null;
  const candidate = match[1]
    .replace(/^(A|B|C|D)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return candidate && candidate.length <= 240 ? candidate : null;
}

export function canonicalTaadeenPayload(record: TaadeenLicenceRecord): string {
  return JSON.stringify({
    license_number: record.license_number,
    license_type_label: record.license_type_label,
    asset_type: record.asset_type,
    investor_name: record.investor_name,
    cr_number: record.cr_number,
    unified_number: record.unified_number,
    issuance_date: record.issuance_date,
    expiry_date: record.expiry_date,
    total_area_km2: record.total_area_km2,
    region: record.region,
    mineral_class: record.mineral_class,
    coordinates: record.coordinates.map((point) => ({
      longitude: Number(point.longitude.toFixed(8)),
      latitude: Number(point.latitude.toFixed(8)),
    })),
    source_updated_at: record.source_updated_at,
  });
}

export function taadeenPayloadHash(record: TaadeenLicenceRecord): string {
  return createHash("sha256")
    .update(canonicalTaadeenPayload(record))
    .digest("hex");
}

export function changedTaadeenFields(
  previous: TaadeenLicenceRecord | null,
  current: TaadeenLicenceRecord,
): string[] {
  if (!previous) return [];
  const previousCanonical = JSON.parse(canonicalTaadeenPayload(previous)) as Record<string, unknown>;
  const currentCanonical = JSON.parse(canonicalTaadeenPayload(current)) as Record<string, unknown>;
  return Object.keys(currentCanonical).filter(
    (key) =>
      JSON.stringify(previousCanonical[key]) !== JSON.stringify(currentCanonical[key]),
  );
}

export function parseTaadeenLicenceHtml(
  html: string,
  expectedLicenseNumber?: string,
): TaadeenParseResult {
  const text = htmlToTaadeenText(html);
  const errors: string[] = [];
  const warnings: string[] = [];
  const type = assetType(text);

  const licenseNumber = firstMatch(
    text,
    /License Number\s*([A-Za-z0-9][A-Za-z0-9-]{2,40})/i,
  );
  const area = parseNumber(
    firstMatch(text, /Total Area:\s*([0-9]+(?:\.[0-9]+)?)\s*km²/i) ??
      firstMatch(text, /Area:\s*([0-9]+(?:\.[0-9]+)?)\s*km²/i),
  );
  const region = firstMatch(
    text,
    /Region:\s*([^\n]{2,120}?)(?=\s+Class:|\s+Coordinates|\s+License Details|$)/i,
  );
  const mineralClass = firstMatch(text, /Class:\s*([A-D])\b/i);
  const coordinates = parseCoordinates(text);
  const sourceUpdatedRaw = firstMatch(
    text,
    /Last Modified Date:\s*(\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i,
  );

  if (!licenseNumber) errors.push("LICENSE_NUMBER_MISSING");
  if (expectedLicenseNumber && licenseNumber !== expectedLicenseNumber) {
    errors.push("LICENSE_NUMBER_MISMATCH");
  }
  if (type.type === "UNKNOWN") errors.push("LICENSE_TYPE_UNRECOGNIZED");
  if (area === null) errors.push("AREA_MISSING_OR_INVALID");
  if (!region) errors.push("REGION_MISSING");
  if (!mineralClass) warnings.push("MINERAL_CLASS_MISSING");
  if (coordinates.length < 3) warnings.push("PUBLIC_COORDINATES_INCOMPLETE");

  if (!licenseNumber) {
    return {
      ok: false,
      record: null,
      errors,
      warnings,
      normalized_hash: null,
    };
  }

  const record: TaadeenLicenceRecord = {
    license_number: licenseNumber,
    license_type_label: type.label,
    asset_type: type.type,
    investor_name: extractInvestorName(text),
    cr_number: firstMatch(text, /CR Number\s*([A-Za-z0-9-]+)/i),
    unified_number: firstMatch(text, /Unified Number\s*([A-Za-z0-9-]+)/i),
    issuance_date: normalizeSimpleDate(
      firstMatch(text, /Issuance Date\s*(\d{4}-\d{2}-\d{2})/i),
    ),
    expiry_date: normalizeSimpleDate(
      firstMatch(text, /Expiry Date\s*(\d{4}-\d{2}-\d{2})/i),
    ),
    total_area_km2: area,
    region,
    mineral_class: mineralClass ? `CLASS_${mineralClass.toUpperCase()}` : null,
    coordinates,
    geometry_geojson: polygonFromCoordinates(coordinates),
    source_updated_at: parseTaadeenDate(sourceUpdatedRaw),
  };

  return {
    ok: errors.length === 0,
    record,
    errors,
    warnings,
    normalized_hash: errors.length === 0 ? taadeenPayloadHash(record) : null,
  };
}
