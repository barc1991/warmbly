import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getGeminiKeys,
    createGeminiKeys,
    deleteGeminiKey,
    updateGeminiKeyStatus,
    testGeminiKey,
    getGeminiConfig,
    updateGeminiConfig,
    type GeminiKeyStatus,
    type GeminiOrgConfig,
} from "@/lib/api/client/app/agent/geminiKeys";

export const GEMINI_KEYS_QUERY_KEY = ["ai", "gemini-keys"];
export const GEMINI_CONFIG_QUERY_KEY = ["ai", "gemini-config"];

export function useGeminiKeys() {
    return useQuery({
        queryKey: GEMINI_KEYS_QUERY_KEY,
        queryFn: getGeminiKeys,
        staleTime: 15_000,
        refetchInterval: 30_000, // Refresh key health / cooldown countdowns
    });
}

export function useGeminiConfig() {
    return useQuery({
        queryKey: GEMINI_CONFIG_QUERY_KEY,
        queryFn: getGeminiConfig,
        staleTime: 30_000,
    });
}

export function useCreateGeminiKeys() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createGeminiKeys,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: GEMINI_KEYS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: GEMINI_CONFIG_QUERY_KEY });
        },
    });
}

export function useDeleteGeminiKey() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: deleteGeminiKey,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: GEMINI_KEYS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: GEMINI_CONFIG_QUERY_KEY });
        },
    });
}

export function useUpdateGeminiKeyStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: GeminiKeyStatus }) =>
            updateGeminiKeyStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: GEMINI_KEYS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: GEMINI_CONFIG_QUERY_KEY });
        },
    });
}

export function useTestGeminiKey() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: testGeminiKey,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: GEMINI_KEYS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: GEMINI_CONFIG_QUERY_KEY });
        },
    });
}

export function useUpdateGeminiConfig() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (cfg: GeminiOrgConfig) => updateGeminiConfig(cfg),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: GEMINI_CONFIG_QUERY_KEY });
            qc.invalidateQueries({ queryKey: GEMINI_KEYS_QUERY_KEY });
        },
    });
}
