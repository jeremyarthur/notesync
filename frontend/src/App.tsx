import { useEffect, useState, type FormEvent } from "react";
import { api, getApiBase } from "./lib/api";
import type { Note } from "./lib/types";

const SOURCE_LABELS: Record<string, string> = {
  web: "Web / PWA",
  samsung: "Samsung",
  api: "API",
};

function formatReminder(value: string): string {
  const date = new Date(value);
  return date.toLocaleString("es-DO", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [source, setSource] = useState("web");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const load = async () => {
    try {
      setNotes(await api.get<Note[]>("/notes"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las notas");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (getApiBase() === "/api") setError("");
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post<Note>("/notes", {
        title,
        body,
        reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
        source,
      });
      setTitle("");
      setBody("");
      setReminderAt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la nota");
    } finally {
      setLoading(false);
    }
  };

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
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src="/icon.svg" alt="NoteSync" className="h-9 w-9 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold">NoteSync</h1>
            <p className="text-xs text-slate-400">
              Escribe con tu S Pen, recíbelo en tu iPhone
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error} — ¿Está corriendo la API? Ejecútala con{" "}
            <code className="rounded bg-slate-800 px-1">uvicorn app.main:app --port 8001</code>
          </p>
        )}

        <form
          onSubmit={handleCreate}
          className="mb-10 space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <h2 className="font-semibold">Nueva nota / recordatorio</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              placeholder="Ej: Pagar servicio de agua"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Contenido (opcional)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              placeholder="Detalles de la nota…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Recordatorio (opcional)
              </label>
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Origen</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option value="web">Web / PWA</option>
                <option value="samsung">Samsung Notes (compartir)</option>
                <option value="api">API</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar nota"}
          </button>
        </form>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Tus notas</h2>
          <a
            href={feedUrl}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-500"
            title="Suscripción WebCal para la app Calendario de Apple"
          >
            Suscribirse (WebCal)
          </a>
        </div>

        {fetching ? (
          <p className="text-slate-400">Cargando…</p>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-sm text-slate-400">
            No hay notas todavía. Crea la primera arriba.
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {note.title}
                    {note.synced_to_ios && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                        ✓ En iPhone
                      </span>
                    )}
                  </p>
                  {note.body && <p className="mt-1 text-sm text-slate-400">{note.body}</p>}
                  <p className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    <span>Desde: {SOURCE_LABELS[note.source] ?? note.source}</span>
                    {note.reminder_at && (
                      <span>🔔 {formatReminder(note.reminder_at)}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:border-red-500 hover:text-red-400"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}