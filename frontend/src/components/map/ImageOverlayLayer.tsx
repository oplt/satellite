import { useEffect } from "react";
import type { ImageSource, Map } from "maplibre-gl";
import type { MapOverlay } from "../../types/satellite";

const SOURCE_ID = "copernicus-image-source";
const LAYER_ID = "copernicus-image-layer";

function bboxToCoordinates(overlay: MapOverlay) {
    return [
        [overlay.bbox.west, overlay.bbox.north],
        [overlay.bbox.east, overlay.bbox.north],
        [overlay.bbox.east, overlay.bbox.south],
        [overlay.bbox.west, overlay.bbox.south],
    ] as [[number, number], [number, number], [number, number], [number, number]];
}

function removeOverlay(map: Map) {
    if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
    }

    if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
    }
}

function findOverlayBeforeLayerId(map: Map): string | undefined {
    return map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
}

function getOverlayPaint(overlay: MapOverlay) {
    if (overlay.layer === "ndvi") {
        return {
            "raster-opacity": 0.82,
            "raster-resampling": "linear" as const,
            "raster-brightness-min": 0,
            "raster-brightness-max": 1,
            "raster-contrast": 0,
            "raster-saturation": 0.05,
            "raster-fade-duration": 0,
        };
    }

    return {
        "raster-opacity": 0.76,
        "raster-resampling": "linear" as const,
        "raster-brightness-min": 0.14,
        "raster-brightness-max": 1,
        "raster-contrast": 0.18,
        "raster-saturation": 0.14,
        "raster-fade-duration": 0,
    };
}

export function ImageOverlayLayer({
    map,
    overlay,
}: {
    map: Map | null;
    overlay: MapOverlay | null;
}) {
    useEffect(() => {
        if (!map) {
            return;
        }

        if (!overlay) {
            if (map.isStyleLoaded()) {
                removeOverlay(map);
            }
            return;
        }

        const upsertOverlay = () => {
            const coordinates = bboxToCoordinates(overlay);
            const source = map.getSource(SOURCE_ID) as ImageSource | undefined;
            const paint = getOverlayPaint(overlay);

            if (source) {
                source.updateImage({
                    url: overlay.imageUrl,
                    coordinates,
                });
            } else {
                map.addSource(SOURCE_ID, {
                    type: "image",
                    url: overlay.imageUrl,
                    coordinates,
                });
            }

            if (!map.getLayer(LAYER_ID)) {
                map.addLayer({
                    id: LAYER_ID,
                    type: "raster",
                    source: SOURCE_ID,
                    paint,
                }, findOverlayBeforeLayerId(map));
                return;
            }

            for (const [property, value] of Object.entries(paint)) {
                map.setPaintProperty(LAYER_ID, property, value);
            }
        };

        if (map.isStyleLoaded()) {
            upsertOverlay();
            return;
        }

        map.once("style.load", upsertOverlay);
        return () => {
            map.off("style.load", upsertOverlay);
        };
    }, [map, overlay]);

    return null;
}
