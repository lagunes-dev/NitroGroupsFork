// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

    it("tells the musician whether he was paid, next to his pay (T48)", () => {
        const { unmount } = render(
            <GigCard
                gig={toGigView({ ...row, myPay: 2000, myPayPaidAt: "2026-12-13T15:00:00Z" })}
                saving={false}
                failed={false}
                onAnswer={vi.fn()}
                onRetry={vi.fn()}
                {...quiet}
            />
        );
        expect(screen.getByText("Tu pago: $2,000")).toBeInTheDocument();
        expect(screen.getByText(/pagado el 13 de diciembre de 2026/)).toBeInTheDocument();
        expect(screen.queryByText(/pendiente/)).toBeNull();
        unmount();

        render(<GigCard gig={toGigView({ ...row, myPay: 2000 })} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} {...quiet} />);
        expect(screen.getByText("Tu pago: $2,000")).toBeInTheDocument();
        expect(screen.getByText(/· pendiente/)).toBeInTheDocument();
        expect(screen.queryByText(/pagado/)).toBeNull();
    });

    it("keeps 'Tu pago sin definir' for a gig with no pay loaded, paid or not (T48)", () => {
        render(<GigCard gig={toGigView({ ...row, myPayPaidAt: "2026-12-13T15:00:00Z" })} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} {...quiet} />);
        expect(screen.getByText("Tu pago sin definir")).toBeInTheDocument();
        expect(screen.queryByText(/pagado|pendiente/)).toBeNull();
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
        // Cada hueco se nombra a sí mismo, a la vista y al lector de pantalla.
        expect(actions.map((action) => action.textContent)).toEqual([
            "Avisar que falta la llegada",
            "Avisar que falta el pago",
            "Avisar que falta el setlist",
        ]);
        expect(actions.map((action) => action.getAttribute("aria-label"))).toEqual([
            "Avisar que falta la llegada",
            "Avisar que falta el pago",
            "Avisar que falta el setlist",
        ]);

        await userEvent.click(screen.getByRole("button", { name: "Avisar que falta el setlist" }));
        expect(onNotify).toHaveBeenCalledWith("Setlist");
    });

    it("asks nothing about a gig the musician already declined", () => {
        render(
            <GigCard
                gig={toGigView({ ...row, attendance: "Declined" })}
                saving={false}
                failed={false}
                onAnswer={vi.fn()}
                onRetry={vi.fn()}
                notifying={null}
                notifyFailed={false}
                onNotify={vi.fn()}
            />
        );
        // No vas: la llegada o el pago no te faltan, así que no hay huecos que avisar (ronda 5, Mateo).
        expect(screen.queryByRole("button", { name: /^Avisar que falta/ })).toBeNull();
        expect(screen.queryByText(/sin definir/)).toBeNull();
        expect(screen.queryByText("Setlist sin cargar")).toBeNull();
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

    it("draws each notice as an action row, away from the text above", () => {
        render(
            <GigCard gig={toGigView(row)} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} notifying={null} notifyFailed={false} onNotify={vi.fn()} />
        );

        // Los avisos viven en un bloque propio, no dentro de la frase que dice qué falta.
        const block = screen.getByRole("list", { name: "Avisarle al grupo lo que falta" });
        const actions = within(block).getAllByRole("button");
        expect(actions).toHaveLength(5);
        for (const action of actions) {
            // 44 px de alto, su propio renglón a 390 px y una superficie con borde: se lee como acción.
            expect(action).toHaveClass("min-h-11", "w-full");
            expect(action.closest("li")).not.toBeNull();
            // Deja de ser un enlace subrayado con el gris de la frase.
            expect(action).not.toHaveClass("underline");
            expect(action.className).not.toContain("text-tinta-2");
        }
    });

    it("says a sent notice in the same 44 px row instead of a loose line", () => {
        render(
            <GigCard gig={toGigView(row, ["Pay"])} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} notifying={null} notifyFailed={false} onNotify={vi.fn()} />
        );

        const sent = screen.getByText("Avisaste hoy que falta el pago");
        expect(sent).toHaveClass("min-h-11");
        expect(sent.closest("li")).not.toBeNull();
    });
});

describe("GigCard day-of notices (S17)", () => {
    const props = { saving: false, failed: false, onAnswer: vi.fn(), onRetry: vi.fn(), ...quiet };
    const complete = { ...row, callTime: "17:30:00", myPay: 2000, setlist: "Intro" };

    it("offers late and cannot-find-venue on a future gig with everything loaded", async () => {
        const onNotify = vi.fn();
        render(<GigCard gig={toGigView(complete)} {...props} onNotify={onNotify} />);

        const late = screen.getByRole("button", { name: "Avisar que llego tarde" });
        const lost = screen.getByRole("button", { name: "Avisar que no encuentro el lugar" });
        expect(screen.queryByRole("button", { name: /^Avisar que falta/ })).toBeNull();
        for (const action of [late, lost]) expect(action).toHaveClass("min-h-11", "w-full");

        await userEvent.click(late);
        await userEvent.click(lost);
        expect(onNotify.mock.calls).toEqual([["Late"], ["CannotFindVenue"]]);
    });

    it("keeps the heading honest: no 'lo que falta' when only the two day-of notices are there", () => {
        render(<GigCard gig={toGigView(complete)} {...props} />);

        expect(screen.getByText("Avisarle al grupo")).toBeInTheDocument();
        expect(screen.getByRole("list", { name: "Avisarle al grupo" })).toBeInTheDocument();
        expect(screen.queryByText(/lo que falta/)).toBeNull();
    });

    it("keeps the old heading when a missing-slot notice is present", () => {
        render(<GigCard gig={toGigView({ ...complete, setlist: null })} {...props} />);

        expect(screen.getByRole("list", { name: "Avisarle al grupo lo que falta" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Avisar que llego tarde" })).toBeInTheDocument();
    });

    it("says it was sent today and offers nothing again for that kind", () => {
        render(<GigCard gig={toGigView(complete, ["Late"])} {...props} />);

        const sent = screen.getByText("Avisaste hoy que llegas tarde");
        expect(sent).toHaveClass("min-h-11");
        expect(screen.queryByRole("button", { name: "Avisar que llego tarde" })).toBeNull();
        expect(screen.getByRole("button", { name: "Avisar que no encuentro el lugar" })).toBeInTheDocument();
    });

    it("never shows them on a declined gig", () => {
        render(<GigCard gig={toGigView({ ...complete, attendance: "Declined" })} {...props} />);

        expect(screen.queryByRole("button", { name: "Avisar que llego tarde" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Avisar que no encuentro el lugar" })).toBeNull();
        expect(screen.queryByText("Avisarle al grupo")).toBeNull();
    });

    it("never shows them on a past gig", () => {
        render(<GigCard gig={toGigView(complete)} past {...props} />);

        expect(screen.queryByRole("button", { name: "Avisar que llego tarde" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Avisar que no encuentro el lugar" })).toBeNull();
        expect(screen.queryByText("Avisarle al grupo")).toBeNull();
    });
});

describe("GigCard of a gig that already happened", () => {
    it("stops asking for an answer and says the date is behind us", () => {
        render(
            <GigCard gig={toGigView(row)} past saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} notifying={null} notifyFailed={false} onNotify={vi.fn()} />
        );

        expect(screen.getByText("Este toque ya pasó")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Confirmar/ })).toBeNull();
        expect(screen.queryByRole("button", { name: /^Avisar que no puedo/ })).toBeNull();
        // Tampoco pide logística de algo que ya ocurrió.
        expect(screen.queryByRole("button", { name: /^Avisar que falta/ })).toBeNull();
        expect(screen.queryByText(/sin definir/)).toBeNull();
        expect(screen.queryByText("Setlist sin cargar")).toBeNull();
    });

    it("still lets the musician read what the gig had", () => {
        render(
            <GigCard
                gig={toGigView({ ...row, callTime: "17:30:00", myPay: 2000, setlist: "Intro\nValses", attendance: "Confirmed" })}
                past
                saving={false}
                failed={false}
                onAnswer={vi.fn()}
                onRetry={vi.fn()}
                notifying={null}
                notifyFailed={false}
                onNotify={vi.fn()}
            />
        );

        expect(screen.getByText(/Llegada 17:30/)).toBeInTheDocument();
        expect(screen.getByText("Tu pago: $2,000")).toBeInTheDocument();
        expect(screen.getByText("Ver setlist")).toBeInTheDocument();
        expect(screen.getByText("Confirmado")).toBeInTheDocument();
    });
});

describe("GigCard of a future gig the musician declined", () => {
    it("says in one line what happens next", () => {
        render(
            <GigCard gig={toGigView({ ...row, attendance: "Declined" })} saving={false} failed={false} onAnswer={vi.fn()} onRetry={vi.fn()} notifying={null} notifyFailed={false} onNotify={vi.fn()} />
        );

        expect(screen.getByText("El grupo ya lo sabe · la fecha queda libre")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Avisar que falta/ })).toBeNull();
        expect(screen.queryByText("Este toque ya pasó")).toBeNull();
    });
});

describe("GigCard of a future gig the musician confirmed (T46)", () => {
    const props = { saving: false, failed: false, onAnswer: vi.fn(), onRetry: vi.fn(), ...quiet };

    it("says in one line what happens next, without promising a message", () => {
        render(<GigCard gig={toGigView({ ...row, attendance: "Confirmed" })} {...props} />);

        expect(screen.getByText("El grupo ya cuenta contigo · puedes cambiar tu respuesta cuando quieras")).toBeInTheDocument();
        expect(screen.queryByText(/El grupo ya lo sabe/)).toBeNull();
    });

    it("says nothing about next steps before the musician answers", () => {
        render(<GigCard gig={toGigView(row)} {...props} />);
        expect(screen.queryByText(/El grupo ya cuenta contigo/)).toBeNull();
    });

    it("keeps the answer one tap: no dialog between Confirmo and the answer", async () => {
        const onAnswer = vi.fn();
        render(<GigCard gig={toGigView(row)} {...props} onAnswer={onAnswer} />);
        await userEvent.click(screen.getByRole("button", { name: /Confirmar el/ }));
        expect(onAnswer).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("groups the notices under their own heading and border, after the answer buttons", () => {
        render(<GigCard gig={toGigView(row)} {...props} />);

        const confirm = screen.getByRole("button", { name: /Confirmar el/ });
        const heading = screen.getByText("Avisarle al grupo lo que falta");
        const list = screen.getByRole("list", { name: "Avisarle al grupo lo que falta" });
        const section = heading.parentElement as HTMLElement;

        // The heading is visible text and the block draws a rule and 16 px+ of air above it.
        expect(section).toContainElement(list);
        expect(section).toHaveClass("border-t", "mt-3", "pt-4");
        expect(heading.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(confirm.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(section).not.toContainElement(confirm);
    });
});
