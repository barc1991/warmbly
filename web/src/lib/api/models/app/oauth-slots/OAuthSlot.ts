export interface OAuthConnectionSlot {
    id: string;
    org_id: string;
    provider: "gmail" | "outlook";
    name: string;
    client_id: string;
    max_accounts: number;
    is_default: boolean;
    connected_count: number;
    created_at: string;
    updated_at: string;
}

export interface NewOAuthConnectionSlot {
    provider: "gmail" | "outlook";
    name: string;
    client_id: string;
    client_secret: string;
    max_accounts?: number;
    is_default?: boolean;
}

export interface UpdateOAuthConnectionSlot {
    name?: string;
    client_secret?: string;
    max_accounts?: number;
    is_default?: boolean;
}

export type OAuthSlot = OAuthConnectionSlot;
