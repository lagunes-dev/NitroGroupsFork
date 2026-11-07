"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { uploadGroupMediaFile } from "@/lib/groupMediaUpload";
import { validateProfileImageFile } from "@/lib/profileImageFile";

type ImageUrlFieldProps = {
  id: string;
  label: string;
  groupId: number;
  value: string;
  onChange: (url: string) => void;
  helperText?: string;
};

/**
 * Image URL input with an "upload from my computer" option that fills the URL after uploading.
 * Rows are label, field, upload row, note, so two of these side by side stay aligned.
 */
export function ImageUrlField({ id, label, groupId, value, onChange, helperText }: ImageUrlFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const problem = validateProfileImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadGroupMediaFile(groupId, file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setIsUploading(false);
      // Lets the user pick the same file again after a failure.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Input
        id={id}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://…"
        type="url"
        inputMode="url"
        error={error ?? undefined}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isUploading}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden />
          {isUploading ? "Subiendo…" : "Subir desde mi equipo"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-label={`${label}: elegir archivo`}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <span className="text-sm text-tinta-2">o pega un enlace arriba</span>
      </div>
      {helperText && <p className="text-sm leading-5 text-tinta-2">{helperText}</p>}
    </div>
  );
}
