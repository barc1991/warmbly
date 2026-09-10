import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getSerperKeys,
    createSerperKeys,
    deleteSerperKey,
    updateSerperKeyStatus,
    testSerperKey,
    getSerperStats,
    getBDRSettings,
    updateBDRSettings,
    type SerperKeyStatus,
    type BDRSettings,
} from "@/lib/api/client/app/agent/serperKeys";

export const SERPER_KEYS_QUERY_KEY = ["ai", "serper-keys"];
export const SERPER_STATS_QUERY_KEY = ["ai", "serper-stats"];
export const BDR_SETTINGS_QUERY_KEY = ["ai", "bdr-settings"];

export function useSerperKeys() {
    return useQuery({
        queryKey: SERPER_KEYS_QUERY_KEY,
        queryFn: getSerperKeys,
        staleTime: 15_000,
        refetchInterval: 30_000,
    });
}

export function useSerperStats() {
    return useQuery({
        queryKey: SERPER_STATS_QUERY_KEY,
        queryFn: getSerperStats,
        staleTime: 30_000,
    });
}

export function useBDRSettings() {
    return useQuery({
        queryKey: BDR_SETTINGS_QUERY_KEY,
        queryFn: getBDRSettings,
        staleTime: 60_000,
    });
}

export function useCreateSerperKeys() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createSerperKeys,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: SERPER_KEYS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: SERPER_STATS_QUERY_KEY });
        },
    });
}

export function useDeleteSerperKey() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteSerperKey,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: SERPER_KEYS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: SERPER_STATS_QUERY_KEY });
        },
    });
}

export function useUpdateSerperKeyStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: SerperKeyStatus }) =>
            updateSerperKeyStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: SERPER_KEYS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: SERPER_STATS_QUERY_KEY });
        },
    });
}

export function useTestSerperKey() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: testSerperKey,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: SERPER_KEYS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: SERPER_STATS_QUERY_KEY });
        },
    });
}

export function useUpdateBDRSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (settings: BDRSettings) => updateBDRSettings(settings),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: BDR_SETTINGS_QUERY_KEY });
        },
    });
}
