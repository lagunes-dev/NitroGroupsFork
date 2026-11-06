// The keyboard ring is declared once, in src/app/globals.css, outside every cascade layer. These
// assertions pin the shape of that declaration: a `:focus-visible` outline inside `@layer base`
// loses against Tailwind's `outline-none` utility (which also sets `--tw-outline-style: none`, the
// value every `outline-*` utility reads back), and that is exactly how eleven controls of the
// request thread ended up painting no ring at all (T50).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss, { type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../app/globals.css");
const css = readFileSync(CSS_PATH, "utf8");
const root = postcss.parse(css);

const isRingRule = (rule: Rule) => rule.selectors.some((selector) => selector.trim() === ":focus-visible");
const mentionsFocusVisible = (rule: Rule) => rule.selectors.some((selector) => selector.includes(":focus-visible"));

/** The ring rule at the top level of the sheet: outside `@layer`, so it wins against the utilities. */
function unlayeredRingRules(): Rule[] {
    return root.nodes.filter((node): node is Rule => node.type === "rule" && isRingRule(node));
}

/** Every rule that targets `:focus-visible` anywhere, including inside a cascade layer or an at-rule. */
function everyRingRule(): Rule[] {
    const rules: Rule[] = [];
    root.walkRules((rule) => {
        if (mentionsFocusVisible(rule)) rules.push(rule);
    });
    return rules;
}

function declaration(rule: Rule | undefined, prop: string): string | null {
    const found = rule?.nodes.find((node): node is Declaration => node.type === "decl" && node.prop === prop);
    return found ? found.value : null;
}

describe("the keyboard focus ring", () => {
    it("is declared outside every cascade layer, with a visible width and the accent colour", () => {
        const rules = unlayeredRingRules();

        expect(rules).toHaveLength(1);
        expect(declaration(rules[0], "outline-style")).toBe("solid");
        expect(declaration(rules[0], "outline-width")).toBe("2px");
        // Not a transparent or inherit colour: the ring has to be visible on the dark surface.
        expect(declaration(rules[0], "outline-color")).toBe("var(--acento)");
    });

    it("leaves the offset to the base layer and to the utilities, so a control can still tune it", () => {
        // A default offset has to exist without the ring cancelling the `focus-visible:outline-offset-*`
        // utilities; those live in a layer, so an offset declared here would win over them.
        expect(declaration(unlayeredRingRules()[0], "outline-offset")).toBeNull();
        expect(everyRingRule().some((rule) => declaration(rule, "outline-offset") === "3px")).toBe(true);
    });

    it("is never cancelled by another focus rule", () => {
        const cancels = everyRingRule().filter((rule) => {
            const shorthand = declaration(rule, "outline");
            return (
                declaration(rule, "outline-style") === "none" ||
                declaration(rule, "outline-width") === "0" ||
                shorthand === "none" ||
                shorthand === "0" ||
                /transparent/.test(shorthand ?? "")
            );
        });

        expect(cancels.map((rule) => rule.selector)).toEqual([]);
    });
});
