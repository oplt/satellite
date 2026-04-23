export type SatelliteLayerMode = "true_color" | "false_color" | "ndvi";

export interface BBox {
    west: number;
    south: number;
    east: number;
    north: number;
}

export interface CountryConfig {
    code: string;
    name: string;
    center: [number, number];
    zoom: number;
    bbox: BBox;
}

export interface BaseMapConfig {
    tileUrl: string;
    attribution: string;
    subdomains?: string | string[];
    maxZoom?: number;
}

export type BaseMapMode = "standard" | "flemish_orthophoto";

export interface DateRange {
    startDate: string;
    endDate: string;
}

export interface SceneMetadata {
    id: string;
    collection: string;
    acquiredAt: string;
    cloudCover: number | null;
    platform: string | null;
    thumbnailHref: string | null;
    bbox: BBox;
}

export interface ImageAssetReference {
    assetId: string;
    contentType: string;
    sizeBytes: number;
    url: string | null;
    dataUrl: string | null;
}

export interface CacheMetadata {
    backend: string;
    searchHit: boolean;
    renderHit: boolean;
    assetHit: boolean;
    tokenHit: boolean | null;
    searchKey: string;
    renderKey: string;
}

export interface LatestImageRequest {
    bbox: BBox;
    dateRange: DateRange;
    collection?: string;
    layer: SatelliteLayerMode;
    cloudThreshold: number;
    width: number;
    height: number;
}

export interface LatestImageResponse {
    bbox: BBox;
    collection: string;
    layer: SatelliteLayerMode;
    scene: SceneMetadata;
    image: ImageAssetReference;
    cache: CacheMetadata;
}

export interface RenderImageRequest extends LatestImageRequest {
    sceneId?: string | null;
}

export type RenderImageResponse = LatestImageResponse;

export interface MapOverlay {
    imageUrl: string;
    bbox: BBox;
    layer: SatelliteLayerMode;
    collection: string;
    scene: SceneMetadata;
    cache: CacheMetadata;
}

export type OverlaySourceType = "image" | "tile";

export interface RasterOverlayLayer {
    id: string;
    label: string;
    sourceType: OverlaySourceType;
    imageUrl: string;
    bbox: BBox;
    layer: SatelliteLayerMode;
    opacity: number;
    visible: boolean;
    blendMode?: "normal" | "multiply" | "screen";
}

export interface AIDetectionOverlay {
    id: string;
    label: string;
    point: [number, number];
    confidence: number;
}

export const SATELLITE_LAYER_OPTIONS: Array<{
    label: string;
    value: SatelliteLayerMode;
}> = [
    { label: "True color", value: "true_color" },
    { label: "False color", value: "false_color" },
    { label: "NDVI", value: "ndvi" },
];
