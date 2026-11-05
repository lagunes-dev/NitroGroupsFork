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

/** The notice props the agenda always passes; a case overrides the ones it cares about. */
const quiet = { notifying: null, notifyFailed: false, onNotify: vi.fn() } as const;

describe("GigCard", () => {
    it("shows the date, the place and the schedule of the gig", () => {
        render(<GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} {...quiet} />);
        expect(screen.getByText(/19 de noviembre/i)).toBeInTheDocument();
        expect(screen.getByText(/Hacienda San Gabriel/)).toBeInTheDocument();
        expect(screen.getByText(/20:00/)).toBeInTheDocument();
    });

    it("names both answers with the group so two rows never sound alike", () => {
        render(<GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} {...quiet} />);
        expect(screen.getByRole("button", { name: /Confirmar el .*Versátil Rock y Pop/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Avisar que no puedo el .*Versátil Rock y Pop/ })).toBeInTheDocument();
    });

    it("reports the answer the musician picked", async () => {
        const onAnswer = vi.fn();
        render(<GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={onAnswer} onRetry={vi.fn()} {...quiet} />);
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
                {...quiet}
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
                {...quiet}
            />
        );
        expect(screen.getByText(/Llegada 17:30/)).toBeInTheDocument();
        expect(screen.getByText("Tu pago: $2,000")).toBeInTheDocument();
        const disclosure = screen.getByText("Ver setlist").closest("details");
        expect(disclosure).not.toBeNull();
        expect(disclosure).not.toHaveAttribute("open");
        expect(disclosure).toHaveTextContent(/Intro\s*Valses/);
    });

    it("says which logistics the manager has not loaded yet, instead of hiding them", () => {
        render(<GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} {...quiet} />);
        expect(screen.getByText(/Llegada sin definir/)).toBeInTheDocument();
        expect(screen.getByText("Setlist sin cargar")).toBeInTheDocument();
        expect(screen.getByText("Tu pago sin definir")).toBeInTheDocument();
    });

    it("keeps asking only for the slot that is missing", () => {
        render(
            <GigCard
                gig={toGigView({ ...row, callTime: "17:30:00" })}
                saving={false}
                failed={false}
                onAnswer={vi.fn()}
                onRetry={vi.fn()}
                {...quiet}
            />
        );
        expect(screen.getByText(/Llegada 17:30/)).toBeInTheDocument();
        expect(screen.queryByText(/Llegada sin definir/)).toBeNull();
        expect(screen.getByText("Setlist sin cargar")).toBeInTheDocument();
        expect(screen.getByText("Tu pago sin definir")).toBeInTheDocument();
    });
});

describe("GigCard notices", () => {
    it("offers one quiet tap next to each slot that is missing", async () => {
        const onNotify = vi.fn();
        render(
            <GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} notifying={null} notifyFailed={false} onNotify={onNotify} />
        );

        const actions = screen.getAllByRole("button", { name: /^Avisar que falta/ });
        expect(actions.map((action) => action.textContent)).toEqual(["Avisar que falta", "Avisar que falta", "Avisar que falta"]);
        expect(actions.map((action) => action.getAttribute("aria-label"))).toEqual([
            "Avisar que falta la llegada",
            "Avisar que falta el pago",
            "Avisar que falta el setlist",
        ]);

        await userEvent.click(screen.getByRole("button", { name: "Avisar que falta el setlist" }));
        expect(onNotify).toHaveBeenCalledWith("Setlist");
    });

    it("does not offer a slot the manager already loaded", () => {
        render(
            <GigCard
                gig={toGigView({ ...row, callTime: "17:30:00", myPay: 0 })}
                saving={false}
                failed={false}
                onAnswer={vi.fn()}
                onRetry={vi.fn()}
                notifying={null}
                notifyFailed={false}
                onNotify={vi.fn()}
            />
        );

        expect(screen.queryByRole("button", { name: "Avisar que falta la llegada" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Avisar que falta el pago" })).toBeNull();
        expect(screen.getByRole("button", { name: "Avisar que falta el setlist" })).toBeInTheDocument();
    });

    it("says it was sent today instead of offering it again", () => {
        render(
            <GigCard
                gig={toGigView(row, ["Pay"])}
                saving={false}
                failed={false}
                onAnswer={vi.fn()}
                onRetry={vi.fn()}
                notifying={null}
                notifyFailed={false}
                onNotify={vi.fn()}
            />
        );

        expect(screen.getByText("Avisaste hoy que falta el pago")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Avisar que falta el pago" })).toBeNull();
        expect(screen.getByRole("button", { name: "Avisar que falta la llegada" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Avisar que falta el setlist" })).toBeInTheDocument();
    });

    it("keeps the other slots working while one notice is on its way", () => {
        render(
            <GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} notifying="Pay" notifyFailed={false} onNotify={vi.fn()} />
        );

        expect(screen.getByRole("button", { name: "Avisar que falta el pago" })).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("button", { name: "Avisar que falta el setlist" })).toHaveAttribute("aria-busy", "false");
    });

    it("tells the musician a notice did not land, and still offers that slot", () => {
        render(
            <GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} notifying={null} notifyFailed onNotify={vi.fn()} />
        );

        expect(screen.getByRole("alert")).toHaveTextContent("No pudimos enviar el aviso. Intenta de nuevo.");
        expect(screen.getByRole("button", { name: "Avisar que falta el pago" })).toBeInTheDocument();
    });
});
