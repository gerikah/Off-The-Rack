"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/admin/validation";
import { useAdminNotice } from "./notice";
type Props = {
  label: string;
  title: string;
  description: string;
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  danger?: boolean;
};
function Confirmation({
  title,
  description,
  label,
  action,
  fields,
  danger,
  onClose,
}: Props & { onClose: () => void }) {
  const notify = useAdminNotice();
  const [state, submit, pending] = useActionState(
    async (previous: ActionState, form: FormData) => {
      const result = await action(previous, form);
      // Notify even if revalidation removes the row or its old status action.
      if (result.success) {
        notify(result.message || "UPDATED.");
        onClose();
      }
      return result;
    },
    {},
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p>{description}</p>
      <form action={submit} aria-busy={pending}>
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="confirm" value="yes" />
        {state.error && (
          <p className="admin-error" role="alert">
            {state.error}
          </p>
        )}
        <div className="admin-form-actions">
          <button
            autoFocus
            type="button"
            className="admin-button admin-button-secondary"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            className={"admin-button" + (danger ? " admin-button-danger" : "")}
            disabled={pending}
          >
            {pending ? "UPDATING..." : label}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function ConfirmAction(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={"admin-text-button" + (props.danger ? " is-danger" : "")}
        onClick={() => setOpen(true)}
      >
        {props.label}
      </button>
      {open && <Confirmation {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
