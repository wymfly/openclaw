"use client";

import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function FieldHelpPopover({ help, docsUrl }: { help?: string; docsUrl?: string }) {
	const t = useTranslations("config");

	if (!help) return null;

	return (
		<Tooltip>
			<TooltipTrigger render={<span />}>
				<span
					className="inline-flex items-center cursor-help transition-colors hover:text-[var(--foreground)]"
					style={{ color: "var(--muted-foreground)" }}
				>
					<HelpCircle size={14} />
				</span>
			</TooltipTrigger>
			<TooltipContent className="max-w-[240px]">
				<p className="text-xs">{help}</p>
				{docsUrl && (
					<a
						href={docsUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs mt-1 block hover:underline"
						style={{ color: "var(--primary)" }}
					>
						{t("viewDocs")} &rarr;
					</a>
				)}
			</TooltipContent>
		</Tooltip>
	);
}
