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

function expandBBox(bbox: BBox, paddingRatio = 0.18): BBox {
    const lngPadding = (bbox.east - bbox.west) * paddingRatio;
    const latPadding = (bbox.north - bbox.south) * paddingRatio;

    return {
        west: bbox.west - lngPadding,
        south: bbox.south - latPadding,
        east: bbox.east + lngPadding,
        north: bbox.north + latPadding,
    };
}

function toLeafletBounds(bbox: BBox): LatLngBounds {
    return L.latLngBounds(
        [bbox.south, bbox.west],
        [bbox.north, bbox.east]
    );
}

function boundsToBBox(map: LeafletMap): BBox {
    const bounds = map.getBounds();
    return {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
    };
}

function overlayFilter(layer: RasterOverlayLayer["layer"]): string {
    return layer === "ndvi"
        ? "none"
        : "brightness(1.28) contrast(1.18) saturate(1.1)";
}

function createTileLayer(baseMap: BaseMapConfig): TileLayer {
    const options: TileLayerOptions = {
        attribution: baseMap.attribution,
        maxZoom: baseMap.maxZoom ?? 19,
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
    const rasterLayerRefs = useRef<Layer[]>([]);
    const aiLayerGroupRef = useRef<LayerGroup | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);

    const onViewportChangeRef = useRef(onViewportChange);
    const onViewportSizeChangeRef = useRef(onViewportSizeChange);

    const clearRasterLayers = useCallback((instance: LeafletMap | null) => {
        rasterLayerRefs.current.forEach((layerInstance) => {
            safelyRemoveLayer(instance, layerInstance);
        });
        rasterLayerRefs.current = [];
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
            center: [
                initialCountryRef.current.center[1],
                initialCountryRef.current.center[0],
            ],
            zoom: initialCountryRef.current.zoom,
            zoomControl: false,
            attributionControl: true,
            worldCopyJump: false,
            maxBoundsViscosity: 1,
        });

        L.control.zoom({ position: "topright" }).addTo(instance);
        instance.setMaxBounds(toLeafletBounds(expandBBox(initialCountryRef.current.bbox)));

        const syncViewport = () => emitViewport(instance);

        instance.whenReady(() => {
            instance.setView(
                [
                    initialCountryRef.current.center[1],
                    initialCountryRef.current.center[0],
                ],
                initialCountryRef.current.zoom,
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
            [country.center[1], country.center[0]],
            country.zoom,
            { animate: true }
        );
    }, [country]);

    useEffect(() => {
        const instance = mapRef.current;
        if (!instance) {
            return;
        }

        const baseMap = BASE_MAPS[baseMapMode];
        const tileLayer = createTileLayer(baseMap);
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
        tileLayer.addTo(instance);
        tileLayerRef.current?.remove();
        tileLayerRef.current = tileLayer;

        return () => {
            tileLayer.off("load", handleTileLoad);
            tileLayer.off("tileerror", handleTileError);
            safelyRemoveLayer(instance, tileLayer);
            if (tileLayerRef.current === tileLayer) {
                tileLayerRef.current = null;
            }
        };
    }, [baseMapMode]);

    useEffect(() => {
        const instance = mapRef.current;
        if (!instance) {
            return;
        }

        clearRasterLayers(instance);

        for (const overlay of overlays) {
            if (!overlay.visible) {
                continue;
            }

            if (overlay.sourceType === "tile") {
                const tileLayer = L.tileLayer(overlay.imageUrl, {
                    attribution: "NASA GIBS / Earthdata",
                    maxNativeZoom: 9,
                    maxZoom: 18,
                    crossOrigin: true,
                    opacity: overlay.opacity,
                });
                tileLayer.addTo(instance);
                rasterLayerRefs.current.push(tileLayer);
                continue;
            }

            const imageLayer = L.imageOverlay(overlay.imageUrl, toLeafletBounds(overlay.bbox), {
                interactive: false,
                opacity: overlay.opacity,
            });
            imageLayer.on("load", () => {
                const image = imageLayer.getElement();
                if (image) {
                    image.style.filter = overlayFilter(overlay.layer);
                    image.style.mixBlendMode = overlay.blendMode ?? "normal";
                }
            });
            imageLayer.addTo(instance);
            rasterLayerRefs.current.push(imageLayer);
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
    }, [aiDetections, aiOverlayEnabled, aiOverlayOpacity, clearAiLayer, clearRasterLayers, overlays]);

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
