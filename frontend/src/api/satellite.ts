import { API_BASE, fetchWithAuth } from "./client";
import type {
    LatestImageRequest,
    LatestImageResponse,
    RenderImageRequest,
    RenderImageResponse,
} from "../types/satellite";

const SATELLITE_API_BASE =
    import.meta.env.VITE_SATELLITE_API_BASE ??
    API_BASE.replace(/\/api\/v1\/?$/, "/api/satellite");

type RawBBox = {
    west: number;
    south: number;
    east: number;
    north: number;
};

type RawSceneMetadata = {
    id: string;
    collection: string;
    acquired_at: string;
    cloud_cover: number | null;
    platform: string | null;
    thumbnail_href: string | null;
    bbox: RawBBox;
};

type RawImageAsset = {
    asset_id: string;
    content_type: string;
    size_bytes: number;
    url: string | null;
    data_url: string | null;
};

type RawCacheMetadata = {
    backend: string;
    search_hit: boolean;
    render_hit: boolean;
    asset_hit: boolean;
    token_hit: boolean | null;
    search_key: string;
    render_key: string;
};

type RawImageResponse = {
    bbox: RawBBox;
    collection: string;
    layer: LatestImageResponse["layer"];
    scene: RawSceneMetadata;
    image: RawImageAsset;
    cache: RawCacheMetadata;
};

function mapResponse(response: RawImageResponse): LatestImageResponse {
    return {
        bbox: response.bbox,
        collection: response.collection,
        layer: response.layer,
        scene: {
            id: response.scene.id,
            collection: response.scene.collection,
            acquiredAt: response.scene.acquired_at,
            cloudCover: response.scene.cloud_cover,
            platform: response.scene.platform,
            thumbnailHref: response.scene.thumbnail_href,
            bbox: response.scene.bbox,
        },
        image: {
            assetId: response.image.asset_id,
            contentType: response.image.content_type,
            sizeBytes: response.image.size_bytes,
            url: response.image.url,
            dataUrl: response.image.data_url,
        },
        cache: {
            backend: response.cache.backend,
            searchHit: response.cache.search_hit,
            renderHit: response.cache.render_hit,
            assetHit: response.cache.asset_hit,
            tokenHit: response.cache.token_hit,
            searchKey: response.cache.search_key,
            renderKey: response.cache.render_key,
        },
    };
}

function toRawRequest(
    request: LatestImageRequest | RenderImageRequest
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        bbox: request.bbox,
        date_range: {
            start_date: request.dateRange.startDate,
            end_date: request.dateRange.endDate,
        },
        collection: request.collection ?? "sentinel-2-l2a",
        layer: request.layer,
        cloud_threshold: request.cloudThreshold,
        width: request.width,
        height: request.height,
    };

    if ("sceneId" in request && request.sceneId) {
        payload.scene_id = request.sceneId;
    }

    return payload;
}

async function satelliteJsonFetch<T>(
    path: string,
    options: RequestInit
): Promise<T> {
    const response = await fetchWithAuth(`${SATELLITE_API_BASE}${path}`, options);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(error.detail ?? "Request failed");
    }

    return response.json() as Promise<T>;
}

export async function getLatestSatelliteImage(
    request: LatestImageRequest,
    signal?: AbortSignal
): Promise<LatestImageResponse> {
    const response = await satelliteJsonFetch<RawImageResponse>("/latest-image", {
        method: "POST",
        body: JSON.stringify(toRawRequest(request)),
        signal,
    });
    return mapResponse(response);
}

export async function renderSatelliteImage(
    request: RenderImageRequest,
    signal?: AbortSignal
): Promise<RenderImageResponse> {
    const response = await satelliteJsonFetch<RawImageResponse>("/render", {
        method: "POST",
        body: JSON.stringify(toRawRequest(request)),
        signal,
    });
    return mapResponse(response);
}

export async function fetchSatelliteAsset(
    assetIdOrUrl: string,
    signal?: AbortSignal
): Promise<Blob> {
    const assetUrl = /^https?:\/\//.test(assetIdOrUrl)
        ? assetIdOrUrl
        : assetIdOrUrl.startsWith("/")
        ? `${new URL(API_BASE).origin}${assetIdOrUrl}`
        : `${SATELLITE_API_BASE}/assets/${assetIdOrUrl}`;

    const response = await fetchWithAuth(assetUrl, { signal });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Asset request failed" }));
        throw new Error(error.detail ?? "Asset request failed");
    }

    return response.blob();
}
