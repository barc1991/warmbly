import { beforeEach, describe, expect, it, vi } from "vitest";
import Client from "./Client";
import Request from "./Request";
import getToken from "@/lib/helper/getToken";

vi.mock("./Client", () => ({
    default: {
        request: vi.fn(),
    },
}));

vi.mock("@/lib/helper/getToken", () => ({
    default: vi.fn(),
}));

describe("Request", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getToken).mockReturnValue({
            access_token: "access-token",
            access_token_expires_at: new Date(Date.now() + 60_000),
            refresh_token: "refresh-token",
            refresh_token_expires_at: new Date(Date.now() + 120_000),
        });
    });

    it("preserves blob responses for browser downloads", async () => {
        const blob = new Blob(["email\nlead@example.com\n"], { type: "text/csv" });
        vi.mocked(Client.request).mockResolvedValue({ data: blob });

        const result = await Request<Blob>({
            method: "POST",
            url: "/contacts/export",
            authorization: true,
            responseType: "blob",
        });

        expect(result).toBe(blob);
        expect(result).toBeInstanceOf(Blob);
    });

    it("continues reviving timestamps in JSON responses", async () => {
        vi.mocked(Client.request).mockResolvedValue({
            data: {
                created_at: "2026-09-17T12:34:56.000Z",
                nested: [{ updated_at: "2026-09-18T01:02:03.000Z" }],
                label: "2026-09-17",
            },
        });

        const result = await Request<{
            created_at: Date;
            nested: Array<{ updated_at: Date }>;
            label: string;
        }>({
            method: "GET",
            url: "/contacts/example",
            authorization: true,
        });

        expect(result.created_at).toEqual(new Date("2026-09-17T12:34:56.000Z"));
        expect(result.nested[0]?.updated_at).toEqual(new Date("2026-09-18T01:02:03.000Z"));
        expect(result.label).toBe("2026-09-17");
    });
});
