import { describe, expect, it } from "vitest";
import { verificationSourceLabel, verificationTitle } from "./VerificationBadge";

describe("verification provider attribution", () => {
    it.each(["CleanMyList", "MillionVerifier"])("names %s on provider verdicts", (name) => {
        expect(verificationTitle({
            verification_status: "valid",
            verification_source: "provider",
            verification_provider: name.toLowerCase(),
        })).toBe(`ניתן למסירה · אומת באמצעות ${name}`);
    });

    it("keeps the generic label for a verifier it has no name for", () => {
        expect(verificationTitle({
            verification_status: "valid",
            verification_source: "provider",
            verification_provider: "some-service",
        })).toBe("ניתן למסירה · אומת באמצעות שירות אימות חיצוני");
    });

    it("says when a re-check is waiting on the current verdict", () => {
        expect(verificationTitle({
            verification_status: "invalid",
            verification_source: "provider",
            verification_provider: "millionverifier",
            verification_requested_at: "2026-09-22T10:00:00Z",
        })).toBe("לא ניתן למסירה · אומת באמצעות MillionVerifier · בדיקה מחדש בתור");
    });

    it("names the built-in check and an imported vocabulary", () => {
        expect(verificationSourceLabel("probe", "builtin")).toBe("נבדק באמצעות הבדיקה המובנית של Warmbly");
        expect(verificationSourceLabel("imported", "zerobounce", "ZeroBounce")).toBe("יובא מ-ZeroBounce");
        expect(verificationSourceLabel("", "")).toBe("");
    });
});
