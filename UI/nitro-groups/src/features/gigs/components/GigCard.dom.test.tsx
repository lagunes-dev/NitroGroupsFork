// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GigCard } from "./GigCard";
import { toGigView } from "../viewModel";

const row = {
    id: 7,
    groupId: 1,
    groupName: "Versátil Rock y Pop",
    groupSlug: "versatil-rock-y-pop",
    eventDate: "2026-11-19",
    startTime: "20:00:00",
    durationHours: 3,
    eventType: "Boda",
    locationText: "Hacienda San Gabriel, Tlaquepaque",
    role: "Member",
    attendance: null,
};

describe("GigCard", () => {
    it("shows the date, the place and the schedule of the gig", () => {
        render(<GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} />);
        expect(screen.getByText(/19 de noviembre/i)).toBeInTheDocument();
        expect(screen.getByText(/Hacienda San Gabriel/)).toBeInTheDocument();
        expect(screen.getByText(/20:00/)).toBeInTheDocument();
    });

    it("names both answers with the group so two rows never sound alike", () => {
        render(<GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} />);
        expect(screen.getByRole("button", { name: /Confirmar el .*Versátil Rock y Pop/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Avisar que no puedo el .*Versátil Rock y Pop/ })).toBeInTheDocument();
    });

    it("reports the answer the musician picked", async () => {
        const onAnswer = vi.fn();
        render(<GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={onAnswer} onRetry={vi.fn()} />);
        await userEvent.click(screen.getByRole("button", { name: /Confirmar el/ }));
        expect(onAnswer).toHaveBeenCalledWith("Confirmed");
    });

    it("shows the saved answer instead of asking again", () => {
        render(
            <GigCard
                gig={toGigView({ ...row, attendance: "Confirmed" })}
                saving={false}
                failed={false}
                onAnswer={vi.fn()}
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByText("Confirmado")).toBeInTheDocument();
    });

    it("shows the call time, the pay and a collapsed setlist when the row has them", () => {
        render(
            <GigCard
                gig={toGigView({ ...row, callTime: "17:30:00", myPay: 2000, setlist: "Intro\nValses" })}
                saving={false}
                failed={false}
                onAnswer={vi.fn()}
                onRetry={vi.fn()}
            />
        );
        expect(screen.getByText(/Llegada 17:30/)).toBeInTheDocument();
        expect(screen.getByText("Tu pago: $2,000")).toBeInTheDocument();
        const disclosure = screen.getByText("Ver setlist").closest("details");
        expect(disclosure).not.toBeNull();
        expect(disclosure).not.toHaveAttribute("open");
        expect(disclosure).toHaveTextContent(/Intro\s*Valses/);
    });

    it("shows none of them for a gig without logistics", () => {
        render(<GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} />);
        expect(screen.queryByText(/Llegada/)).toBeNull();
        expect(screen.queryByText(/Tu pago/)).toBeNull();
        expect(screen.queryByText("Ver setlist")).toBeNull();
    });
});
