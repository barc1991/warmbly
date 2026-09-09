// Grounded AI draft for the compose window. The backend folds in the
// recipient's contact record, the correspondence history with that address,
// and the org voice profile; when it can't tell what the email is for it
// returns a clarifying `question` instead of inventing a draft.

import Request from "../../Request";
import i18n from "@/i18n";
import type { AIDraftGrounding } from "@/components/app/ai/AIDraftBar";

export interface ComposeDraftInput {
    to?: string;
    subject?: string;
    instruction?: string;
    language?: string;
    // Per-attempt key so a network retry of the SAME draft never double-charges
    // credits (the backend keys the consume on it).
    idempotency_key?: string;
}

export interface ComposeDraftResult {
    // Exactly one of text / question is present.
    text?: string;
    question?: string;
    grounding: AIDraftGrounding;
    credits_remaining: number;
    credits_charged: number;
    tokens_used: number;
    model: string;
}

export default async function composeDraft(
    data: ComposeDraftInput,
): Promise<ComposeDraftResult> {
    const { idempotency_key, ...body } = data;
    const payload = {
        ...body,
        language: body.language ?? (i18n.language === "he" ? "he" : "en"),
    };
    return await Request<ComposeDraftResult>({
        method: "POST",
        url: "/unibox/compose/draft",
        data: payload,
        authorization: true,
        headers: idempotency_key ? { "Idempotency-Key": idempotency_key } : undefined,
    });
}
