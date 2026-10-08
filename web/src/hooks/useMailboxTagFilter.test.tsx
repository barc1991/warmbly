import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { createContext, useContext } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import useMailboxTagFilter from "./useMailboxTagFilter";
import { resumeBrowseState } from "@/lib/browseState";
import { clearClientSession } from "@/lib/session";

let workspace = "workspace";
let tags: readonly { id: string }[] | undefined;
const FilterConfig = createContext({ workspace, tags });

function TestRouter({ router }: { router: ReturnType<typeof createMemoryRouter> }) {
    return <FilterConfig.Provider value={{ workspace, tags }}><RouterProvider router={router} /></FilterConfig.Provider>;
}

function Filters() {
    const { workspace, tags } = useContext(FilterConfig);
    const [tag, setTag] = useMailboxTagFilter(`user:${workspace}`, tags);
    return <><output aria-label="Tag">{tag || "All accounts"}</output>
        <button onClick={() => setTag("sending")}>Sending</button>
        <button onClick={() => setTag("")}>All accounts</button></>;
}

function open(href = "/app/emails") {
    const router = createMemoryRouter([
        { path: "/app/emails", element: <Filters /> },
        { path: "/app/tasks", element: <div>Tasks</div> },
    ], { initialEntries: [href] });
    return { router, ...render(<TestRouter router={router} />) };
}

describe("remembered mailbox tag", () => {
    beforeEach(() => {
        resumeBrowseState();
        sessionStorage.clear();
        workspace = "workspace";
        tags = [{ id: "sending" }];
    });
    it("waits for profile tags and keeps other workspaces isolated", async () => {
        tags = undefined;
        sessionStorage.setItem("warmbly:mailbox-tag:user:workspace", "sending");
        const page = open();
        expect(screen.getByLabelText("Tag")).toHaveTextContent("sending");
        tags = [{ id: "sending" }];
        page.rerender(<TestRouter router={page.router} />);
        expect(screen.getByLabelText("Tag")).toHaveTextContent("sending");
        page.unmount();
        workspace = "another-workspace";
        open();
        expect(screen.getByLabelText("Tag")).toHaveTextContent("All accounts");
        expect(sessionStorage.getItem("warmbly:mailbox-tag:user:workspace")).toBe("sending");
    });
    it("survives navigating to Tasks and returning through a queryless Accounts link", async () => {
        const page = open();
        fireEvent.click(screen.getByRole("button", { name: "Sending" }));
        await waitFor(() => expect(page.router.state.location.search).toBe("?tag=sending"));
        await page.router.navigate("/app/tasks");
        await waitFor(() => expect(page.router.state.location.pathname).toBe("/app/tasks"));
        await page.router.navigate("/app/emails");
        await waitFor(() => expect(page.router.state.location.search).toBe("?tag=sending"));
        expect(screen.getByLabelText("Tag")).toHaveTextContent("sending");
    });
    it("adopts an explicit link and ignores stale storage for that click", async () => {
        sessionStorage.setItem("warmbly:mailbox-tag:user:workspace", "sending");
        const page = open("/app/emails?tag=custom");
        tags = [{ id: "sending" }, { id: "custom" }];
        page.rerender(<TestRouter router={page.router} />);
        expect(screen.getByLabelText("Tag")).toHaveTextContent("custom");
        expect(sessionStorage.getItem("warmbly:mailbox-tag:user:workspace")).toBe("custom");
    });
    it("discards saved state on logout", async () => {
        sessionStorage.setItem("warmbly:mailbox-tag:user:workspace", "sending");
        clearClientSession();
        open();
        expect(screen.getByLabelText("Tag")).toHaveTextContent("All accounts");
    });
});
