"use client";
import { useState } from "react";

interface ImageBlockProps {
  data: string;
  mimeType: string;
  fileName?: string;
}

export function ImageBlock({ data, mimeType, fileName }: ImageBlockProps) {
  const [enlarged, setEnlarged] = useState(false);
  const src = `data:${mimeType};base64,${data}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        className="block rounded-lg overflow-hidden ring-1 ring-[var(--border-subtle)] hover:ring-[var(--accent)]/30 transition-all cursor-pointer max-w-[240px]"
        aria-label={fileName ?? "image"}
      >
        <img
          src={src}
          alt={fileName ?? "image"}
          className="max-h-[200px] object-contain"
          loading="lazy"
        />
      </button>

      {enlarged && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 cursor-pointer"
          onClick={() => setEnlarged(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") {
              setEnlarged(false);
            }
          }}
          aria-label="Close image preview"
        >
          <img
            src={src}
            alt={fileName ?? "image"}
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
