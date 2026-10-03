import axios from 'axios';

/** A GPU tier cloud runs can use, from the API's price catalogue (not live availability). */
export interface GpuTier {
    id: string;
    name: string;
    vram_gb: number;
    price_per_hour: number;
    recommended_for: string;
}

/** GET /api/v1/training/gpu-tiers, mapped to the field names the CLI displays. */
export async function fetchGpuTiers(base: string, apiKey: string, timeout = 8000): Promise<GpuTier[]> {
    const res = await axios.get(`${base}/api/v1/training/gpu-tiers`, {
        headers: { 'x-api-key': apiKey },
        timeout,
    });
    return (res.data?.gpu_tiers ?? []).map((t: any) => ({
        id: t.id,
        name: t.label ?? t.id,
        vram_gb: t.vram,
        price_per_hour: t.price_hr,
        recommended_for: t.recommended_for ?? '',
    }));
}
