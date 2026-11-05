// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicMusicianProfile } from "./PublicMusicianProfile";
import type { MusicianProfileView } from "../profileView";

// The profile mounts an invisible client child that leaves the S9 visit; it needs the app's
// providers, so here it is replaced by a spy. Its own test file covers what it does.
const { recordedFor } = vi.hoisted(() => ({ recordedFor: vi.fn() }));
vi.mock("@/features/membership/components/RecordProfileVisit", () => ({
    RecordProfileVisit: ({ musicianUserId }: { musicianUserId: number }) => {
        recordedFor(musicianUserId);
        return null;
    },
}));

const profile: MusicianProfileView = {
    userId: 13,
    fullName: "Miguel Bajista",
    headline: "Bajista de bodas y eventos corporativos",
    shortBio: "Seis años tocando en vivo.",
    instruments: ["Bajo"],
    city: "Guadalajara, Jalisco",
    yearsExperience: 6,
    photoUrl: null,
    videoUrl: null,
    isOpenToJoin: false,
    groups: [],
};

describe("PublicMusicianProfile", () => {
    it("asks to leave the visit for the profile being read", () => {
        render(<PublicMusicianProfile profile={profile} />);
        expect(recordedFor).toHaveBeenCalledWith(profile.userId);
    });

    it("describes a closed profile as a state, not as a rejection", () => {
        render(<PublicMusicianProfile profile={profile} />);
        expect(screen.getByText("Sin invitaciones por ahora")).toBeInTheDocument();
        expect(screen.queryByText("No disponible por ahora")).toBeNull();
    });

    it("says in the panel that the profile is still public", () => {
        render(<PublicMusicianProfile profile={profile} />);
        expect(screen.getByText(/no está recibiendo invitaciones de grupos/)).toBeInTheDocument();
        expect(screen.getByText(/Su perfil sigue siendo público/)).toBeInTheDocument();
    });

    it("still offers the invitation when the musician is open", () => {
        render(
            <PublicMusicianProfile
                profile={{ ...profile, isOpenToJoin: true }}
                inviteAction={<button type="button">Invitar a mi grupo</button>}
            />
        );
        expect(screen.getByText("Disponible para unirse")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Invitar a mi grupo" })).toBeInTheDocument();
        expect(screen.queryByText(/no está recibiendo invitaciones/)).toBeNull();
    });
});
