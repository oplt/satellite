import type { BBox } from "../types/satellite";
import { useDebounce } from "./useDebounce";

export function useDebouncedBounds(bounds: BBox | null, delay = 650): BBox | null {
    return useDebounce(bounds, delay);
}
