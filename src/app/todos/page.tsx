import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Todos",
  robots: { index: false, follow: false },
};

export default async function TodosPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: todos, error } = await supabase
    .from("todos")
    .select("id, name");

  return (
    <section className="section-wrap">
      <h1 className="display">Todos</h1>
      {error ? (
        <p role="status">Todos are temporarily unavailable.</p>
      ) : todos?.length ? (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>{todo.name}</li>
          ))}
        </ul>
      ) : (
        <p>No todos yet.</p>
      )}
    </section>
  );
}
