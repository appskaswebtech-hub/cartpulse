import { useTranslation } from "../i18n/LanguageContext";
import { useEffect, useState } from "react";

/** Confirmation dialog for destructive actions. Closes on Escape or backdrop. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { tr, locale } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="ui-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="ui-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={tr(title)}
      >
        <div className="ui-dialog-body">
          <span className="ui-dialog-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ui-danger)"
              strokeWidth="2"
            >
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </span>
          <div>
            <p className="ui-dialog-title">{tr(title)}</p>
            <p className="ui-dialog-text">{tr(message)}</p>
          </div>
        </div>
        <div className="ui-dialog-foot">
          <button
            type="button"
            className="ui-btn ui-btn-ghost"
            onClick={onCancel}
          >
            {tr(cancelLabel)}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-danger"
            onClick={onConfirm}
            autoFocus
          >
            {tr(confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Transient confirmation message. Fades itself out, then clears. */
export function Toast({
  message,
  tone = "success",
  onDone,
  duration = 2600,
}: {
  message: string | null;
  tone?: "success" | "danger";
  onDone: () => void;
  duration?: number;
}) {
  const { tr, locale } = useTranslation();

  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!message) return;
    setLeaving(false);
    const leaveTimer = setTimeout(() => setLeaving(true), duration);
    const doneTimer = setTimeout(onDone, duration + 220);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, [message, duration, onDone]);

  if (!message) return null;

  return (
    <div className="ui-toast-wrap">
      <div
        className={leaving ? "ui-toast leaving" : "ui-toast"}
        role="status"
        aria-live="polite"
      >
        <span
          className={
            tone === "danger" ? "ui-toast-mark danger" : "ui-toast-mark"
          }
        >
          {tone === "danger" ? (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3.5"
            >
              <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          ) : (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="4"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        {tr(message)}
      </div>
    </div>
  );
}

/** Spinner / tick that replaces a submit button's label while it works. */
export function SaveLabel({
  saving,
  saved,
  idleLabel = "Save",
}: {
  saving: boolean;
  saved: boolean;
  idleLabel?: string;
}) {
  const { tr, locale } = useTranslation();

  if (saving) {
    return (
      <>
        <span className="ui-spin" />
        {tr(" Saving... ")}
      </>
    );
  }
  if (saved) {
    return (
      <>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {tr(" Saved ")}
      </>
    );
  }
  return <>{tr(idleLabel)}</>;
}
