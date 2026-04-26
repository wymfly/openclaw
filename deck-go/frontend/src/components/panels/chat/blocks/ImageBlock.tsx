import { useState } from "react";

interface ImageBlockProps {
  data: string;
  mimeType: string;
  fileName?: string;
}

export function ImageBlock({ data, mimeType, fileName }: ImageBlockProps) {
  const [enlarged, setEnlarged] = useState(false);
  const label = fileName ?? "image";
  const src = `data:${mimeType};base64,${data}`;

  return (
    <>
      <button
        className="deck-ui-image-block"
        type="button"
        onClick={() => setEnlarged(true)}
        aria-label={label}
      >
        <img src={src} alt={label} />
      </button>
      {enlarged ? (
        <div
          className="deck-ui-image-preview"
          role="button"
          tabIndex={0}
          aria-label="Close image preview"
          onClick={() => setEnlarged(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter") {
              setEnlarged(false);
            }
          }}
        >
          <img src={src} alt={label} />
        </div>
      ) : null}
    </>
  );
}
