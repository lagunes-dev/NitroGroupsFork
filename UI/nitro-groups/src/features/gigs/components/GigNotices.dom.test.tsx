// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoticeLines } from "./GigNotices";

describe("NoticeLines", () => {
    it("says who is missing what, so the manager does not have to guess", () => {
        render(
            <NoticeLines
                notices={[
                    { id: 2, gigId: 5, fullName: "Sofía Nava", kind: "Setlist" },
                    { id: 1, gigId: 5, fullName: "Mateo Ruiz", kind: "Pay" },
                ]}
            />
        );
        const lines = screen.getAllByRole("listitem");
        expect(lines.map((line) => line.textContent)).toEqual([
            "Sofía Nava avisa que falta el setlist",
            "Mateo Ruiz avisa que falta el pago",
        ]);
    });

    it("names the musician even when the API did not send one", () => {
        render(<NoticeLines notices={[{ id: 1, gigId: 5, fullName: "  ", kind: "CallTime" }]} />);
        expect(screen.getByText("Un músico del grupo avisa que falta la llegada")).toBeInTheDocument();
    });

    it("draws nothing when the gig received no notices", () => {
        const { container } = render(<NoticeLines notices={[]} />);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole("list")).toBeNull();
    });

    it("ignores a kind the contract does not know instead of printing nonsense", () => {
        const { container } = render(
            <NoticeLines
                notices={[
                    { id: 1, gigId: 5, fullName: "Mateo", kind: "Chat" },
                    { id: 2, gigId: 5, fullName: "Mateo", kind: "Pay" },
                ]}
            />
        );
        expect(container).toHaveTextContent("Mateo avisa que falta el pago");
        expect(container).not.toHaveTextContent("Chat");
    });
});
