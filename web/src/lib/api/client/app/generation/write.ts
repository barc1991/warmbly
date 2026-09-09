import type { WriteRequest, WriteResponse } from "@/lib/api/models/app/generation/Write";
import Request from "../../Request";
import i18n from "@/i18n";

// POST /generation/write — drafts email copy from a prompt. Returns a 402 when
// the org is out of generation credits; that surfaces as an AppError with
// status 402 (handled at the call site with a friendly toast).
export default async function write(body: WriteRequest): Promise<WriteResponse> {
    const data: WriteRequest = {
        ...body,
        language: body.language ?? (i18n.language === "he" ? "he" : "en"),
    };
    return await Request<WriteResponse>({
        method: "POST",
        url: "/generation/write",
        data,
        authorization: true,
    });
}
