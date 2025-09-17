import { cn } from "@/src/utils/tailwind";

interface TimelineProps {
  children: React.ReactNode;
  className?: string;
}

export function Timeline({ children, className }: TimelineProps) {
  return (
    <div className={cn("relative w-full", className)}>
      {/* Timeline line */}
      <div className="absolute left-2 mt-4 h-[calc(100%-16px)] w-[1px] bg-border" />

      {/* Timeline items container */}
      <div className="pl-4">{children}</div>
    </div>
  );
}

interface TimelineItemProps {
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  isActive?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function TimelineItem({
  children,
  ref,
  isActive,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
}: TimelineItemProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "group relative mb-2 flex w-full cursor-pointer flex-col gap-1 rounded-sm p-2",
        isActive ? "bg-muted" : "hover:bg-primary-foreground",
        className,
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          "fill absolute -left-[11.5px] top-3 h-2 w-2 rounded-full bg-border",
          isActive ? "border-primary" : "border-muted-foreground",
        )}
      />

      {children}
    </div>
  );
}

interface TimelineIconProps {
  children: React.ReactNode;
  className?: string;
}

export function TimelineIcon({ children, className }: TimelineIconProps) {
  return (
    <div
      className={cn(
        "absolute -left-[15px] top-2 flex h-6 w-6 items-center justify-center rounded-full border border-muted-foreground bg-background",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TimelineContentProps {
  children: React.ReactNode;
  className?: string;
}

export function TimelineContent({ children, className }: TimelineContentProps) {
  return (
    <div className={cn("ml-6 flex-1 space-y-1", className)}>{children}</div>
  );
}

interface TimelineHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function TimelineHeader({ children, className }: TimelineHeaderProps) {
  return <div className={cn("space-y-1", className)}>{children}</div>;
}

interface TimelineTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function TimelineTitle({ children, className }: TimelineTitleProps) {
  return (
    <h4 className={cn("text-sm font-medium leading-none", className)}>
      {children}
    </h4>
  );
}

interface TimelineDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function TimelineDescription({
  children,
  className,
}: TimelineDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  );
}
