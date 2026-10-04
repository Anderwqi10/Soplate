import { ApiError, apiFetch, login, tokenStore } from "./client";

function json(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  tokenStore.clear();
});

afterEach(() => vi.unstubAllGlobals());

test("sends bearer token and drops undefined query params", async () => {
  tokenStore.set("A1", "R1");
  fetchMock.mockResolvedValueOnce(json(200, [{ id: 1 }]));
  const data = await apiFetch<{ id: number }[]>("/loans/", { query: { status: "PAID", borrower: undefined } });
  expect(data).toEqual([{ id: 1 }]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toMatch(/\/loans\/\?status=PAID$/);
  expect(new Headers(init.headers).get("Authorization")).toBe("Bearer A1");
});

test("refreshes once on 401 and retries", async () => {
  tokenStore.set("A1", "R1");
  fetchMock
    .mockResolvedValueOnce(json(401, { detail: "expired" }))
    .mockResolvedValueOnce(json(200, { access: "A2" }))
    .mockResolvedValueOnce(json(200, { ok: true }));
  await expect(apiFetch("/me/")).resolves.toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/auth\/token\/refresh\/$/);
  expect(tokenStore.get().access).toBe("A2");
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Authorization")).toBe("Bearer A2");
});

test("logs out when refresh fails", async () => {
  tokenStore.set("A1", "R1");
  const onLogout = vi.fn();
  window.addEventListener("soplate:logout", onLogout);
  fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(401));
  await expect(apiFetch("/me/")).rejects.toBeInstanceOf(ApiError);
  expect(tokenStore.get()).toEqual({ access: null, refresh: null });
  expect(onLogout).toHaveBeenCalledTimes(1);
  window.removeEventListener("soplate:logout", onLogout);
});

test("ApiError carries backend detail", async () => {
  tokenStore.set("A1", "R1");
  fetchMock.mockResolvedValueOnce(json(400, { detail: "Saldo insuficiente en la cuenta" }));
  const error = await apiFetch<never>("/loans/", { method: "POST", body: {} }).catch((e: ApiError) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.message).toBe("Saldo insuficiente en la cuenta");
  expect(error.status).toBe(400);
});

test("returns undefined on 204", async () => {
  tokenStore.set("A1", "R1");
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(apiFetch("/borrowers/1/", { method: "DELETE" })).resolves.toBeUndefined();
});

test("login stores both tokens", async () => {
  fetchMock.mockResolvedValueOnce(json(200, { access: "A9", refresh: "R9" }));
  await login("ana", "clave");
  expect(tokenStore.get()).toEqual({ access: "A9", refresh: "R9" });
});

test("login with wrong credentials gives a clear message", async () => {
  fetchMock.mockResolvedValueOnce(json(401, { detail: "No active account" }));
  await expect(login("ana", "mala")).rejects.toThrow("Usuario o contraseña incorrectos");
});

test("a server error page (HTML) becomes a clear ApiError, not a network error", async () => {
  tokenStore.set("A1", "R1");
  fetchMock.mockResolvedValueOnce(new Response("<html>Server Error</html>", { status: 500 }));
  const error = await apiFetch<never>("/loans/").catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).message).toBe("El servidor tuvo un error (500). Intenta de nuevo.");
});

test("concurrent 401s share a single refresh", async () => {
  tokenStore.set("A1", "R1");
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (String(url).endsWith("/auth/token/refresh/")) return json(200, { access: "A2" });
    const auth = new Headers(init.headers).get("Authorization");
    return auth === "Bearer A2" ? json(200, { ok: true }) : json(401);
  });
  await Promise.all([apiFetch("/accounts/"), apiFetch("/reports/dashboard/")]);
  const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/token/refresh/"));
  expect(refreshCalls).toHaveLength(1);
});

test("a rotated refresh token is stored", async () => {
  tokenStore.set("A1", "R1");
  fetchMock
    .mockResolvedValueOnce(json(401))
    .mockResolvedValueOnce(json(200, { access: "A2", refresh: "R2" }))
    .mockResolvedValueOnce(json(200, {}));
  await apiFetch("/me/");
  expect(tokenStore.get()).toEqual({ access: "A2", refresh: "R2" });
});
