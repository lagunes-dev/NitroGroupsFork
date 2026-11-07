/** Same ceiling as the media upload endpoint (`UploadGroupMediaFile`). */
export const MAX_PROFILE_IMAGE_BYTES = 50 * 1024 * 1024;

type PickedFile = { type: string; size: number; name: string };

const isHeic = (file: PickedFile) =>
    /^image\/hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/** Returns a user-facing error, or null when the file can be uploaded as a profile image. */
export function validateProfileImageFile(file: PickedFile): string | null {
    if (isHeic(file)) {
        return "Los archivos HEIC no se pueden mostrar en el navegador. Expórtalo a JPG o PNG.";
    }
    if (!file.type.startsWith("image/")) {
        return "Elige una imagen (JPG, PNG, WebP o GIF).";
    }
    if (file.size === 0) return "El archivo está vacío.";
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
        return `La imagen supera el tamaño máximo de ${MAX_PROFILE_IMAGE_BYTES / 1024 / 1024} MB.`;
    }
    return null;
}
