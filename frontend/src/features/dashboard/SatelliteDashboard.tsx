import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import {
    Box,
    Chip,
    Stack,
} from "@mui/material";
import { getLatestSatelliteImage, renderSatelliteImage } from "../../api/satellite";
import { CountryMap } from "../../components/map/CountryMap";
import { MapControls } from "../../components/map/MapControls";
import { PageHeader } from "../../components/ui/PageHeader";
import { PageShell } from "../../components/ui/PageShell";
import { useDebouncedBounds } from "../../hooks/useDebouncedBounds";
import {
    COUNTRY_OPTIONS,
    DEFAULT_COUNTRY,
    FLEMISH_ORTHOPHOTO_BASE_MAP,
} from "../../config/countries";
import type {
    AIDetectionOverlay,
    BBox,
    BaseMapMode,
    CacheMetadata,
    DateRange,
    RasterOverlayLayer,
    SceneMetadata,
    SatelliteLayerMode,
} from "../../types/satellite";

const DEFAULT_COLLECTION = "sentinel-2-l2a";

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function defaultDateRange(): DateRange {
    return {
        startDate: dayjs().subtract(21, "day").format("YYYY-MM-DD"),
        endDate: dayjs().format("YYYY-MM-DD"),
    };
}

function revokeObjectUrl(url: string | null) {
    if (url?.startsWith("blob:")) {
        URL.revokeObjectURL(url);
    }
}

function synthesizeAIDetections(bbox: BBox): AIDetectionOverlay[] {
    const width = bbox.east - bbox.west;
    const height = bbox.north - bbox.south;
    const anchorPoints: Array<[number, number, number, string]> = [
        [0.28, 0.72, 0.91, "Flood risk"],
        [0.54, 0.48, 0.84, "Heat anomaly"],
        [0.73, 0.31, 0.77, "Vegetation stress"],
    ];
    return anchorPoints.map(([x, y, confidence, label], index) => ({
        id: `ai-${index}`,
        label,
        confidence,
        point: [bbox.west + width * x, bbox.south + height * y],
    }));
}

type ViewMode = "nasa" | "copernicus" | "vlaanderen" | "basemap";

export function SatelliteDashboard() {
    const [selectedCountryCode, setSelectedCountryCode] = useState(DEFAULT_COUNTRY.code);
    const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
    const [layer, setLayer] = useState<SatelliteLayerMode>("true_color");
    const [cloudThreshold, setCloudThreshold] = useState(25);
    const [baseMapMode, setBaseMapMode] = useState<BaseMapMode>("standard");
    const [currentBBox, setCurrentBBox] = useState<BBox | null>(null);
    const [overlayStack, setOverlayStack] = useState<RasterOverlayLayer[]>([]);
    const [aiDetections, setAiDetections] = useState<AIDetectionOverlay[]>([]);
    const [baseOpacity, setBaseOpacity] = useState(0.85);
    const [ndviBlendEnabled, setNdviBlendEnabled] = useState(false);
    const [ndviOpacity, setNdviOpacity] = useState(0.56);
    const [aiOverlayEnabled, setAiOverlayEnabled] = useState(true);
    const [aiOverlayOpacity, setAiOverlayOpacity] = useState(0.82);
    const [nasaTimeOffsetDays, setNasaTimeOffsetDays] = useState(0);
    const [scene, setScene] = useState<SceneMetadata | null>(null);
    const [cacheMetadata, setCacheMetadata] = useState<CacheMetadata | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapSize, setMapSize] = useState<{ width: number; height: number } | null>(null);

    const requestIdRef = useRef(0);
    const activeObjectUrlRef = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("copernicus");

    const [nasaDate, setNasaDate] = useState(dayjs().format("YYYY-MM-DD"));

    const country =
        COUNTRY_OPTIONS.find((item) => item.code === selectedCountryCode) ?? DEFAULT_COUNTRY;
    const requestWidth = mapSize ? clamp(mapSize.width, 384, 1280) : null;
    const requestHeight = mapSize ? clamp(mapSize.height, 384, 1280) : null;
    const debouncedBBox = useDebouncedBounds(currentBBox, 600);

    useEffect(() => {
        setCurrentBBox(null);
    }, [country]);

    useEffect(() => {
        setNasaDate(dayjs().subtract(nasaTimeOffsetDays, "day").format("YYYY-MM-DD"));
    }, [nasaTimeOffsetDays]);

    useEffect(() => {
        if (viewMode === "vlaanderen") {
            setBaseMapMode("flemish_orthophoto");
        } else {
            setBaseMapMode("standard");
        }
    }, [viewMode]);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
            revokeObjectUrl(activeObjectUrlRef.current);
        };
    }, []);

    useEffect(() => {
        setOverlayStack((current) =>
            current.map((item) =>
                item.id === "primary" || item.id === "nasa-primary" || item.id === "vlaanderen-primary"
                    ? { ...item, opacity: baseOpacity }
                    : item
            )
        );
    }, [baseOpacity]);

    useEffect(() => {
        setOverlayStack((current) =>
            current.map((item) =>
                item.id === "ndvi" ? { ...item, opacity: ndviOpacity } : item
            )
        );
    }, [ndviOpacity]);

    const loadNasa = useCallback((bbox: BBox, date: string, opacity: number) => {
        const tileUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
        setOverlayStack([
            {
                id: "nasa-primary",
                label: "NASA True color",
                sourceType: "tile",
                imageUrl: tileUrl,
                bbox,
                layer: "true_color",
                opacity,
                visible: true,
                blendMode: "normal",
            },
        ]);
        setAiDetections(synthesizeAIDetections(bbox));
        setScene({
            id: "nasa-gibs",
            collection: "nasa-gibs",
            acquiredAt: date + "T00:00:00Z",
            cloudCover: null,
            platform: "NASA VIIRS",
            thumbnailHref: null,
            bbox,
        });
        setCacheMetadata({
            backend: "nasa-gibs",
            searchHit: false,
            renderHit: false,
            assetHit: false,
            tokenHit: null,
            searchKey: "nasa",
            renderKey: date,
        });
        setError(null);
    }, []);

    const loadVlaanderen = useCallback((bbox: BBox, opacity: number) => {
        setOverlayStack([
            {
                id: "vlaanderen-primary",
                label: "Vlaanderen Orthophoto",
                sourceType: "tile",
                imageUrl: FLEMISH_ORTHOPHOTO_BASE_MAP.tileUrl,
                bbox,
                layer: "true_color",
                opacity,
                visible: true,
                blendMode: "normal",
            },
        ]);
        setAiDetections(synthesizeAIDetections(bbox));
        setScene({
            id: "vlaanderen-orthophoto",
            collection: "vlaanderen-orthophoto",
            acquiredAt: dayjs().toISOString(),
            cloudCover: null,
            platform: "Digitaal Vlaanderen",
            thumbnailHref: null,
            bbox,
        });
        setCacheMetadata({
            backend: "vlaanderen-wmts",
            searchHit: false,
            renderHit: false,
            assetHit: false,
            tokenHit: null,
            searchKey: "vlaanderen",
            renderKey: "ofw",
        });
        setError(null);
    }, []);

    const loadCopernicus = useCallback(
        async (bbox: BBox) => {
            const w = requestWidth ?? 1024;
            const h = requestHeight ?? 768;

            const currentRequestId = requestIdRef.current + 1;
            requestIdRef.current = currentRequestId;

            abortControllerRef.current?.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;

            setLoading(true);
            setError(null);

            try {
                const response = await getLatestSatelliteImage(
                    {
                        bbox,
                        dateRange,
                        collection: DEFAULT_COLLECTION,
                        layer,
                        cloudThreshold,
                        width: w,
                        height: h,
                    },
                    controller.signal
                );

                const imageUrl = response.image.dataUrl ?? response.image.url;
                if (!imageUrl) {
                    throw new Error("Copernicus image payload was empty.");
                }
                if (controller.signal.aborted || currentRequestId !== requestIdRef.current) {
                    return;
                }

                revokeObjectUrl(activeObjectUrlRef.current);
                activeObjectUrlRef.current = imageUrl.startsWith("blob:") ? imageUrl : null;

                const nextLayers: RasterOverlayLayer[] = [
                    {
                        id: "primary",
                        label: "Primary raster",
                        sourceType: "image",
                        imageUrl,
                        bbox: response.bbox,
                        layer: response.layer,
                        opacity: baseOpacity,
                        visible: true,
                        blendMode: "normal",
                    },
                ];

                if (ndviBlendEnabled && layer !== "ndvi") {
                    try {
                        const ndviResponse = await renderSatelliteImage(
                            {
                                bbox,
                                dateRange,
                                collection: DEFAULT_COLLECTION,
                                layer: "ndvi",
                                cloudThreshold,
                                width: w,
                                height: h,
                                sceneId: response.scene.id,
                            },
                            controller.signal
                        );
                        const ndviUrl = ndviResponse.image.dataUrl ?? ndviResponse.image.url;
                        if (ndviUrl) {
                            nextLayers.push({
                                id: "ndvi",
                                label: "NDVI blend",
                                sourceType: "image",
                                imageUrl: ndviUrl,
                                bbox: ndviResponse.bbox,
                                layer: "ndvi",
                                opacity: ndviOpacity,
                                visible: true,
                                blendMode: "multiply",
                            });
                        }
                    } catch {
                        // NDVI blend fetch failed — continue with primary only
                    }
                }

                setOverlayStack(nextLayers);
                setAiDetections(synthesizeAIDetections(bbox));
                setScene(response.scene);
                setCacheMetadata(response.cache);
            } catch (requestError) {
                if (controller.signal.aborted) {
                    return;
                }
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : "Unable to load Copernicus imagery."
                );
            } finally {
                if (currentRequestId === requestIdRef.current) {
                    setLoading(false);
                }
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null;
                }
            }
        },
        [baseOpacity, cloudThreshold, dateRange, layer, ndviBlendEnabled, ndviOpacity, requestHeight, requestWidth]
    );

    const handleModeButtonClick = useCallback(
        (mode: ViewMode) => {
            setViewMode(mode);
            if (!currentBBox) return;

            if (mode === "basemap") {
                setOverlayStack([]);
                setScene(null);
                setCacheMetadata(null);
                setError(null);
                return;
            }
            if (mode === "nasa") {
                loadNasa(currentBBox, nasaDate, baseOpacity);
                return;
            }
            if (mode === "vlaanderen") {
                loadVlaanderen(currentBBox, baseOpacity);
                return;
            }
            void loadCopernicus(currentBBox);
        },
        [baseOpacity, currentBBox, loadCopernicus, loadNasa, loadVlaanderen, nasaDate]
    );

    // Auto-reload Copernicus imagery when viewport changes (zoom/pan).
    // Tile-based sources (NASA, Vlaanderen) handle zoom natively.
    const prevDebouncedBBoxRef = useRef<BBox | null>(null);
    useEffect(() => {
        if (!debouncedBBox) return;
        if (prevDebouncedBBoxRef.current === null) {
            prevDebouncedBBoxRef.current = debouncedBBox;
            return;
        }
        prevDebouncedBBoxRef.current = debouncedBBox;
        if (viewMode !== "copernicus") return;
        void loadCopernicus(debouncedBBox);
    }, [debouncedBBox, viewMode, loadCopernicus]);

    return (
        <PageShell
            maxWidth={false}
            sx={{ minHeight: "calc(100vh - 80px)" }}
        >
            <PageHeader
                eyebrow="National satellite operations"
                title="Belgium-first Copernicus workspace"
                description="The dashboard opens on the configured national market, lets the operator frame the exact viewport first, and only requests backend-proxied Copernicus imagery when explicitly triggered."
                meta={
                    <>
                        <Chip label={`Country: ${country.name}`} variant="outlined" />
                        <Chip label={`Layer: ${layer.replace("_", " ")}`} variant="outlined" />
                        <Chip label={`Cloud <= ${cloudThreshold}%`} variant="outlined" />
                    </>
                }
            />

            <Box
                sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: {
                        xs: "1fr",
                        lg: "minmax(0, 1fr) 360px",
                    },
                    alignItems: "stretch",
                    minHeight: { xs: "auto", lg: "calc(100vh - 250px)" },
                }}
            >
                <Stack sx={{ minHeight: { xs: 460, md: 620, lg: "100%" } }}>
                    <CountryMap
                        country={country}
                        baseMapMode={baseMapMode}
                        overlays={overlayStack}
                        aiDetections={aiDetections}
                        aiOverlayEnabled={aiOverlayEnabled}
                        aiOverlayOpacity={aiOverlayOpacity}
                        loading={loading}
                        onViewportChange={setCurrentBBox}
                        onViewportSizeChange={setMapSize}
                    />
                </Stack>

                <Box
                    sx={{
                        position: { lg: "sticky" },
                        top: { lg: 96 },
                        alignSelf: { lg: "start" },
                    }}
                >
                    <MapControls
                        countries={COUNTRY_OPTIONS}
                        selectedCountryCode={selectedCountryCode}
                        onCountryChange={setSelectedCountryCode}
                        dateRange={dateRange}
                        onDateRangeChange={setDateRange}
                        layer={layer}
                        onLayerChange={setLayer}
                        cloudThreshold={cloudThreshold}
                        onCloudThresholdChange={setCloudThreshold}
                        currentBBox={currentBBox}
                        scene={scene}
                        cache={cacheMetadata}
                        error={error}
                        baseMapMode={baseMapMode}
                        viewMode={viewMode}
                        onModeButtonClick={handleModeButtonClick}
                        nasaDate={nasaDate}
                        onNasaDateChange={(value) => {
                            setNasaDate(value);
                            const days = dayjs().startOf("day").diff(dayjs(value).startOf("day"), "day");
                            setNasaTimeOffsetDays(clamp(days, 0, 30));
                        }}
                        nasaTimeOffsetDays={nasaTimeOffsetDays}
                        onNasaTimeOffsetDaysChange={setNasaTimeOffsetDays}
                        baseOpacity={baseOpacity}
                        onBaseOpacityChange={setBaseOpacity}
                        ndviBlendEnabled={ndviBlendEnabled}
                        onNdviBlendEnabledChange={setNdviBlendEnabled}
                        ndviOpacity={ndviOpacity}
                        onNdviOpacityChange={setNdviOpacity}
                        aiOverlayEnabled={aiOverlayEnabled}
                        onAiOverlayEnabledChange={setAiOverlayEnabled}
                        aiOverlayOpacity={aiOverlayOpacity}
                        onAiOverlayOpacityChange={setAiOverlayOpacity}
                        activeLayers={overlayStack.map((item) => item.label)}
                    />
                </Box>
            </Box>
        </PageShell>
    );
}
