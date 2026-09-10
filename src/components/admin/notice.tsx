"use client";
import { createContext, useCallback, useContext, useState } from "react";
const NoticeContext = createContext<(message: string) => void>(() => {});
export function AdminNoticeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [message, setMessage] = useState("");
  const notify = useCallback((text: string) => setMessage(text), []);
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div className="admin-toast" role="status" aria-live="polite">
        {message && (
          <>
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </>
        )}
      </div>
    </NoticeContext.Provider>
  );
}
export const useAdminNotice = () => useContext(NoticeContext);
