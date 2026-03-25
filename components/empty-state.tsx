import { cn } from "@/lib/utils";
import { FileX, SearchX, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Variant = "no-data" | "no-results" | "error";

const ICONS: Record<Variant, LucideIcon> = {
  "no-data": Inbox,
  "no-results": SearchX,
  error: FileX,
};

const DEFAULTS: Record<Variant, { title: string; description: string }> = {
  "no-data": {
    title: "Nothing here yet",
    description: "There's no data to display right now.",
  },
  "no-results": {
    title: "No results found",
    description: "Try adjusting your search or filters.",
  },
  error: {
    title: "Something went wrong",
    description: "We couldn't load the data. Please try again.",
  },
};

interface EmptyStateProps {
  variant?: Variant;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  variant = "no-data",
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const Icon = icon ?? ICONS[variant];
  const defaults = DEFAULTS[variant];

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold mb-1">{title ?? defaults.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {description ?? defaults.description}
      </p>
      {action && (
        <Button onClick={action.onClick} className="mt-4" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
