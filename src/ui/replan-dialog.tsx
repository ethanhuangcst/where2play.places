"use client";

import { useT } from "@/src/i18n/use-t";

type Props = {
  open: boolean;
  variant?: "replan" | "terminate";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ReplanDialog({ open, variant = "replan", onConfirm, onCancel }: Props) {
  const t = useT();

  if (!open) return null;

  const titleKey =
    variant === "terminate" ? "play.plan.confirm_terminate_title" : "play.plan.confirm_replan_title";
  const bodyKey =
    variant === "terminate" ? "play.plan.confirm_terminate_body" : "play.plan.confirm_replan_body";
  const confirmKey =
    variant === "terminate" ? "play.plan.confirm_terminate_confirm" : "play.plan.confirm_replan_confirm";
  const cancelKey =
    variant === "terminate" ? "play.plan.confirm_terminate_cancel" : "play.plan.confirm_replan_cancel";

  return (
    <div className="dialog-backdrop is-open" data-testid="replan-dialog" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="replan-dialog-title">
        <h2 id="replan-dialog-title">{t(titleKey)}</h2>
        <p>{t(bodyKey)}</p>
        <div className="dialog__actions">
          <button type="button" className="btn btn-danger" data-testid="replan-confirm" onClick={onConfirm}>
            {t(confirmKey)}
          </button>
          <button type="button" className="btn btn-quiet" data-testid="replan-cancel" onClick={onCancel}>
            {t(cancelKey)}
          </button>
        </div>
      </div>
    </div>
  );
}
