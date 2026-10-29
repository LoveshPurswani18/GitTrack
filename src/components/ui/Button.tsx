import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost";

type BaseProps = {
  variant?: Variant;
  icon?: LucideIcon;
  iconPosition?: "leading" | "trailing";
  className?: string;
};

type LabelProps = BaseProps & { iconOnly?: false; children: ReactNode };
type IconOnlyProps = BaseProps & { iconOnly: true; icon: LucideIcon; "aria-label": string };

// busy (disabled, label swapped for `busyLabel`, e.g. "Refreshing…") only exists on the button
// form; a link has no disabled state, so the types rule it out.
type Props = (LabelProps | IconOnlyProps) &
  (
    | ({ href?: undefined; busy?: boolean; busyLabel?: string } & Omit<
        React.ComponentProps<"button">,
        "children" | "className"
      >)
    | ({ href: string; busy?: never; busyLabel?: never } & Omit<
        React.ComponentProps<"a">,
        "children" | "className" | "href"
      >)
  );

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:opacity-90",
  secondary: "border border-control-border bg-bg text-text-primary hover:bg-surface-hover",
  ghost: "text-text-secondary hover:bg-surface-hover",
};

export function Button(props: Props) {
  const {
    variant = "secondary",
    icon: Icon,
    iconPosition = "leading",
    busy,
    busyLabel,
    disabled,
    iconOnly,
    className,
    children,
    ...rest
  } = props as BaseProps & {
    busy?: boolean;
    busyLabel?: string;
    disabled?: boolean;
    iconOnly?: boolean;
    children?: ReactNode;
  } & Record<string, unknown>;

  const inactive = busy || disabled;
  const classes = cx(
    "text-label inline-flex items-center justify-center gap-2 rounded-sm whitespace-nowrap",
    iconOnly ? "size-11 sm:size-8" : "h-9 px-3 sm:h-8",
    VARIANTS[variant],
    inactive && "cursor-not-allowed opacity-50",
    className,
  );
  // While busy the icon turns (a loading indicator, DESIGN.md §9); not at all under reduced motion.
  const icon = Icon && (
    <Icon
      size={16}
      strokeWidth={1.5}
      aria-hidden="true"
      className={busy ? "animate-spin motion-reduce:animate-none" : undefined}
    />
  );
  const content = iconOnly ? (
    icon
  ) : (
    <>
      {iconPosition === "leading" && icon}
      {busy && busyLabel ? busyLabel : children}
      {iconPosition === "trailing" && icon}
    </>
  );

  if (typeof rest.href === "string") {
    return (
      <a className={classes} {...(rest as React.ComponentProps<"a">)}>
        {content}
      </a>
    );
  }
  const { type = "button", ...buttonRest } = rest as React.ComponentProps<"button">;
  return (
    <button
      type={type}
      className={classes}
      disabled={inactive}
      aria-busy={busy || undefined}
      {...buttonRest}
    >
      {content}
    </button>
  );
}
