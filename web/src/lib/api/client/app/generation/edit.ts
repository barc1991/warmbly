import type { EditRequest, EditResponse } from "@/lib/api/models/app/generation/Write";
import Request from "../../Request";
import i18n from "@/i18n";

// POST /generation/edit — rewrites a selected passage per an instruction.
// Returns a 402 when the org is out of generation credits (AppError status 402
// at the call site).
export default async function edit(body: EditRequest): Promise<EditResponse> {
    const data: EditRequest = {
        ...body,
        language: body.language ?? (i18n.language === "he" ? "he" : "en"),
    };
    return await Request<EditResponse>({
        method: "POST",
        url: "/generation/edit",
        data,
        authorization: true,
    });
}
