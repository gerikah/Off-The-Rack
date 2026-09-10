"use client";
import { useActionState } from "react";
import { loginAction, logoutAction } from "@/app/admin/auth-actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="admin-form" aria-busy={pending}>
      <label htmlFor="admin-email">
        Email
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label htmlFor="admin-password">
        Password
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </label>
      {state.error && (
        <p className="admin-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="admin-button" disabled={pending}>
        {pending ? "SIGNING IN..." : "LOG IN"}
      </button>
    </form>
  );
}
export function LogoutButton() {
  const [state, action, pending] = useActionState(logoutAction, {});
  return (
    <form action={action}>
      <button className="admin-button admin-button-quiet" disabled={pending}>
        {pending ? "LOGGING OUT..." : "Log out"}
      </button>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
