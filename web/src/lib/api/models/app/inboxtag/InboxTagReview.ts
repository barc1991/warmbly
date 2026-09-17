// GET /analytics/inbox-tagging — the phase-1 review surface.
//
// Automatic tagging writes labels and a relevance score and nothing else. The
// whole point of the phase is that a person can see what it decided, and how
// sure it was, before it is allowed to act on anything.

export interface InboxTagRow {
    id: string;
    message_id: string;
    thread_id: string;
    /** What the message is. One of the eight kinds in the taxonomy. */
    kind: string;
    kind_confidence: number;
    /** "header" when a deterministic rule decided, "model" when Jev did. */
    kind_source: string;
    /** Only set for a human reply; meaningless on a bounce. */
    intent: string;
    intent_confidence: number;
    relevance: number;
    priority: string;
    /** True when a choice came back below the confidence floor. */
    needs_review: boolean;
    labels: string[];
    /** Every raw probability, exactly as the API returned it. */
    answers: Record<string, unknown>;
    model: string;
    input_tokens: number;
    created_at: string;
}

export default interface InboxTagReview {
    /** False when the instance has no key or the switch is off. */
    enabled: boolean;
    data: InboxTagRow[];
    total: number;
}
