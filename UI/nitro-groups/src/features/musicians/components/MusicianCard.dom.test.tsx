// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MusicianCard } from "./MusicianCard";
import { DirectoryPagination } from "./DirectoryPagination";
import { MusicianDirectoryForm } from "./MusicianDirectoryForm";
import { parseDirectoryFilters } from "../directory";

const card = { userId: 7, name: "Mateo Músico", headline: "Guitarrista", instruments: ["Guitarra", "Bajo"], city: "Guadalajara", years: "5 años", photoUrl: null };

describe("MusicianCard", () => {
    it("links the name to the profile and lists instruments, city and years", () => {
        render(<ul><MusicianCard card={card} actions={<button>Invitar</button>} /></ul>);
        expect(screen.getByRole("link", { name: "Mateo Músico" })).toHaveAttribute("href", "/musicians/7");
        expect(within(screen.getByRole("list", { name: "Instrumentos de Mateo Músico" })).getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByText("Guadalajara · 5 años")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Invitar" })).toBeInTheDocument();
    });
});

describe("DirectoryPagination", () => {
    it("renders nothing for one page and links to the neighbours otherwise", () => {
        const filters = parseDirectoryFilters({ city: "Puebla", page: "2" });
        const { container, rerender } = render(<DirectoryPagination filters={filters} page={1} totalPages={1} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<DirectoryPagination filters={filters} page={2} totalPages={3} />);
        expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/musicians?city=Puebla");
        expect(screen.getByRole("link", { name: "Siguiente" })).toHaveAttribute("href", "/musicians?city=Puebla&page=3");
    });
});

describe("MusicianDirectoryForm", () => {
    it("is a GET form whose empty fields read as empty, never as an example", () => {
        render(<MusicianDirectoryForm filters={parseDirectoryFilters({ instrument: "bajo" })} />);
        const form = screen.getByRole("search", { name: "Buscar músicos" });
        expect(form).toHaveAttribute("method", "get");
        expect(form).toHaveAttribute("action", "/musicians");
        expect(screen.getByLabelText("Nombre")).toHaveValue("");
        expect(screen.getByLabelText("Nombre")).toHaveAttribute("placeholder", "Sin filtro");
        expect(screen.getByLabelText("Instrumento")).toHaveValue("bajo");
        expect(screen.getByLabelText("Ciudad")).toHaveAttribute("name", "city");
    });
});
