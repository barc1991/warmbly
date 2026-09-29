import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WarmupPartnerDiversity from "./WarmupPartnerDiversity";

describe("WarmupPartnerDiversity", () => {
    it("shows confirmed partner reach and the single-workspace warning", () => {
        render(
            <WarmupPartnerDiversity
                health={{
                    partner_mailboxes_7d: 6,
                    partner_domains_7d: 4,
                    partner_organizations_7d: 1,
                }}
            />,
        );

        expect(screen.getByText("6")).toBeTruthy();
        expect(screen.getByText("4")).toBeTruthy();
        expect(screen.getByText(/כל השותפים השבוע|Every partner this week was in a single workspace/i, { exact: false })).toBeTruthy();
        expect(screen.queryByText(/התקבלו|Received/i, { exact: false })).toBeNull();
    });

    it("shows the receiving side and flags a mailbox nobody writes back to", () => {
        render(
            <WarmupPartnerDiversity
                health={{
                    partner_mailboxes_7d: 19,
                    partner_domains_7d: 10,
                    partner_organizations_7d: 9,
                    received_7d: 1,
                    senders_7d: 1,
                }}
            />,
        );

        expect(screen.getByText(/התקבלו|Received/i, { exact: false })).toBeTruthy();
        expect(screen.getByText(/שולחת להרבה יותר שותפים|writing to far more partners than are writing back/i, { exact: false })).toBeTruthy();
    });

    it("stays quiet when the exchange is balanced", () => {
        render(
            <WarmupPartnerDiversity
                health={{
                    partner_mailboxes_7d: 12,
                    partner_domains_7d: 8,
                    partner_organizations_7d: 6,
                    received_7d: 10,
                    senders_7d: 7,
                }}
            />,
        );

        expect(screen.queryByText(/שולחת להרבה יותר שותפים|writing to far more partners/i, { exact: false })).toBeNull();
    });

    it("renders nothing when an older cloud response has no diversity fields", () => {
        const { container } = render(<WarmupPartnerDiversity health={{}} />);
        expect(container.firstChild).toBeNull();
    });
});
