import type { StyleSpecification } from "maplibre-gl";
import type { BaseMapConfig, BaseMapMode, CountryConfig } from "../types/satellite";

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
    BE: {
        code: "BE",
        name: "Belgium",
        center: [5.3378, 50.9311],
        zoom: 11.2,
        bbox: {
            west: 2.5136,
            south: 49.4969,
            east: 6.4079,
            north: 51.5053,
        },
    },
};

function parseSubdomains(value: string | undefined): string | string[] | undefined {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    if (trimmed.includes(",")) {
        return trimmed
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean);
    }

    return trimmed;
}

function parseMaxZoom(value: string | undefined, fallback = 19): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildTileUrls(baseMap: BaseMapConfig): string[] {
    if (!baseMap.tileUrl.includes("{s}")) {
        return [baseMap.tileUrl];
    }

    const subdomains = Array.isArray(baseMap.subdomains)
        ? baseMap.subdomains
        : typeof baseMap.subdomains === "string"
          ? baseMap.subdomains.split("")
          : ["a", "b", "c"];

    return subdomains.map((subdomain) => baseMap.tileUrl.replaceAll("{s}", subdomain));
}

const defaultTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const styleUrl = import.meta.env.VITE_MAP_STYLE_URL?.trim();
const tileUrl =
    import.meta.env.VITE_BASEMAP_TILE_URL?.trim().length
        ? import.meta.env.VITE_BASEMAP_TILE_URL.trim()
        : defaultTileUrl;

export const BASE_MAP: BaseMapConfig = {
    tileUrl,
    attribution:
        import.meta.env.VITE_BASEMAP_ATTRIBUTION?.trim() ||
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains:
        parseSubdomains(import.meta.env.VITE_BASEMAP_SUBDOMAINS) ??
        (tileUrl.includes("{s}") ? "abc" : undefined),
    maxZoom: parseMaxZoom(import.meta.env.VITE_BASEMAP_MAX_ZOOM),
};

export const FLEMISH_ORTHOPHOTO_BASE_MAP: BaseMapConfig = {
    tileUrl:
        "https://geo.api.vlaanderen.be/OFW/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ofw&STYLE=&FORMAT=image/png&TILEMATRIXSET=GoogleMapsVL&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution:
        '&copy; <a href="https://www.vlaanderen.be/datavindplaats/catalogus/wmts-orthofotowerkbestand" target="_blank" rel="noreferrer">Digitaal Vlaanderen orthofoto</a>',
    maxZoom: 21,
};

export const BASE_MAPS: Record<BaseMapMode, BaseMapConfig> = {
    standard: BASE_MAP,
    flemish_orthophoto: FLEMISH_ORTHOPHOTO_BASE_MAP,
};

export const MAP_STYLE: StyleSpecification | string =
    styleUrl && styleUrl.length > 0
        ? styleUrl
        : {
              version: 8,
              sources: {
                  nationalBasemap: {
                      type: "raster",
                      tiles: buildTileUrls(BASE_MAP),
                      tileSize: 256,
                      maxzoom: BASE_MAP.maxZoom,
                      attribution: BASE_MAP.attribution,
                  },
              },
              layers: [
                  {
                      id: "background",
                      type: "background",
                      paint: {
                          "background-color": "#eaf2f8",
                      },
                  },
                  {
                      id: "national-basemap",
                      type: "raster",
                      source: "nationalBasemap",
                  },
              ],
          };

export const DEFAULT_COUNTRY_CODE =
    (import.meta.env.VITE_DEFAULT_COUNTRY ?? "BE").toUpperCase();

export const DEFAULT_COUNTRY =
    COUNTRY_CONFIGS[DEFAULT_COUNTRY_CODE] ?? COUNTRY_CONFIGS.BE;

export const COUNTRY_OPTIONS = Object.values(COUNTRY_CONFIGS);
