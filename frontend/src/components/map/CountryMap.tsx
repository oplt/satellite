import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import {
    Alert,
    Box,
    Chip,
    LinearProgress,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import L, {
    type Layer,
    type LayerGroup,
    type LatLngBounds,
    type Map as LeafletMap,
    type TileLayer,
    type TileLayerOptions,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_MAPS } from "../../config/countries";
import type {
    AIDetectionOverlay,
    BBox,
    BaseMapConfig,
    BaseMapMode,
    CountryConfig,
    RasterOverlayLayer,
} from "../../types/satellite";

type CountryMapProps = {
    country: CountryConfig;
    baseMapMode: BaseMapMode;
    overlays: RasterOverlayLayer[];
    aiDetections: AIDetectionOverlay[];
    aiOverlayEnabled: boolean;
    aiOverlayOpacity: number;
    loading: boolean;
    onViewportChange: (bbox: BBox) => void;
    onViewportSizeChange: (size: { width: number; height: number }) => void;
};

const WEB_MERCATOR_LAT_LIMIT = 85.05112878;
const MIN_MAP_ZOOM = 5;
const MAX_MAP_ZOOM = 21;
const TILE_KEEP_BUFFER = 2;
const WORLD_TILE_BOUNDS = L.latLngBounds(
    [-WEB_MERCATOR_LAT_LIMIT, -180],
    [WEB_MERCATOR_LAT_LIMIT, 180]
);

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function sanitizeZoom(zoom: number, fallback = 8): number {
    if (!Number.isFinite(zoom)) {
        return fallback;
    }

    return clamp(Math.round(zoom * 4) / 4, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
}

function sanitizeLng(lng: number): number {
    return Number.isFinite(lng) ? clamp(lng, -180, 180) : 0;
}

function sanitizeLat(lat: number): number {
    return Number.isFinite(lat) ? clamp(lat, -WEB_MERCATOR_LAT_LIMIT, WEB_MERCATOR_LAT_LIMIT) : 0;
}

function sanitizeBBox(bbox: BBox): BBox {
    const west = sanitizeLng(Math.min(bbox.west, bbox.east));
    const east = sanitizeLng(Math.max(bbox.west, bbox.east));
    const south = sanitizeLat(Math.min(bbox.south, bbox.north));
    const north = sanitizeLat(Math.max(bbox.south, bbox.north));

    // Leaflet can enter an invalid tile-range state if bounds collapse to a
    // point/line. Keep a tiny valid extent so projected tile bounds stay finite.
    const minSpan = 0.0001;
    return {
        west,
        south,
        east: east <= west ? clamp(west + minSpan, -180, 180) : east,
        north: north <= south ? clamp(south + minSpan, -WEB_MERCATOR_LAT_LIMIT, WEB_MERCATOR_LAT_LIMIT) : north,
    };
}

function expandBBox(bbox: BBox, paddingRatio = 0.18): BBox {
    const safeBBox = sanitizeBBox(bbox);
    const lngPadding = (safeBBox.east - safeBBox.west) * paddingRatio;
    const latPadding = (safeBBox.north - safeBBox.south) * paddingRatio;

    return sanitizeBBox({
        west: safeBBox.west - lngPadding,
        south: safeBBox.south - latPadding,
        east: safeBBox.east + lngPadding,
        north: safeBBox.north + latPadding,
    });
}

function toLeafletBounds(bbox: BBox): LatLngBounds {
    const safeBBox = sanitizeBBox(bbox);
    return L.latLngBounds(
        [safeBBox.south, safeBBox.west],
        [safeBBox.north, safeBBox.east]
    );
}

function countryCenter(country: CountryConfig): [number, number] {
    return [sanitizeLat(country.center[1]), sanitizeLng(country.center[0])];
}

function boundsToBBox(map: LeafletMap): BBox {
    const bounds = map.getBounds();
    return sanitizeBBox({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
    });
}

function overlayFilter(layer: RasterOverlayLayer["layer"]): string {
    return layer === "ndvi"
        ? "none"
        : "brightness(1.28) contrast(1.18) saturate(1.1)";
}

function createTileLayer(baseMap: BaseMapConfig, bounds: LatLngBounds): TileLayer {
    const maxZoom = sanitizeZoom(baseMap.maxZoom ?? MAX_MAP_ZOOM, 19);
    const options: TileLayerOptions = {
        attribution: baseMap.attribution,
        bounds,
        noWrap: true,
        minZoom: MIN_MAP_ZOOM,
        maxNativeZoom: maxZoom,
        maxZoom: MAX_MAP_ZOOM,
        tileSize: 256,
        keepBuffer: TILE_KEEP_BUFFER,
        updateWhenIdle: true,
        updateWhenZooming: false,
        crossOrigin: true,
    };

    if (baseMap.subdomains !== undefined) {
        options.subdomains = baseMap.subdomains;
    }

    return L.tileLayer(baseMap.tileUrl, options);
}

function safelyRemoveLayer(map: LeafletMap | null, layer: Layer | null) {
    if (!map || !layer) {
        return;
    }
    try {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        } else {
            layer.remove();
        }
    } catch {
        // Ignore stale layer detach races during rapid mode switches.
    }
}

type TrackedRasterLayer = Layer & {
    __overlaySourceType?: RasterOverlayLayer["sourceType"];
};

function applyImageLayerStyles(imageLayer: L.ImageOverlay, overlay: RasterOverlayLayer) {
    const image = imageLayer.getElement();
    if (!image) {
        return;
    }

    image.style.filter = overlayFilter(overlay.layer);
    image.style.mixBlendMode = overlay.blendMode ?? "normal";
}

export function CountryMap({
    country,
    baseMapMode,
    overlays,
    aiDetections,
    aiOverlayEnabled,
    aiOverlayOpacity,
    loading,
    onViewportChange,
    onViewportSizeChange,
}: CountryMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const initialCountryRef = useRef(country);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const tileLayerRef = useRef<TileLayer | null>(null);
    const rasterLayerRefs = useRef<Map<string, Layer>>(new Map());
    const aiLayerGroupRef = useRef<LayerGroup | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);

    const onViewportChangeRef = useRef(onViewportChange);
    const onViewportSizeChangeRef = useRef(onViewportSizeChange);

    const clearRasterLayers = useCallback((instance: LeafletMap | null) => {
        rasterLayerRefs.current.forEach((layerInstance) => {
            safelyRemoveLayer(instance, layerInstance);
        });
        rasterLayerRefs.current.clear();
    }, []);

    const clearAiLayer = useCallback((instance: LeafletMap | null) => {
        safelyRemoveLayer(instance, aiLayerGroupRef.current);
        aiLayerGroupRef.current = null;
    }, []);

    useLayoutEffect(() => {
        onViewportChangeRef.current = onViewportChange;
        onViewportSizeChangeRef.current = onViewportSizeChange;
    });

    const emitViewport = useCallback((instance: LeafletMap) => {
        onViewportChangeRef.current(boundsToBBox(instance));
        const container = instance.getContainer();
        onViewportSizeChangeRef.current({
            width: Math.round(container.clientWidth),
            height: Math.round(container.clientHeight),
        });
    }, []);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) {
            return;
        }

        const instance = L.map(containerRef.current, {
            center: countryCenter(initialCountryRef.current),
            zoom: sanitizeZoom(initialCountryRef.current.zoom),
            minZoom: MIN_MAP_ZOOM,
            maxZoom: MAX_MAP_ZOOM,
            zoomSnap: 0.25,
            zoomDelta: 0.5,
            zoomControl: false,
            attributionControl: true,
            worldCopyJump: false,
            maxBoundsViscosity: 0.8,
            preferCanvas: true,
        });

        L.control.zoom({ position: "topright" }).addTo(instance);
        instance.setMaxBounds(toLeafletBounds(expandBBox(initialCountryRef.current.bbox)));

        const syncViewport = () => emitViewport(instance);

        instance.whenReady(() => {
            instance.setView(
                countryCenter(initialCountryRef.current),
                sanitizeZoom(initialCountryRef.current.zoom),
                { animate: false }
            );
            syncViewport();
            setMapLoaded(true);
        });

        instance.on("moveend", syncViewport);
        instance.on("zoomend", syncViewport);
        instance.on("resize", syncViewport);

        resizeObserverRef.current = new ResizeObserver(() => {
            instance.invalidateSize(false);
            syncViewport();
        });
        resizeObserverRef.current.observe(containerRef.current);

        mapRef.current = instance;

        return () => {
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;
            clearRasterLayers(instance);
            clearAiLayer(instance);
            safelyRemoveLayer(instance, tileLayerRef.current);
            tileLayerRef.current = null;
            instance.off("moveend", syncViewport);
            instance.off("zoomend", syncViewport);
            instance.off("resize", syncViewport);
            instance.remove();
            mapRef.current = null;
            setMapLoaded(false);
        };
    }, [clearAiLayer, clearRasterLayers, emitViewport]);

    useEffect(() => {
        const instance = mapRef.current;
        if (!instance) {
            return;
        }

        instance.setMaxBounds(toLeafletBounds(expandBBox(country.bbox)));
        instance.setView(
            countryCenter(country),
            sanitizeZoom(country.zoom),
            { animate: true }
        );
    }, [country]);

    useEffect(() => {
        const instance = mapRef.current;
        if (!instance) {
            return;
        }

        const baseMap = BASE_MAPS[baseMapMode];
        const tileBounds =
            baseMapMode === "flemish_orthophoto"
                ? toLeafletBounds(expandBBox(country.bbox, 0.35))
                : WORLD_TILE_BOUNDS;
        const tileLayer = createTileLayer(baseMap, tileBounds);
        const handleTileLoad = () => {
            setMapLoaded(true);
            setMapError(null);
        };
        const handleTileError = () => {
            setMapLoaded(true);
            setMapError(
                baseMapMode === "flemish_orthophoto"
                    ? "Flemish orthophoto tiles failed to load for this area."
                    : "Base map tiles failed to load."
            );
        };

        setMapLoaded(false);
        setMapError(null);

        tileLayer.on("load", handleTileLoad);
        tileLayer.on("tileerror", handleTileError);
        safelyRemoveLayer(instance, tileLayerRef.current);
        tileLayer.addTo(instance);
        tileLayerRef.current = tileLayer;

        return () => {
            tileLayer.off("load", handleTileLoad);
            tileLayer.off("tileerror", handleTileError);
            safelyRemoveLayer(instance, tileLayer);
            if (tileLayerRef.current === tileLayer) {
                tileLayerRef.current = null;
            }
        };
    }, [baseMapMode, country]);

    useEffect(() => {
        const instance = mapRef.current;
        if (!instance) {
            return;
        }

        const visibleOverlays = overlays.filter((overlay) => overlay.visible);
        const visibleOverlayIds = new Set(visibleOverlays.map((overlay) => overlay.id));

        for (const [id, layerInstance] of rasterLayerRefs.current.entries()) {
            if (!visibleOverlayIds.has(id)) {
                safelyRemoveLayer(instance, layerInstance);
                rasterLayerRefs.current.delete(id);
            }
        }

        for (const overlay of visibleOverlays) {
            const existingLayer = rasterLayerRefs.current.get(overlay.id) as TrackedRasterLayer | undefined;

            if (existingLayer && existingLayer.__overlaySourceType !== overlay.sourceType) {
                safelyRemoveLayer(instance, existingLayer);
                rasterLayerRefs.current.delete(overlay.id);
            }

            const currentLayer = rasterLayerRefs.current.get(overlay.id) as TrackedRasterLayer | undefined;

            if (currentLayer) {
                if (overlay.sourceType === "tile") {
                    const tileLayer = currentLayer as TileLayer;
                    tileLayer.setUrl(overlay.imageUrl, false);
                    tileLayer.setOpacity(overlay.opacity);
                } else {
                    const imageLayer = currentLayer as L.ImageOverlay;
                    imageLayer.setUrl(overlay.imageUrl);
                    imageLayer.setBounds(toLeafletBounds(overlay.bbox));
                    imageLayer.setOpacity(overlay.opacity);
                    applyImageLayerStyles(imageLayer, overlay);
                }
                continue;
            }

            if (overlay.sourceType === "tile") {
                const overlayMaxNativeZoom = sanitizeZoom(
                    overlay.maxNativeZoom ?? overlay.maxZoom ?? 18,
                    18
                );
                const tileLayer = L.tileLayer(overlay.imageUrl, {
                    attribution: overlay.label,
                    bounds: WORLD_TILE_BOUNDS,
                    noWrap: true,
                    minZoom: MIN_MAP_ZOOM,
                    maxNativeZoom: overlayMaxNativeZoom,
                    maxZoom: MAX_MAP_ZOOM,
                    tileSize: 256,
                    keepBuffer: TILE_KEEP_BUFFER,
                    updateWhenIdle: true,
                    updateWhenZooming: false,
                    crossOrigin: true,
                    opacity: overlay.opacity,
                }) as TrackedRasterLayer & TileLayer;

                tileLayer.__overlaySourceType = "tile";
                tileLayer.addTo(instance);
                rasterLayerRefs.current.set(overlay.id, tileLayer);
                continue;
            }

            const imageLayer = L.imageOverlay(overlay.imageUrl, toLeafletBounds(overlay.bbox), {
                interactive: false,
                opacity: overlay.opacity,
            }) as TrackedRasterLayer & L.ImageOverlay;

            imageLayer.__overlaySourceType = "image";
            imageLayer.on("load", () => applyImageLayerStyles(imageLayer, overlay));
            imageLayer.addTo(instance);
            applyImageLayerStyles(imageLayer, overlay);
            rasterLayerRefs.current.set(overlay.id, imageLayer);
        }

        clearAiLayer(instance);
        if (aiOverlayEnabled && aiDetections.length > 0) {
            const group = L.layerGroup();
            aiDetections.forEach((detection) => {
                const marker = L.circleMarker(
                    [detection.point[1], detection.point[0]],
                    {
                        radius: 7 + Math.round(detection.confidence * 4),
                        color: "rgba(239, 68, 68, 0.95)",
                        weight: 1.2,
                        fillColor: "rgba(248, 113, 113, 0.95)",
                        fillOpacity: Math.max(0.2, aiOverlayOpacity),
                    }
                );
                marker.bindTooltip(
                    `${detection.label} (${Math.round(detection.confidence * 100)}%)`,
                    { direction: "top", offset: [0, -8] }
                );
                marker.addTo(group);
            });
            group.addTo(instance);
            aiLayerGroupRef.current = group;
        }
    }, [aiDetections, aiOverlayEnabled, aiOverlayOpacity, clearAiLayer, overlays]);

    return (
        <Paper
            sx={{
                position: "relative",
                overflow: "hidden",
                minHeight: { xs: 460, md: 620 },
                height: "70%",
                display: "flex",
                flexDirection: "column",
                width: "100%",
                borderRadius: { xs: 4, md: 5 },
                "& .leaflet-container": {
                    width: "100%",
                    height: "100%",
                    background:
                        "linear-gradient(180deg, rgba(234, 242, 248, 1) 0%, rgba(221, 232, 239, 1) 100%)",
                    fontFamily: "inherit",
                },
                "& .leaflet-control-zoom a": {
                    backgroundColor: "rgba(255, 255, 255, 0.92)",
                    color: "#111827",
                    borderBottomColor: "rgba(148, 163, 184, 0.35)",
                },
                "& .leaflet-control-attribution": {
                    backgroundColor: "rgba(255, 255, 255, 0.82)",
                    backdropFilter: "blur(8px)",
                },
                "& .leaflet-image-layer": {
                    imageRendering: "auto",
                },
            }}
        >
            {loading && (
                <LinearProgress
                    sx={{
                        position: "absolute",
                        inset: "0 0 auto 0",
                        zIndex: 3,
                    }}
                />
            )}
            <Box
                ref={containerRef}
                sx={{
                    position: "absolute",
                    inset: 0,
                }}
            />
            {!mapLoaded && !mapError && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 1,
                        display: "grid",
                        placeItems: "center",
                        pointerEvents: "none",
                        background:
                            "radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.12), transparent 32%), radial-gradient(circle at 80% 0%, rgba(16, 185, 129, 0.12), transparent 28%)",
                    }}
                >
                    <Paper elevation={0} sx={{ px: 2, py: 1.5, borderRadius: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                            Loading base map...
                        </Typography>
                    </Paper>
                </Box>
            )}
            {mapError && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: "16px 16px auto 16px",
                        zIndex: 3,
                    }}
                >
                    <Alert severity="warning">{mapError}</Alert>
                </Box>
            )}
            <Box
                sx={{
                    position: "absolute",
                    left: 16,
                    bottom: 16,
                    zIndex: 2,
                    pointerEvents: "none",
                }}
            >
                <Paper
                    elevation={0}
                    sx={(theme) => ({
                        p: 1.5,
                        maxWidth: 280,
                        borderRadius: 3,
                        border: `1px solid ${theme.palette.divider}`,
                        backgroundColor:
                            theme.palette.mode === "dark"
                                ? "rgba(15, 23, 42, 0.82)"
                                : "rgba(255, 255, 255, 0.82)",
                        backdropFilter: "blur(10px)",
                    })}
                >
                    <Stack spacing={1}>
                        <Typography variant="subtitle2">National overlays</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Country scope stays primary. Administrative layers can slot in here
                            next without changing the map shell.
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label="Country extent" size="small" color="primary" />
                            <Chip label="Multi-layer stack" size="small" variant="outlined" />
                            <Chip label="AI overlays" size="small" variant="outlined" />
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </Paper>
    );
}
