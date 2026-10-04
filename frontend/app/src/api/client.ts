import { API_URL } from "../config";

const ACCESS_KEY = "soplate.access";
const REFRESH_KEY = "soplate.refresh";

/** Error devuelto por la API. `message` es el texto del backend (`detail`) cuando existe. */
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    super(typeof detail === "string" ? detail : "Error inesperado");
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// localStorage puede no existir o estar bloqueado (modo privado); nunca debe romper la app.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure la pestaña */
  }
}

export const tokenStore = {
  get: () => ({ access: read(ACCESS_KEY), refresh: read(REFRESH_KEY) }),
  set(access: string, refresh?: string) {
    write(ACCESS_KEY, access);
    if (refresh !== undefined) write(REFRESH_KEY, refresh);
  },
  clear() {
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
  },
};

type Query = Record<string, string | number | boolean | undefined>;

interface FetchOptions {
  method?: string;
  body?: unknown;
  query?: Query;
}

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

async function parse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    // Un error 500 de Django llega como página HTML: no es una falla de conexión.
    return { detail: `El servidor tuvo un error (${response.status}). Intenta de nuevo.` };
  }
}

function send(path: string, options: FetchOptions, access: string | null) {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (access) headers.set("Authorization", `Bearer ${access}`);
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function requestNewAccess(): Promise<string | null> {
  const { refresh } = tokenStore.get();
  if (!refresh) return null;
  const response = await fetch(buildUrl("/auth/token/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) return null;
  // Si el backend rota el token de renovación, llega uno nuevo y hay que guardarlo.
  const { access, refresh: rotated } = (await response.json()) as { access: string; refresh?: string };
  tokenStore.set(access, rotated);
  return access;
}

// Si varias peticiones vencen a la vez, todas esperan la misma renovación en lugar de pedir una cada una.
let refreshing: Promise<string | null> | null = null;

function refreshAccess(): Promise<string | null> {
  refreshing ??= requestNewAccess().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Llama a la API con el token. Si expiró, lo renueva una vez y reintenta; si no se puede, cierra sesión. */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  let response = await send(path, options, tokenStore.get().access);

  if (response.status === 401) {
    const access = await refreshAccess();
    if (!access) {
      tokenStore.clear();
      window.dispatchEvent(new Event("soplate:logout"));
      throw new ApiError(401, await parse(response));
    }
    response = await send(path, options, access);
  }

  const data = await parse(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(buildUrl("/auth/token/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await parse(response);
  if (response.status === 401) throw new ApiError(401, { detail: "Usuario o contraseña incorrectos" });
  if (!response.ok) throw new ApiError(response.status, data);
  const { access, refresh } = data as { access: string; refresh: string };
  tokenStore.set(access, refresh);
}
