export type SegmentMatch = "all" | "any";

export type SegmentMemberMode = "include" | "exclude" | "auto";

export type SegmentFieldKind =
    | "text"
    | "enum"
    | "bool"
    | "date"
    | "number"
    | "category"
    | "campaign"
    | "segment";

export interface SegmentCondition {
    field: string;
    operator: string;
    value?: string;
    values?: string[];
}

export interface SegmentFieldSpec {
    field: string;
    label: string;
    group: string;
    kind: SegmentFieldKind;
    options?: string[];
}

export default interface Segment {
    id: string;
    organization_id: string;
    created_by?: string;
    name: string;
    description: string;
    color: string;
    match: SegmentMatch;
    conditions: SegmentCondition[];
    contact_count: number;
    included_count: number;
    excluded_count: number;
    created_at: Date;
    updated_at: Date;
}

export interface SegmentWrite {
    name?: string;
    description?: string;
    color?: string;
    match?: SegmentMatch;
    conditions?: SegmentCondition[];
}

export interface SegmentPreview {
    id?: string;
    match: SegmentMatch;
    conditions: SegmentCondition[];
}

// One segment as seen from a contact: member or not, plus any manual override.
export interface ContactSegment {
    id: string;
    name: string;
    color: string;
    mode?: "include" | "exclude";
    member: boolean;
}

// A contact pinned into or out of a segment.
export interface SegmentOverride {
    contact_id: string;
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    mode: "include" | "exclude";
    created_at: Date;
}

export interface SegmentAddToCampaignResult {
    campaign_id: string;
    added: number;
    members: number;
}

// One segment linked to a campaign as a live audience source. The counts are
// live: members now, members that are leads of this campaign, and members
// held out because a lead was removed from the campaign by hand.
export interface CampaignSegmentLink {
    segment_id: string;
    name: string;
    color: string;
    description: string;
    contact_count: number;
    lead_count: number;
    held_out_count: number;
    linked_at: string;
}

// Operators per field kind, mirrored from the backend catalog.
export const SEGMENT_OPERATORS: Record<SegmentFieldKind, { id: string; label: string }[]> = {
    text: [
        { id: "equals", label: "שווה ל-" },
        { id: "not_equals", label: "אינו שווה ל-" },
        { id: "contains", label: "מכיל" },
        { id: "not_contains", label: "אינו מכיל" },
        { id: "starts_with", label: "מתחיל ב-" },
        { id: "ends_with", label: "מסתיים ב-" },
        { id: "is_empty", label: "ריק" },
        { id: "is_not_empty", label: "אינו ריק" },
    ],
    enum: [
        { id: "in", label: "הוא אחד מ-" },
        { id: "not_in", label: "אינו אף אחד מ-" },
    ],
    bool: [
        { id: "is_true", label: "כן" },
        { id: "is_false", label: "לא" },
    ],
    date: [
        { id: "within_days", label: "במהלך האחרון" },
        { id: "not_within_days", label: "לא במהלך האחרון" },
        { id: "after", label: "אחרי" },
        { id: "before", label: "לפני" },
        { id: "is_empty", label: "אף פעם" },
        { id: "is_not_empty", label: "אי פעם" },
    ],
    number: [
        { id: "equals", label: "שווה ל-" },
        { id: "not_equals", label: "אינו שווה ל-" },
        { id: "gt", label: "גדול מ-" },
        { id: "gte", label: "לפחות" },
        { id: "lt", label: "קטן מ-" },
        { id: "lte", label: "לכל היותר" },
    ],
    category: [
        { id: "in", label: "כולל אחד מ-" },
        { id: "not_in", label: "אינו כולל אף אחד מ-" },
        { id: "is_empty", label: "ללא קטגוריה" },
        { id: "is_not_empty", label: "בעל קטגוריה כלשהי" },
    ],
    campaign: [
        { id: "in", label: "נמצא באחד מ-" },
        { id: "not_in", label: "אינו באף אחד מ-" },
        { id: "is_empty", label: "אינו באף קמפיין" },
        { id: "is_not_empty", label: "נמצא בקמפיין כלשהו" },
    ],
    segment: [
        { id: "in", label: "נמצא באחד מ-" },
        { id: "not_in", label: "אינו באף אחד מ-" },
    ],
};

// Operators that take no value at all.
export const VALUELESS_OPERATORS = new Set(["is_empty", "is_not_empty", "is_true", "is_false"]);
