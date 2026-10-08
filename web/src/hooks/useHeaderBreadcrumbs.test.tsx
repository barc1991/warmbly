import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHeaderBreadcrumbs } from "./useHeaderBreadcrumbs";

function Breadcrumbs() {
    const crumbs = useHeaderBreadcrumbs();
    return <nav aria-label="Breadcrumb">
        {crumbs.map(({ label, to, current }) => current
            ? <span key={to} aria-current="page">{label}</span>
            : <Link key={to} to={to}>{label}</Link>)}
    </nav>;
}

function open(path: string, href: string) {
    const router = createMemoryRouter([
        { path, element: <Breadcrumbs /> },
    ], { initialEntries: [href] });
    render(<RouterProvider router={router} />);
    return router;
}

beforeEach(() => vi.spyOn(window, "scrollTo").mockImplementation(() => {}));
afterEach(() => {
    vi.restoreAllMocks();
});

describe("header breadcrumbs", () => {
    it.each([
        "/app/unibox",
        "/app/unibox/all",
        "/app/unibox/account-123/AAQkAGFiNzBmMDQ2LWM1ZmUtNGYyNC05NTk5LTg0NjFmZGFhMTc5ZgAQAA_m_very_long_provider_message_id",
        "/app/unibox/label%3Aimportant/thread-123",
        "/app/unibox/app/ordinary-id",
    ])("shows only Inbox for %s, never scope or thread parameters", (href) => {
        open("/app/unibox/*", href);
        expect(screen.getByRole("navigation")).toHaveTextContent(/^תיבת דואר מאוחדת$/);
        if (href === "/app/unibox") {
            expect(screen.getByText("תיבת דואר מאוחדת")).toHaveAttribute("aria-current", "page");
        } else {
            expect(screen.getByRole("link", { name: "תיבת דואר מאוחדת" })).toHaveAttribute("href", "/app/unibox");
        }
    });

    it.each(["campaign-slug", "00000000-0000-0000-0000-000000000001", "app", "a%2Fb"])("preserves %s in nested link targets without displaying it", (id) => {
        open("/app/campaigns/:id/leads/details", `/app/campaigns/${id}/leads/details`);
        expect(screen.getByRole("link", { name: "קמפיינים" })).toHaveAttribute("href", "/app/campaigns");
        expect(screen.getByRole("link", { name: "לידים" })).toHaveAttribute("href", `/app/campaigns/${id}/leads`);
        expect(screen.getByText("Details")).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("navigation")).toHaveTextContent(/^קמפייניםלידיםDetails$/);
    });

    it("routes the batches ancestor to the existing tab", () => {
        open("/app/placement/batches/:id", "/app/placement/batches/batch-id");
        expect(screen.getByRole("link", { name: "בדיקות מיקום" })).toHaveAttribute("href", "/app/placement");
        expect(screen.getByRole("link", { name: "אצוות" })).toHaveAttribute("href", "/app/placement?tab=batches");
        expect(screen.getByRole("navigation")).toHaveTextContent(/^בדיקות מיקוםאצוות$/);
    });
});
