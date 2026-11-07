/** One line for a musician card: the same row exists whether or not the musician filled the years in. */
export function experienceLabel(years: number | null | undefined): string {
    if (!years) return "Experiencia sin indicar";
    return `${years} ${years === 1 ? "año" : "años"} de experiencia`;
}
