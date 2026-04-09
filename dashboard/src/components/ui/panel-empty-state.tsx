"use client";

import { Inbox } from "lucide-react";

interface PanelEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function PanelEmptyState({ icon, title, description, action }: PanelEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 p-6 text-center">
      <div className="text-[var(--muted-foreground)]">
        {icon ?? <Inbox size={40} strokeWidth={1.2} />}
      </div>
      <h3 className="text-sm font-medium text-[var(--foreground)]">{title}</h3>
      {description && (
        <p className="text-xs text-[var(--muted-foreground)] max-w-[280px]">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
