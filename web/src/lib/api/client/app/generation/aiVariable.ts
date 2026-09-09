import type {
    AIVariableGenerateRequest,
    AIVariableGenerateResponse,
} from "@/lib/api/models/app/generation/AIVariable";
import Request from "../../Request";
import i18n from "@/i18n";

// POST /generation/ai-variable — preview one AI-variable snippet for a sample or
// chosen contact. Returns a 402 when the org is out of generation credits.
export default async function generateAIVariable(
    body: AIVariableGenerateRequest,
): Promise<AIVariableGenerateResponse> {
    const data: AIVariableGenerateRequest = {
        ...body,
        language: body.language ?? (i18n.language === "he" ? "he" : "en"),
    };
    return await Request<AIVariableGenerateResponse>({
        method: "POST",
        url: "/generation/ai-variable",
        data,
        authorization: true,
    });
}
