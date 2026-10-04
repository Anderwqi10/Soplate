import { ApiError } from "../api/client";

/** Convierte `{campo: ["mensaje"]}` de DRF en líneas legibles. */
function fieldErrors(data: unknown): string[] {
  if (!data || typeof data !== "object" || "detail" in data) return [];
  return Object.entries(data as Record<string, unknown>).map(([field, messages]) => {
    const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
    return field === "non_field_errors" ? text : `${field}: ${text}`;
  });
}

export default function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  const isApi = error instanceof ApiError;
  const fields = isApi ? fieldErrors(error.data) : [];
  const message = isApi
    ? fields.length > 0 ? "Revisa los datos marcados." : error.message
    : "No se pudo conectar con el servidor. Revisa que el backend esté encendido.";

  return (
    <div role="alert" className="border-l-4 border-red bg-sheet px-4 py-3 text-sm text-red">
      <p className="font-semibold">{message}</p>
      {fields.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {fields.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
