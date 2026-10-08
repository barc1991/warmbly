import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useSearchParam, useSearchParams } from "./useSearchParams";

function Filters() {
    const [tag, setTag] = useSearchParam("tag");
    const [, setParams] = useSearchParams();
    return <>
        <output aria-label="Tag filter">{tag || "All accounts"}</output>
        <button onClick={() => setTag("sending-tag")}>Sending Account</button>
        <button onClick={() => setTag("")}>All accounts</button>
        <button onClick={() => setParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("mailbox");
            next.delete("tab");
            return next;
        }, { replace: true })}>Consume mailbox link</button>
    </>;
}

function open(href: string) {
    const router = createMemoryRouter([
        { path: "/app/emails", element: <Filters /> },
    ], { initialEntries: [href] });
    return { router, ...render(<RouterProvider router={router} />) };
}

describe("URL filter selection", () => {
    it("keeps a selection through a reload without discarding mailbox links", async () => {
        const page = open("/app/emails?mailbox=mailbox-id&tab=settings");
        expect(screen.getByLabelText("Tag filter")).toHaveTextContent("All accounts");
        fireEvent.click(screen.getByRole("button", { name: "Sending Account" }));
        await waitFor(() => expect(page.router.state.location.search).toContain("tag=sending-tag"));
        const search = page.router.state.location.search;
        expect(search).toContain("mailbox=mailbox-id");
        expect(search).toContain("tab=settings");
        page.unmount();

        const reloaded = open(`/app/emails${search}`);
        expect(screen.getByLabelText("Tag filter")).toHaveTextContent("sending-tag");
        fireEvent.click(screen.getByRole("button", { name: "Consume mailbox link" }));
        await waitFor(() => expect(reloaded.router.state.location.search).toBe("?tag=sending-tag"));
        expect(screen.getByLabelText("Tag filter")).toHaveTextContent("sending-tag");
    });

    it("clears only the chosen filter and preserves unrelated search parameters", async () => {
        const page = open("/app/emails?tag=sending-tag&mailbox=mailbox-id");
        fireEvent.click(screen.getByRole("button", { name: "All accounts" }));
        await waitFor(() => expect(page.router.state.location.search).toBe("?mailbox=mailbox-id"));
        expect(screen.getByLabelText("Tag filter")).toHaveTextContent("All accounts");
        const search = page.router.state.location.search;
        page.unmount();
        open(`/app/emails${search}`);
        expect(screen.getByLabelText("Tag filter")).toHaveTextContent("All accounts");
    });
});
