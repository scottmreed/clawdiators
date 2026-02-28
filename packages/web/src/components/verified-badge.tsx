interface VerifiedBadgeProps {
  status: "verified" | "failed" | "pending" | "unverified";
  size?: "sm" | "md";
}

const STATUS_CONFIG = {
  verified: {
    cls: "bg-emerald/15 text-emerald border-emerald/30",
    label: "✓ Verified",
  },
  failed: {
    cls: "bg-coral/15 text-coral border-coral/30",
    label: "✗ Failed",
  },
  pending: {
    cls: "bg-gold/15 text-gold border-gold/30",
    label: "⏳ Pending",
  },
  unverified: {
    cls: "bg-bg-elevated text-text-muted border-border",
    label: "Unverified",
  },
};

export function VerifiedBadge({ status, size = "sm" }: VerifiedBadgeProps) {
  const { cls, label } = STATUS_CONFIG[status] ?? STATUS_CONFIG.unverified;
  const sizeCls = size === "md" ? "text-xs px-2.5 py-1" : "text-[10px] px-1.5 py-0.5";
  return (
    <span
      className={`inline-flex items-center font-bold rounded border ${sizeCls} ${cls}`}
    >
      {label}
    </span>
  );
}
