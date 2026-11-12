// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import GroupCalendar from "./GroupCalendar";

const { getGroupSchedules, removeAvailability, removeBusySchedule } = vi.hoisted(() => ({
    getGroupSchedules: vi.fn(),
    removeAvailability: vi.fn(),
    removeBusySchedule: vi.fn(),
}));
vi.mock("../services/groupAvailability.service", () => ({
    groupAvailabilityService: { getGroupSchedules, removeAvailability, removeBusySchedule, createBusySchedule: vi.fn() },
}));
vi.mock("@/features/gigs/gigs.service", () => ({ gigsService: { forGroup: vi.fn().mockResolvedValue([]) } }));

/**
 * FullCalendar is replaced by a stub that keeps the props the component hands it, so a test can call
 * `eventClick` exactly the way FullCalendar does: with the clicked event, never with a DOM click. This
 * is what the real calendar does for a foreground event and does NOT do for a background one.
 */
const fc = vi.hoisted(() => ({ props: null as null | { events: EventInput[]; eventClick: (arg: EventClickArg) => void } }));
vi.mock("@fullcalendar/react", () => ({
    default: (props: { events: EventInput[]; eventClick: (arg: EventClickArg) => void }) => {
        fc.props = props;
        return null;
    },
}));

const day = new Date();
const at = (hour: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour).toISOString();
const MARK = { id: "avail_3", title: "Disponible", start: at(8), end: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString(), isAvailable: true };

function eventClickArg(event: EventInput): EventClickArg {
    return {
        event: { id: String(event.id), title: String(event.title), extendedProps: event.extendedProps ?? {} },
    } as unknown as EventClickArg;
}

beforeEach(() => {
    getGroupSchedules.mockReset();
    getGroupSchedules.mockResolvedValue([MARK]);
    removeAvailability.mockReset();
    removeAvailability.mockResolvedValue(undefined);
    removeBusySchedule.mockReset();
    fc.props = null;
});

async function renderWithMark() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <GroupCalendar groupId={1} mode="private" />
        </QueryClientProvider>
    );
    await waitFor(() => expect(fc.props?.events.some((e) => String(e.id).startsWith("avail_"))).toBe(true));
    return fc.props!;
}

describe("ronda 13 · quitar la marca de disponibilidad, como FullCalendar entrega el toque", () => {
    it("hands the calendar the mark as a background event plus one foreground all-day chip", async () => {
        const props = await renderWithMark();

        const mark = props.events.find((e) => e.id === "avail_3");
        const chips = props.events.filter((e) => e.allDay && e.extendedProps?.removes);

        expect(mark?.display).toBe("background");
        expect(chips).toHaveLength(1);
        expect(chips[0].display).toBeUndefined();
        expect(chips[0].editable).toBe(false);
    });

    it("opens «Quitar «Disponible»» when eventClick delivers the chip, and confirming removes it exactly once", async () => {
        const user = userEvent.setup();
        const props = await renderWithMark();
        const chip = props.events.find((e) => e.allDay && e.extendedProps?.removes)!;

        act(() => props.eventClick(eventClickArg(chip)));

        expect(await screen.findByRole("dialog", { name: "Quitar «Disponible»" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Quitar del calendario" }));

        await waitFor(() => expect(removeAvailability).toHaveBeenCalledTimes(1));
        expect(removeAvailability).toHaveBeenCalledWith(1, "avail_3");
        expect(removeBusySchedule).not.toHaveBeenCalled();
    });

    it("still routes a busy block to its own removal", async () => {
        const user = userEvent.setup();
        removeBusySchedule.mockResolvedValue(undefined);
        getGroupSchedules.mockResolvedValue([{ id: "busy_12", title: "Ensayo", start: at(17), end: at(20), isAvailable: false }]);
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <GroupCalendar groupId={1} mode="private" />
            </QueryClientProvider>
        );
        await waitFor(() => expect(fc.props?.events.some((e) => e.id === "busy_12")).toBe(true));

        act(() => fc.props!.eventClick(eventClickArg(fc.props!.events.find((e) => e.id === "busy_12")!)));
        await user.click(await screen.findByRole("button", { name: "Quitar del calendario" }));

        await waitFor(() => expect(removeBusySchedule).toHaveBeenCalledWith(1, "busy_12"));
        expect(removeAvailability).not.toHaveBeenCalled();
    });
});
