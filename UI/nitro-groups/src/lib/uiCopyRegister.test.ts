// The interface speaks to the user as "tú" (Arrastra, Elige, Recarga). A regional second person
// ("dejás", "tocás") leaking into a label or a helper text reads as a different voice in the middle
// of the same screen; round 9 found two of them, both written by the same hand in the same change.
// This pins the register so a third one cannot ship unnoticed.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Forms that are voseo and nothing else: "tocas" and "dejas" are valid "tú" and stay allowed. */
// `\b` does not treat an accented vowel as a letter in JavaScript, so `dejás\b` can never match and a
// guard built on it would pass while checking nothing. Letter boundaries are spelled out instead.
const STRICT =
    /(?<![\p{L}])(dejás|tocás|elegí|podés|querés|tenés|sabés|hacé|mirá|pasá|escribí|cargá|guardá|usá|volvé|fijate|acordate)(?![\p{L}])/iu;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
}

describe("interface copy register", () => {
    it("never uses voseo in a source file that renders text", () => {
        const offenders = sourceFiles(SRC).flatMap((file) =>
            readFileSync(file, "utf8")
                .split("\n")
                .map((line, index) => ({ file: file.replace(SRC, "src"), line: index + 1, text: line.trim() }))
                .filter(({ text }) => STRICT.test(text))
        );

        expect(offenders).toEqual([]);
    });

    it("recognizes the forms it is meant to catch", () => {
        for (const sample of ["Si lo dejás vacío", "Con quién tocás", "Elegí una fecha", "Podés cambiarla"]) {
            expect(STRICT.test(sample), sample).toBe(true);
        }
    });

    it("leaves the neutral forms alone", () => {
        for (const sample of ["Si lo dejas vacío", "Con quién tocas", "Elige una fecha", "Puedes cambiarla"]) {
            expect(STRICT.test(sample), sample).toBe(false);
        }
    });
});
