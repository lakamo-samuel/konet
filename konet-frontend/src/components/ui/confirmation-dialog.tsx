"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/data/access/client";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  variant?: "primary" | "danger";
  onCancel: () => void;
  onConfirm: () => Promise<unknown>;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = "Working…",
  pending = false,
  variant = "danger",
  onCancel,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [failure, setFailure] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLButtonElement>(".confirmation-cancel")?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="modal confirmation-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !pending) onCancel();
      }}
    >
      <div className="confirmation-dialog-content">
        <span className="eyebrow muted">Please confirm</span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        {failure && <p className="field-error" role="alert">{failure}</p>}
        <div className="confirmation-dialog-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="confirmation-cancel"
            onClick={onCancel}
          >
            Keep me here
          </Button>
          <Button
            type="button"
            variant={variant}
            disabled={pending}
            onClick={async () => {
              setFailure("");
              try {
                await onConfirm();
                onCancel();
              } catch (error) {
                setFailure(errorMessage(error));
              }
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
