import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeAttachmentFilename } from "./config.js";
import type { ParsedEmailAttachment } from "./mime.js";

export async function saveAttachments(
  outputDir: string,
  attachments: ParsedEmailAttachment[],
): Promise<
  Array<{
    filename: string;
    savedAs: string;
    contentType: string;
    size: number;
    path: string;
  }>
> {
  await fs.mkdir(outputDir, { recursive: true });
  const savedFiles = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    const fallback = `attachment-${index + 1}.bin`;
    const safeName = sanitizeAttachmentFilename(attachment.filename, fallback);
    const targetPath = await resolveUniqueOutputPath(outputDir, safeName);
    await fs.writeFile(targetPath, attachment.content);
    savedFiles.push({
      filename: attachment.filename,
      savedAs: path.basename(targetPath),
      contentType: attachment.contentType,
      size: attachment.size,
      path: targetPath,
    });
  }
  return savedFiles;
}

export function guessAttachmentContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".txt":
    case ".log":
      return "text/plain";
    case ".html":
    case ".htm":
      return "text/html";
    case ".csv":
      return "text/csv";
    case ".json":
      return "application/json";
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

async function resolveUniqueOutputPath(outputDir: string, filename: string): Promise<string> {
  const extension = path.extname(filename);
  const basename = extension ? filename.slice(0, -extension.length) : filename;
  for (let counter = 0; counter < 1_000; counter += 1) {
    const candidate =
      counter === 0
        ? path.join(outputDir, filename)
        : path.join(outputDir, `${basename}-${counter}${extension}`);
    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }
  throw new Error(`Could not allocate output filename for "${filename}"`);
}
