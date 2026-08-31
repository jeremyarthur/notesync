import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import InkMini from "../components/InkMini";
import { api, getApiBase } from "../lib/api";
import type { Note } from "../lib/types";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setNotes(await api.get<Note[]>("/notes"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las notas");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Eliminar esta nota?")) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((note) => note.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  const feedUrl = `${getApiBase().replace("/api", "")}/api/feed.ics`;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="NoteSync" className="h-9 w-9 rounded-xl" />
            <div>
              <h1 className="text-lg font-bold leading-tight">NoteSync</h1>
              <p className="text-xs text-slate-400">
                Escribe con tu S Pen en el tab · revísalo en tu iPhone
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={feedUrl}
              className="hidden rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-indigo-500 sm:block"
              title="Suscripción WebCal para la app Calendario de Apple"
            >
              WebCal
            </a>
            <Link
              to="/editor"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z" />
              </svg>
              Nueva nota
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Tus notas ({notes.length})</h2>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error} — ¿Está corriendo la API? Ejecútala con{" "}
            <code className="rounded bg-slate-800 px-1">uvicorn app.main:app --port 8001</code>
          </p>
        )}

        {fetching ? (
          <p className="text-slate-400">Cargando…</p>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
            <p className="text-slate-300">Todavía no tienes notas.</p>
            <p className="mt-1 text-sm text-slate-500">
              Toca "Nueva nota" y escribe a mano alzada con el S Pen.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {notes.map((note) => (
              <li
                key={note.id}
                className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
              >
                <Link to={`/nota/${note.id}`} className="block bg-white">
                  {note.ink ? (
                    <InkMini ink={note.ink} />
                  ) : (
                    <div className="flex h-40 items-center justify-center p-4 text-center text-sm text-slate-500">
                      {note.body || note.title}
                    </div>
                  )}
                </Link>
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{note.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatDate(note.created_at)}
                      {note.synced_to_ios && " · Sincronizado con iPhone"}
                    </p>
                    {note.reminder_at && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-indigo-300">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-3 w-3"
                          aria-hidden="true"
                        >
                          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
                        </svg>
                        {formatDate(note.reminder_at)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(note.id)}
                    aria-label="Eliminar nota"
                    title="Eliminar nota"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-400"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}