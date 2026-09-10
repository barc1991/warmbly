import Request from "../../Request";

export type GeminiKeyStatus = "active" | "paused" | "disabled" | "cooldown";

export interface OrgGeminiKey {
    id: string;
    org_id: string;
    name: string;
    masked_key: string;
    status: GeminiKeyStatus;
    fail_count: number;
    request_count: number;
    last_used?: string;
    last_error?: string;
    cooldown_until?: string;
    created_at: string;
    updated_at: string;
}

export interface GeminiOrgConfig {
    primary_model: string;
    fallback_enabled: boolean;
    fallback_chain: string[];
}

export interface GeminiRotationStats {
    total_keys: number;
    active_keys: number;
    cooldown_keys: number;
    disabled_keys: number;
    total_requests: number;
    total_rotations: number;
    current_model: string;
    fallback_chain: string[];
}

export interface GeminiConfigResponse {
    config: GeminiOrgConfig;
    stats: GeminiRotationStats;
}

export interface TestKeyResult {
    success: boolean;
    model?: string;
    latency_ms?: number;
    error?: string;
    error_type?: string;
}

export async function getGeminiKeys(): Promise<OrgGeminiKey[]> {
    return await Request<OrgGeminiKey[]>({
        method: "GET",
        url: `/ai/gemini-keys`,
        authorization: true,
    });
}

export async function createGeminiKeys(data: {
    name?: string;
    key?: string;
    keys?: { name: string; key: string }[];
    keys_text?: string;
}): Promise<OrgGeminiKey[]> {
    return await Request<OrgGeminiKey[]>({
        method: "POST",
        url: `/ai/gemini-keys`,
        data,
        authorization: true,
    });
}

export async function deleteGeminiKey(id: string): Promise<void> {
    await Request<{ message: string }>({
        method: "DELETE",
        url: `/ai/gemini-keys/${id}`,
        authorization: true,
    });
}

export async function updateGeminiKeyStatus(
    id: string,
    status: GeminiKeyStatus,
): Promise<void> {
    await Request<{ message: string }>({
        method: "PATCH",
        url: `/ai/gemini-keys/${id}/status`,
        data: { status },
        authorization: true,
    });
}

export async function testGeminiKey(id: string): Promise<TestKeyResult> {
    return await Request<TestKeyResult>({
        method: "POST",
        url: `/ai/gemini-keys/${id}/test`,
        authorization: true,
    });
}

export async function getGeminiConfig(): Promise<GeminiConfigResponse> {
    return await Request<GeminiConfigResponse>({
        method: "GET",
        url: `/ai/gemini-config`,
        authorization: true,
    });
}

export async function updateGeminiConfig(
    cfg: GeminiOrgConfig,
): Promise<void> {
    await Request<{ message: string }>({
        method: "PUT",
        url: `/ai/gemini-config`,
        data: cfg,
        authorization: true,
    });
}
