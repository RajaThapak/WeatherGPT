import { ChevronRight, Maximize2 } from "lucide-react";

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; variant: "pill" | "link"; onClick?: () => void };
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[22px] font-semibold text-text-primary">{title}</h2>
      {action?.variant === "pill" && (
        <button
          type="button"
          onClick={action.onClick}
          className="flex items-center gap-1 rounded-full bg-surface-1 px-4 py-2 text-[13px] font-medium text-text-secondary transition-colors duration-[120ms] hover:bg-surface-2 active:scale-[0.97]"
        >
          {action.label}
          <Maximize2 size={12} strokeWidth={1.5} />
        </button>
      )}
      {action?.variant === "link" && (
        <button
          type="button"
          onClick={action.onClick}
          className="flex items-center gap-0.5 text-[13px] text-text-secondary transition-colors duration-[120ms] hover:text-text-primary"
        >
          {action.label}
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
