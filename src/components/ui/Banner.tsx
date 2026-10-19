import { CircleAlert, Clock } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
  warning: {
    box: "border-warning bg-warning-subtle",
    title: "text-warning",
    Icon: Clock,
    role: "status",
  },
  danger: {
    box: "border-danger bg-danger-subtle",
    title: "text-danger",
    Icon: CircleAlert,
    role: "alert",
  },
} as const;

export function Banner({
  tone,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  title: string;
  children?: ReactNode;
}) {
  const { box, title: titleColour, Icon, role } = TONES[tone];
  return (
    <div role={role} className={`flex gap-3 rounded-md border px-4 py-3 ${box}`}>
      <Icon size={16} strokeWidth={1.5} aria-hidden="true" className={`mt-0.5 shrink-0 ${titleColour}`} />
      <div className="min-w-0">
        <p className={`text-label font-semibold ${titleColour}`}>{title}</p>
        {children && <p className="text-body text-text-secondary">{children}</p>}
      </div>
    </div>
  );
}
