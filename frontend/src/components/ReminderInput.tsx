import { useEffect, useState } from "react";

/** Convierte un ISO (UTC) a la cadena local que espera <input type="datetime-local">. */
export function toInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convierte la cadena local del input a ISO (UTC) para guardar, o null si está vacío. */
function fromInputLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

export default function ReminderInput({ value, onChange }: Props) {
  const [local, setLocal] = useState(() => toInputLocal(value));

  useEffect(() => {
    setLocal(toInputLocal(value));
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="datetime-local"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(fromInputLocal(e.target.value));
        }}
        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500 [color-scheme:dark]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Quitar recordatorio"
          title="Quitar recordatorio"
          className="shrink-0 rounded-lg border border-slate-700 px-2 py-1.5 text-sm text-slate-400 hover:border-red-500 hover:text-red-400"
        >
          ✕
        </button>
      )}
    </div>
  );
}