import dayjs from "dayjs";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    FormControlLabel,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Stack,
    Switch,
    Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import type {} from "@mui/x-date-pickers/AdapterDayjs";
import type {
    BBox,
    BaseMapMode,
    CacheMetadata,
    CountryConfig,
    DateRange,
    SceneMetadata,
    SatelliteLayerMode,
} from "../../types/satellite";
import { SATELLITE_LAYER_OPTIONS } from "../../types/satellite";

type ViewMode = "nasa" | "copernicus" | "vlaanderen" | "basemap";

type MapControlsProps = {
    countries: CountryConfig[];
    selectedCountryCode: string;
    onCountryChange: (countryCode: string) => void;
    dateRange: DateRange;
    onDateRangeChange: (value: DateRange) => void;
    layer: SatelliteLayerMode;
    onLayerChange: (value: SatelliteLayerMode) => void;
    cloudThreshold: number;
    onCloudThresholdChange: (value: number) => void;
    currentBBox: BBox | null;
    scene: SceneMetadata | null;
    cache: CacheMetadata | null;
    error: string | null;
    baseMapMode: BaseMapMode;
    viewMode: ViewMode;
    onModeButtonClick: (value: ViewMode) => void;
    nasaDate: string;
    onNasaDateChange: (value: string) => void;
    nasaTimeOffsetDays: number;
    onNasaTimeOffsetDaysChange: (value: number) => void;
    baseOpacity: number;
    onBaseOpacityChange: (value: number) => void;
    ndviBlendEnabled: boolean;
    onNdviBlendEnabledChange: (value: boolean) => void;
    ndviOpacity: number;
    onNdviOpacityChange: (value: number) => void;
    aiOverlayEnabled: boolean;
    onAiOverlayEnabledChange: (value: boolean) => void;
    aiOverlayOpacity: number;
    onAiOverlayOpacityChange: (value: number) => void;
    activeLayers: string[];
};

const CLOUD_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

function formatBBox(bbox: BBox | null): string {
    if (!bbox) {
        return "Awaiting map viewport";
    }

    return `${bbox.west.toFixed(4)}, ${bbox.south.toFixed(4)} -> ${bbox.east.toFixed(4)}, ${bbox.north.toFixed(4)}`;
}

function formatSceneTimestamp(value: string): string {
    return `${value.slice(0, 16).replace("T", " ")} UTC`;
}

export function MapControls({
                                countries,
                                selectedCountryCode,
                                onCountryChange,
                                dateRange,
                                onDateRangeChange,
                                layer,
                                onLayerChange,
                                cloudThreshold,
                                onCloudThresholdChange,
                                currentBBox,
                                scene,
                                cache,
                                error,
                                baseMapMode,
                                viewMode,
                                onModeButtonClick,
                                nasaDate,
                                onNasaDateChange,
                                nasaTimeOffsetDays,
                                onNasaTimeOffsetDaysChange,
                                baseOpacity,
                                onBaseOpacityChange,
                                ndviBlendEnabled,
                                onNdviBlendEnabledChange,
                                ndviOpacity,
                                onNdviOpacityChange,
                                aiOverlayEnabled,
                                onAiOverlayEnabledChange,
                                aiOverlayOpacity,
                                onAiOverlayOpacityChange,
                                activeLayers,
                            }: MapControlsProps) {
    const statusChips = [
        cache?.searchHit ? "Search cache" : "Live search",
        cache?.renderHit ? "Render cache" : "Fresh render",
        cache?.tokenHit == null ? "Token unused" : cache.tokenHit ? "Cached token" : "Fresh token",
    ];

    return (
        <Stack spacing={2}>
            <Card sx={{ borderRadius: { xs: 4, md: 5 } }}>
                <CardContent>
                    <Stack spacing={2.5}>
                        <Box>
                            <Typography variant="h5">Satellite controls</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                Frame the Leaflet view first, then fetch Copernicus imagery only for
                                the current viewport.
                            </Typography>
                        </Box>

                        <FormControl fullWidth size="small">
                            <InputLabel id="country-select-label">Country</InputLabel>
                            <Select
                                labelId="country-select-label"
                                label="Country"
                                value={selectedCountryCode}
                                onChange={(event) => onCountryChange(event.target.value)}
                            >
                                {countries.map((country) => (
                                    <MenuItem key={country.code} value={country.code}>
                                        {country.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button
                                variant={viewMode === "nasa" ? "contained" : "outlined"}
                                onClick={() => onModeButtonClick("nasa")}
                            >
                                NASA
                            </Button>
                            <Button
                                variant={viewMode === "copernicus" ? "contained" : "outlined"}
                                onClick={() => onModeButtonClick("copernicus")}
                            >
                                Copernicus
                            </Button>
                            <Button
                                variant={viewMode === "vlaanderen" ? "contained" : "outlined"}
                                onClick={() => onModeButtonClick("vlaanderen")}
                            >
                                Vlaanderen
                            </Button>
                            <Button
                                variant={viewMode === "basemap" ? "contained" : "outlined"}
                                onClick={() => onModeButtonClick("basemap")}
                            >
                                Basemap
                            </Button>
                        </Stack>

                        {viewMode === "nasa" && (
                            <Stack spacing={1}>
                                <Typography variant="body2" color="text.secondary">
                                    NASA uses public GIBS map tiles for the selected date.
                                </Typography>
                                <DatePicker
                                    label="NASA date"
                                    value={dayjs(nasaDate)}
                                    onChange={(value) => {
                                        if (!value) {
                                            return;
                                        }
                                        onNasaDateChange(value.format("YYYY-MM-DD"));
                                    }}
                                    slotProps={{
                                        textField: { size: "small", fullWidth: true },
                                    }}
                                />
                                <Box sx={{ px: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Time slider ({nasaTimeOffsetDays}d ago)
                                    </Typography>
                                    <Slider
                                        value={nasaTimeOffsetDays}
                                        min={0}
                                        max={30}
                                        step={1}
                                        marks={[
                                            { value: 0, label: "0d" },
                                            { value: 7, label: "7d" },
                                            { value: 14, label: "14d" },
                                            { value: 30, label: "30d" },
                                        ]}
                                        onChange={(_, value) =>
                                            onNasaTimeOffsetDaysChange(value as number)
                                        }
                                    />
                                </Box>
                            </Stack>
                        )}

                        {(viewMode === "copernicus" || viewMode === "vlaanderen") && (
                            <>
                                <Stack spacing={1.5}>
                                    <DatePicker
                                        label="From"
                                        value={dayjs(dateRange.startDate)}
                                        onChange={(value) => {
                                            if (!value) {
                                                return;
                                            }
                                            onDateRangeChange({
                                                ...dateRange,
                                                startDate: value.format("YYYY-MM-DD"),
                                            });
                                        }}
                                        slotProps={{
                                            textField: { size: "small", fullWidth: true },
                                        }}
                                    />
                                    <DatePicker
                                        label="To"
                                        value={dayjs(dateRange.endDate)}
                                        onChange={(value) => {
                                            if (!value) {
                                                return;
                                            }
                                            onDateRangeChange({
                                                ...dateRange,
                                                endDate: value.format("YYYY-MM-DD"),
                                            });
                                        }}
                                        slotProps={{
                                            textField: { size: "small", fullWidth: true },
                                        }}
                                    />
                                </Stack>

                                <FormControl fullWidth size="small">
                                    <InputLabel id="layer-select-label">Layer</InputLabel>
                                    <Select
                                        labelId="layer-select-label"
                                        label="Layer"
                                        value={layer}
                                        onChange={(event) =>
                                            onLayerChange(event.target.value as SatelliteLayerMode)
                                        }
                                    >
                                        {SATELLITE_LAYER_OPTIONS.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl fullWidth size="small">
                                    <InputLabel id="cloud-select-label">Cloud threshold</InputLabel>
                                    <Select
                                        labelId="cloud-select-label"
                                        label="Cloud threshold"
                                        value={String(cloudThreshold)}
                                        onChange={(event) =>
                                            onCloudThresholdChange(Number(event.target.value))
                                        }
                                    >
                                        {CLOUD_OPTIONS.map((value) => (
                                            <MenuItem key={value} value={String(value)}>
                                                {value}%
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={ndviBlendEnabled}
                                            onChange={(event) =>
                                                onNdviBlendEnabledChange(event.target.checked)
                                            }
                                        />
                                    }
                                    label="Blend NDVI layer"
                                />
                            </>
                        )}

                        <Stack spacing={0.5} sx={{ px: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                                Base layer opacity ({Math.round(baseOpacity * 100)}%)
                            </Typography>
                            <Slider
                                value={baseOpacity}
                                min={0.1}
                                max={1}
                                step={0.05}
                                onChange={(_, value) => onBaseOpacityChange(value as number)}
                            />
                        </Stack>

                        {(viewMode === "copernicus" || viewMode === "vlaanderen") && ndviBlendEnabled && (
                            <Stack spacing={0.5} sx={{ px: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                    NDVI opacity ({Math.round(ndviOpacity * 100)}%)
                                </Typography>
                                <Slider
                                    value={ndviOpacity}
                                    min={0.05}
                                    max={1}
                                    step={0.05}
                                    onChange={(_, value) => onNdviOpacityChange(value as number)}
                                />
                            </Stack>
                        )}

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={aiOverlayEnabled}
                                    onChange={(event) =>
                                        onAiOverlayEnabledChange(event.target.checked)
                                    }
                                />
                            }
                            label="AI overlays"
                        />
                        {aiOverlayEnabled && (
                            <Stack spacing={0.5} sx={{ px: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                    AI overlay opacity ({Math.round(aiOverlayOpacity * 100)}%)
                                </Typography>
                                <Slider
                                    value={aiOverlayOpacity}
                                    min={0.1}
                                    max={1}
                                    step={0.05}
                                    onChange={(_, value) => onAiOverlayOpacityChange(value as number)}
                                />
                            </Stack>
                        )}

                        <Typography variant="caption" color="text.secondary">
                            {baseMapMode === "flemish_orthophoto"
                                ? "Vlaanderen basemap enabled."
                                : "Standard basemap enabled."}
                        </Typography>

                        {error && <Alert severity="error">{error}</Alert>}

                        <Divider />

                        <Stack spacing={1.25}>
                            <Typography variant="subtitle2">Viewport bbox</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {formatBBox(currentBBox)}
                            </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {statusChips.map((label) => (
                                <Chip key={label} label={label} size="small" variant="outlined" />
                            ))}
                            {activeLayers.map((label) => (
                                <Chip key={`active-${label}`} label={label} size="small" color="primary" />
                            ))}
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            <Card sx={{ borderRadius: { xs: 4, md: 5 } }}>
                <CardContent>
                    <Stack spacing={1.5}>
                        <Typography variant="h6">Selected scene</Typography>
                        {scene ? (
                            <>
                                <Typography variant="subtitle2">{scene.id}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Captured {formatSceneTimestamp(scene.acquiredAt)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Cloud cover {scene.cloudCover != null ? `${scene.cloudCover.toFixed(1)}%` : "n/a"}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Platform {scene.platform ?? "Sentinel"}
                                </Typography>
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                Adjust the map, then click Load Copernicus imagery to fetch the best
                                scene for the current viewport.
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            <Card sx={{ borderRadius: { xs: 4, md: 5 } }}>
                <CardContent>
                    <Stack spacing={1.5}>
                        <Typography variant="h6">Roadmap hook</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Administrative boundaries, detections, and operational masks can plug into
                            this side panel without changing the map module contract.
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label="Admin boundaries" size="small" />
                            <Chip label="AI detections active" size="small" variant="outlined" />
                            <Chip label="Multi-layer GIS" size="small" variant="outlined" />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}
