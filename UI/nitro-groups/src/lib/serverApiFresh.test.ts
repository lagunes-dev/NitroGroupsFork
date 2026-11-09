// Round 13: a client wrote a review, the API stored it and updated the group's average, and the public
// page kept saying "3.5 · 2 reseñas" for more than half an hour. Every server read of the group's public
// data carried `revalidate: 60`, and in this setup the entry written before the review was never
// refreshed. The musicians' pages had been fixed the same way in e96f997 and the groups' pages were
// left behind. This pins the rule: a server read gives a number of seconds only for catalogs nobody
// edits; anything a person writes is read fresh.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Seconds of cache a catalog may keep (genres change with a deploy, not with a user). */
const CATALOG_MIN_SECONDS = 3600;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !path.endsWith("serverApi.ts") ? [path] : [];
    });
}

/**
 * Every `serverGet(...)` / `serverGetResult(...)` call with its last argument, when that argument is a
 * literal number. A regex cannot balance the generics and the parentheses of a template literal, and a
 * guard that matches nothing passes while checking nothing, so the call is walked by depth instead.
 */
function literalWindows(source: string): number[] {
    const found: number[] = [];
    for (const start of source.matchAll(/serverGet(?:Result)?\b/g)) {
        let i = start.index + start[0].length;
        if (source[i] === "<") {
            for (let depth = 0; i < source.length; i++) {
                if (source[i] === "<") depth++;
                if (source[i] === ">" && --depth === 0) { i++; break; }
            }
        }
        while (source[i] === " ") i++;
        if (source[i] !== "(") continue;
        const open = i;
        let depth = 0;
        let lastComma = -1;
        for (; i < source.length; i++) {
            const c = source[i];
            if (c === "(" || c === "[" || c === "{") depth++;
            else if (c === ")" || c === "]" || c === "}") { if (--depth === 0) break; }
            else if (c === "," && depth === 1) lastComma = i;
        }
        if (lastComma < 0) continue;
        const last = source.slice(lastComma + 1, i).trim();
        if (/^\d+$/.test(last)) found.push(Number(last));
        void open;
    }
    return found;
}

describe("server reads of data people edit", () => {
    it("never keep a cache window shorter than a catalog's", () => {
        const offenders = sourceFiles(SRC).flatMap((file) =>
            literalWindows(readFileSync(file, "utf8"))
                .filter((seconds) => seconds > 0 && seconds < CATALOG_MIN_SECONDS)
                .map((seconds) => `${file.replace(SRC, "src")}: revalidate ${seconds}`)
        );

        expect(offenders).toEqual([]);
    });

    it("recognizes the shape it is meant to catch", () => {
        expect(literalWindows('await serverGetResult<X>(`/groups/${id}/reviews`, 60);')).toEqual([60]);
        expect(literalWindows('serverGet<PagedResult<G>>(`/groups/search?${api}`, 30),')).toEqual([30]);
        expect(literalWindows('serverGet<Genre[]>("/genres", 3600),')).toEqual([3600]);
        expect(literalWindows("serverGetResult<X>(`/musicians/${id}`, FRESH)")).toEqual([]);
    });
});
