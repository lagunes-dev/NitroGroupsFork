const firstLetter = (word: string) => Array.from(word)[0]!.toLocaleUpperCase("es-MX");

/** Avatar initials: first letter of the first and last word ("Emmanuel Hernandez" → "EH"), "?" without a name. */
export function initials(fullName: string | null | undefined): string {
    const words = (fullName ?? "").split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return firstLetter(words[0]!);
    return firstLetter(words[0]!) + firstLetter(words[words.length - 1]!);
}
