import Request from "../../Request";

export type SerperKeyStatus =
    | "active"
    | "paused"
    | "disabled"
    | "cooldown"
    | "exhausted";

export interface OrgSerperKey {
    id: string;
    org_id: string;
    name: string;
    masked_key: string;
    status: SerperKeyStatus;
    fail_count: number;
    request_count: number;
    remaining_credits: number;
    last_used?: string;
    last_error?: string;
    cooldown_until?: string;
    created_at: string;
    updated_at: string;
}

export interface SerperRotationStats {
    total_keys: number;
    active_keys: number;
    cooldown_keys: number;
    exhausted_keys: number;
    total_requests: number;
    remaining_credits: number;
}

export interface BDRSettings {
    inbox_auto_send_enabled: boolean;
    inbox_auto_send_min_confidence: number;
    first_reply_website_crawl: boolean;
    signature_extraction_enabled: boolean;
}

export interface TestSerperKeyResult {
    success: boolean;
    credits?: number;
    latency_ms?: number;
    error?: string;
}

export async function getSerperKeys(): Promise<OrgSerperKey[]> {
    return await Request<OrgSerperKey[]>({
        method: "GET",
        url: `/ai/serper-keys`,
        authorization: true,
    });
}

export async function createSerperKeys(data: {
    name?: string;
    key?: string;
    keys?: { name: string; key: string }[];
    keys_text?: string;
}): Promise<OrgSerperKey[]> {
    return await Request<OrgSerperKey[]>({
        method: "POST",
        url: `/ai/serper-keys`,
        data,
        authorization: true,
    });
}

export async function deleteSerperKey(id: string): Promise<void> {
    await Request<{ message: string }>({
        method: "DELETE",
        url: `/ai/serper-keys/${id}`,
        authorization: true,
    });
}

export async function updateSerperKeyStatus(
    id: string,
    status: SerperKeyStatus,
): Promise<void> {
    await Request<{ message: string }>({
        method: "PATCH",
        url: `/ai/serper-keys/${id}/status`,
        data: { status },
        authorization: true,
    });
}

export async function testSerperKey(id: string): Promise<TestSerperKeyResult> {
    return await Request<TestSerperKeyResult>({
        method: "POST",
        url: `/ai/serper-keys/${id}/test`,
        authorization: true,
    });
}

export async function getSerperStats(): Promise<SerperRotationStats> {
    return await Request<SerperRotationStats>({
        method: "GET",
        url: `/ai/serper-stats`,
        authorization: true,
    });
}

export async function getBDRSettings(): Promise<BDRSettings> {
    return await Request<BDRSettings>({
        method: "GET",
        url: `/ai/bdr-settings`,
        authorization: true,
    });
}

export async function updateBDRSettings(
    settings: BDRSettings,
): Promise<BDRSettings> {
    return await Request<BDRSettings>({
        method: "PUT",
        url: `/ai/bdr-settings`,
        data: settings,
        authorization: true,
    });
}
