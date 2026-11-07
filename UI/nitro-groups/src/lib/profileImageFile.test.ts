import { describe, expect, it } from "vitest";
import { MAX_PROFILE_IMAGE_BYTES, validateProfileImageFile } from "./profileImageFile";

const file = (type: string, size = 1024, name = "foto") => ({ type, size, name });

describe("validateProfileImageFile", () => {
    it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])("accepts %s", (type) => {
        expect(validateProfileImageFile(file(type))).toBeNull();
    });

    it("accepts a file exactly at the size limit", () => {
        expect(validateProfileImageFile(file("image/png", MAX_PROFILE_IMAGE_BYTES))).toBeNull();
    });

    it("rejects a file over the size limit", () => {
        expect(validateProfileImageFile(file("image/png", MAX_PROFILE_IMAGE_BYTES + 1))).toBe(
            "La imagen supera el tamaño máximo de 50 MB.",
        );
    });

    it("rejects an empty file", () => {
        expect(validateProfileImageFile(file("image/png", 0))).toBe("El archivo está vacío.");
    });

    it.each(["video/mp4", "audio/mpeg", "application/pdf", ""])("rejects non-image type '%s'", (type) => {
        expect(validateProfileImageFile(file(type))).toBe("Elige una imagen (JPG, PNG, WebP o GIF).");
    });

    it.each([
        ["image/heic", "foto.heic"],
        ["image/heif", "foto.heif"],
        ["", "foto.HEIC"],
    ])("asks to re-export HEIC/HEIF (%s, %s)", (type, name) => {
        expect(validateProfileImageFile(file(type, 1024, name))).toBe(
            "Los archivos HEIC no se pueden mostrar en el navegador. Expórtalo a JPG o PNG.",
        );
    });
});
