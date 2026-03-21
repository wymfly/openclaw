"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)] [&_pre]:overflow-auto [&_pre]:text-xs [&_code]:text-xs [&_pre]:bg-[var(--bg-primary)] [&_pre]:rounded-lg [&_pre]:p-2.5 [&_code]:font-mono [&_table]:text-xs [&_th]:bg-[var(--bg-tertiary)] [&_th]:px-3 [&_th]:py-1.5 [&_td]:px-3 [&_td]:py-1.5 [&_th]:border-[var(--border)] [&_td]:border-[var(--border-subtle)]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
