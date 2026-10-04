# Soplate Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SPA en React que consume la API de Soplate: login, dashboard de balance general, cuentas y movimientos, deudores, préstamos (con vista previa del cronograma, detalle y pagos) y proyección de saldo.

**Architecture:** Vite + React + TypeScript. Una capa `api/` (cliente `fetch` con JWT y tipos que reflejan exactamente las respuestas del backend), una carpeta por funcionalidad en `features/` (cada una con su `api.ts` de hooks TanStack Query y sus páginas/formularios), y componentes compartidos mínimos en `components/`. El servidor es la única fuente de verdad: el frontend no recalcula saldos ni estados, solo los muestra; después de cada mutación invalida las queries afectadas.

**Tech Stack:** Node 20+, Vite 7, React 19, TypeScript 5, react-router 7, @tanstack/react-query 5, Tailwind CSS 4 (`@tailwindcss/vite`), Vitest 3 + @testing-library/react + @testing-library/user-event + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-03-soplate-design.md` · **Depende de:** `docs/superpowers/plans/2026-10-03-soplate-backend.md` (formas exactas de la API en las secciones *Interfaces* de sus Tasks 2, 5 y 6).

## Global Constraints

- Todo el frontend en `frontend/`; comandos desde `frontend/`.
- La URL base de la API sale de `import.meta.env.VITE_API_URL` con valor por defecto `http://localhost:8000/api`, definida solo en `src/config.ts`.
- Moneda y locale solo en `src/config.ts`: `LOCALE = "es-CO"`, `CURRENCY = "COP"`.
- Los montos llegan como strings decimales y se envían como strings; nunca se hace aritmética de dinero en el frontend (solo formato).
- Textos de la interfaz en español. Etiquetas de estado: `ACTIVE` "Al día", `OVERDUE` "Retrasado", `DEFAULTED` "Vencido", `PAID` "Pagado"; cuotas: `PENDING` "Pendiente", `PARTIAL` "Parcial", `OVERDUE` "Vencida", `PAID` "Pagada".
- Los errores 400 del backend (`{"detail": ...}` o `{campo: [mensajes]}`) se muestran junto al formulario, sin perder lo que el usuario escribió.
- Los tokens JWT se guardan en `localStorage` (`soplate.access`, `soplate.refresh`), con acceso envuelto en try/catch.
- Los tests nunca llaman a la red: mockean `src/api/client.ts` con `vi.mock`.
- Al trabajar en cualquier task con UI, cargar la skill `frontend-design:frontend-design`; la dirección visual (tokens de color, tipografía, layout) se decide en Task 1 y las demás tasks la reutilizan.

## Review Focus

1. **Token expirado a mitad de sesión:** una respuesta 401 dispara un único refresh y reintenta; si el refresh falla, se cierra la sesión y se va a `/login` (test en Task 1).
2. **Error de negocio al crear préstamo/pago (saldo insuficiente, pago excesivo):** se muestra el `detail` del backend y el formulario conserva sus valores (tests en Task 4).
3. **Listas vacías** (usuario nuevo sin cuentas ni préstamos): cada página muestra un estado vacío con la acción para crear el primero, no una tabla vacía ni un crash (tests en Tasks 2 y 3).
4. **Formato de montos con centavos:** `"33.33"` se muestra `$ 33,33`, y `"1200000.00"` como `$ 1.200.000` (test en Task 1).
5. **Préstamo sin cuentas o sin deudores creados:** el formulario de préstamo explica que primero hay que crear una cuenta/deudor y enlaza a esa página (test en Task 4).

---

### Task 1: Scaffold, cliente API, formato, autenticación y layout

**Files:**
- Create: `frontend/` (via `npm create vite@latest frontend -- --template react-ts`), `frontend/vite.config.ts` (plugins react + tailwind; `test: { environment: "jsdom", setupFiles: "src/test/setup.ts", globals: true }`)
- Create: `src/config.ts`, `src/api/client.ts`, `src/api/types.ts`, `src/lib/format.ts`, `src/lib/status.ts`
- Create: `src/auth/AuthContext.tsx`, `src/auth/LoginPage.tsx`, `src/auth/RequireAuth.tsx`
- Create: `src/components/Layout.tsx` (navegación: Dashboard, Cuentas, Deudores, Préstamos, Proyección, Salir), `src/components/StatusBadge.tsx`, `src/components/ErrorMessage.tsx`, `src/components/EmptyState.tsx`
- Create: `src/App.tsx` (rutas), `src/main.tsx` (QueryClientProvider + BrowserRouter + AuthProvider), `src/index.css`
- Create: `src/test/setup.ts` (`@testing-library/jest-dom/vitest`), `src/test/render.tsx`
- Test: `src/lib/format.test.ts`, `src/api/client.test.ts`, `src/auth/LoginPage.test.tsx`

**Interfaces:**
- Produces:
  - `config.ts`: `API_URL: string`, `LOCALE`, `CURRENCY`.
  - `api/client.ts`:
    - `class ApiError extends Error { status: number; data: unknown }` — `message` = `data.detail` si existe, si no `"Error inesperado"`.
    - `tokenStore: { get(): {access: string|null, refresh: string|null}; set(access: string, refresh?: string): void; clear(): void }`
    - `apiFetch<T>(path: string, options?: { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined> }): Promise<T>` — JSON, header `Authorization: Bearer`, omite query params `undefined`, ante 401 hace un solo `POST /auth/token/refresh/` y reintenta; si falla, `tokenStore.clear()` y dispara `window.dispatchEvent(new Event("soplate:logout"))`; respuestas no-2xx lanzan `ApiError`; 204 → `undefined`.
    - `login(username: string, password: string): Promise<void>` — llama a `POST /auth/token/` con `fetch` directo (sin la lógica de refresh) y guarda ambos tokens; ante 401 lanza `ApiError` con mensaje `"Usuario o contraseña incorrectos"`.
  - `api/types.ts` — tipos TS con los nombres de campo exactos del plan backend: `Money = string`, `ISODate = string`, `Account`, `Transaction`, `TransactionKind`, `Borrower`, `LoanStatus`, `InstallmentStatus`, `Frequency`, `InterestMode`, `LoanListItem`, `LoanDetail`, `InstallmentRow`, `PaymentRow`, `LoanPreview`, `Dashboard`, `Projection`, más los inputs `AccountInput`, `TransactionInput`, `TransferInput`, `BorrowerInput`, `LoanInput`, `LoanPreviewInput`, `PaymentInput`.
  - `lib/format.ts`: `formatMoney(value: Money | number): string` (Intl `es-CO`, `COP`, `minimumFractionDigits: 0`, `maximumFractionDigits: 2`), `formatDate(iso: ISODate): string` (`"28 feb 2026"`, sin desfase de zona horaria: parsear `YYYY-MM-DD` como fecha local), `todayISO(): ISODate`.
  - `lib/status.ts`: `LOAN_STATUS: Record<LoanStatus, {label: string; tone: "green" | "amber" | "red" | "gray"}>` (ACTIVE green, OVERDUE amber, DEFAULTED red, PAID gray), `INSTALLMENT_STATUS` análogo, `FREQUENCY_LABEL`, `ACCOUNT_KIND_LABEL`, `TRANSACTION_KIND_LABEL`.
  - `components/StatusBadge.tsx`: `<StatusBadge status={LoanStatus | InstallmentStatus} kind="loan" | "installment" />`.
  - `components/ErrorMessage.tsx`: `<ErrorMessage error={unknown} />` — muestra `ApiError.message` y los errores por campo.
  - `components/EmptyState.tsx`: `<EmptyState title: string; action?: ReactNode />`.
  - `auth/AuthContext.tsx`: `useAuth(): { isAuthenticated: boolean; login(u, p): Promise<void>; logout(): void }` — escucha `soplate:logout`.
  - `test/render.tsx`: `renderWithProviders(ui, { route?: string })` con QueryClient (retry: false) + MemoryRouter + AuthProvider.
  - Rutas: `/login`, y bajo `RequireAuth` + `Layout`: `/` (dashboard), `/accounts`, `/accounts/:id`, `/borrowers`, `/loans`, `/loans/new`, `/loans/:id`, `/projection`. Las páginas aún no creadas son placeholders con su título.

- [ ] **Step 1: Crear proyecto e instalar dependencias**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm i react-router @tanstack/react-query
npm i -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Agregar script `"test": "vitest"` en `package.json`.

- [ ] **Step 2: Escribir tests que fallan**

```ts
// lib/format.test.ts
const n = (s: string) => s.replace(/\s/g, " ");
test("formatMoney", () => {
  expect(n(formatMoney("1200000.00"))).toBe("$ 1.200.000");
  expect(n(formatMoney("33.33"))).toBe("$ 33,33");
});
test("formatDate keeps the calendar day", () => {
  expect(formatDate("2026-02-28")).toMatch(/28/);
});

// api/client.test.ts  (mockear global fetch con vi.fn)
test("sends bearer token", ...)                     // header Authorization: "Bearer A1"
test("refreshes once on 401 and retries", ...)      // fetch: 401, refresh 200 {access:"A2"}, retry 200 → resuelve; 3 llamadas; tokenStore.get().access === "A2"
test("logs out when refresh fails", ...)            // 401, refresh 401 → rechaza con ApiError; tokenStore vacío; evento "soplate:logout" emitido
test("ApiError carries backend detail", ...)        // 400 {detail:"Saldo insuficiente en la cuenta"} → error.message igual

// auth/LoginPage.test.tsx (vi.mock("../api/client"))
test("submits credentials and goes to dashboard", ...)  // escribe usuario/clave, click "Ingresar" → login llamado con ("ana","clave"); se ve "Dashboard"
test("shows error on bad credentials", ...)             // login rechaza ApiError("Usuario o contraseña incorrectos") → texto visible
```

- [ ] **Step 3: Verificar que fallan** — `npm test -- --run` → FAIL.
- [ ] **Step 4: Implementar** los archivos de la lista; cargar `frontend-design:frontend-design` y fijar los tokens visuales en `index.css` (`@theme` de Tailwind) antes de maquetar `Layout` y `LoginPage`.
- [ ] **Step 5: Verificar** — `npm test -- --run` → PASS; `npm run build` → sin errores de tipos; con el backend corriendo, `npm run dev` permite entrar con un usuario creado vía `python manage.py createsuperuser`.
- [ ] **Step 6: Commit** — `git add frontend && git commit -m "feat(frontend): scaffold, api client, auth and layout"`.

---

### Task 2: Cuentas, movimientos y transferencias

**Files:**
- Create: `src/features/accounts/{api.ts, AccountsPage.tsx, AccountForm.tsx, TransactionForm.tsx, TransferForm.tsx, AccountDetailPage.tsx}`
- Modify: `src/App.tsx`
- Test: `src/features/accounts/AccountsPage.test.tsx`, `src/features/accounts/TransferForm.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, tipos, `formatMoney`, `ACCOUNT_KIND_LABEL`, `TRANSACTION_KIND_LABEL`, `ErrorMessage`, `EmptyState`, `renderWithProviders`.
- Produces (`features/accounts/api.ts`):
  - `useAccounts(): UseQueryResult<Account[]>` (key `["accounts"]`)
  - `useAccount(id: number)` (key `["accounts", id]`)
  - `useTransactions(filters: { account?: number; kind?: string; date_from?: string; date_to?: string })` (key `["transactions", filters]`)
  - `useCreateAccount()`, `useUpdateAccount(id)`, `useCreateTransaction()`, `useCreateTransfer()` — al tener éxito invalidan `["accounts"]`, `["transactions"]` y `["dashboard"]`.
- Pantallas: `AccountsPage` (tarjetas por cuenta con saldo, total arriba, botones "Nueva cuenta", "Movimiento", "Transferir"; los formularios se abren en un panel/diálogo), `AccountDetailPage` (saldo + tabla de movimientos con monto en verde/rojo según signo; botón archivar = `PATCH {is_active:false}`). `TransactionForm` ofrece solo DEPOSIT, WITHDRAWAL, INCOME, EXPENSE; fecha por defecto `todayISO()`.

- [ ] **Step 1: Escribir tests que fallan**

```tsx
test("lists accounts with formatted balance and total", ...)
// apiFetch mock → [{id:1,name:"Banco",balance:"1500000.00",...},{id:2,name:"Efectivo",balance:"500000.00",...}]
// expect "Banco", "$ 1.500.000", y total "$ 2.000.000"
test("empty state invites to create first account", ...)   // [] → texto "Aún no tienes cuentas" y botón "Nueva cuenta"
test("transfer form posts strings and shows backend error", ...)
// submit → apiFetch("/transfers/", {method:"POST", body:{from_account:1,to_account:2,amount:"300000",date:<hoy>,description:""}})
// si rechaza ApiError("No puedes transferir a la misma cuenta") → mensaje visible y el campo monto conserva "300000"
```

- [ ] **Step 2: Verificar que fallan** — `npm test -- --run src/features/accounts` → FAIL.
- [ ] **Step 3: Implementar hooks, páginas y formularios.**
- [ ] **Step 4: Verificar** — tests PASS; `npm run build` OK.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): accounts, transactions and transfers"`.

---

### Task 3: Deudores y lista de préstamos

**Files:**
- Create: `src/features/borrowers/{api.ts, BorrowersPage.tsx, BorrowerForm.tsx}`
- Create: `src/features/loans/api.ts`, `src/features/loans/LoansPage.tsx`
- Modify: `src/App.tsx`
- Test: `src/features/borrowers/BorrowersPage.test.tsx`, `src/features/loans/LoansPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 y 2 (`useAccounts`).
- Produces:
  - `features/borrowers/api.ts`: `useBorrowers()` (key `["borrowers"]`), `useCreateBorrower()`, `useUpdateBorrower(id)`, `useDeleteBorrower()`.
  - `features/loans/api.ts`: `useLoans(filters: { status?: LoanStatus; borrower?: number })` (key `["loans", filters]`), `useLoan(id: number)` (key `["loans", id]`), `usePreviewLoan()` (mutation → `LoanPreview`), `useCreateLoan()`, `useCreatePayment(loanId: number)`, `useUpdateLoanNotes(loanId)`. Mutaciones de préstamo/pago invalidan `["loans"]`, `["accounts"]`, `["transactions"]`, `["dashboard"]`, `["projection"]`.
- Pantallas: `BorrowersPage` (tabla + formulario; al borrar uno con préstamos muestra el `detail` del 400). `LoansPage`: pestañas de filtro Todos / Al día / Retrasado / Vencido / Pagado (actualizan `?status=` en la URL), tabla con deudor, cuota, fin esperado, pagado/total con barra de progreso, pendiente, `StatusBadge` y días de atraso; clic en una fila → `/loans/:id`; botón "Nuevo préstamo" → `/loans/new`.

- [ ] **Step 1: Escribir tests que fallan**

```tsx
test("loans list shows status badge and overdue days", ...)
// mock [{id:7, borrower_name:"Luis", status:"OVERDUE", days_overdue:5, installment_amount:"400000.00", outstanding:"800000.00", ...}]
// expect "Luis", "Retrasado", "5 días", "$ 400.000"
test("status tab filters via query", ...)   // click "Pagado" → apiFetch llamado con query {status:"PAID"}
test("empty loans state", ...)              // [] → "Aún no tienes préstamos" + enlace "Nuevo préstamo"
test("borrower delete error is shown", ...) // useDeleteBorrower rechaza ApiError("No se puede eliminar…") → texto visible
```

- [ ] **Step 2: Verificar que fallan.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** — tests PASS; build OK.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): borrowers and loans list"`.

---

### Task 4: Crear préstamo con vista previa, detalle y pagos

**Files:**
- Create: `src/features/loans/{LoanForm.tsx, LoanDetailPage.tsx, PaymentForm.tsx, SchedulePreview.tsx}`
- Modify: `src/App.tsx`
- Test: `src/features/loans/LoanForm.test.tsx`, `src/features/loans/LoanDetailPage.test.tsx`

**Interfaces:**
- Consumes: `usePreviewLoan`, `useCreateLoan`, `useLoan`, `useCreatePayment`, `useBorrowers`, `useAccounts`.
- Produces:
  - `LoanForm`: campos deudor, cuenta (muestra su saldo), capital, tasa %, modo de interés (radio "Una sola vez sobre el capital" = TOTAL / "Por cada cuota" = PER_PERIOD), número de cuotas, frecuencia, fecha de inicio (hoy por defecto), notas. Cuando capital, tasa, cuotas, frecuencia e inicio son válidos, pide `usePreviewLoan` (debounce 400 ms) y muestra `SchedulePreview` (cuota, interés total, total a pagar, fecha de fin, tabla de cuotas). "Crear préstamo" → `useCreateLoan` → navega a `/loans/:id`. Si no hay cuentas o deudores, muestra un aviso con enlace a `/accounts` o `/borrowers` en lugar del formulario.
  - `LoanDetailPage`: encabezado (deudor, `StatusBadge`, días de atraso), tarjetas (capital, interés, total, pagado, pendiente, capital pendiente, cuota, inicio, fin esperado, próxima cuota), barra de progreso, tabla de cuotas (n.º, fecha, valor, pagado, falta, estado), historial de pagos, notas editables y `PaymentForm`.
  - `PaymentForm`: monto (botón "Cuota" que rellena el `remaining` de la próxima cuota no pagada y botón "Total" que rellena `outstanding`), fecha (hoy), cuenta (por defecto la del préstamo), nota. Oculto si el estado es `PAID`.

- [ ] **Step 1: Escribir tests que fallan**

```tsx
test("shows schedule preview before creating", ...)
// llenar capital 1000000, tasa 20, cuotas 3, mensual, inicio 2026-01-31
// preview mock → {installment_amount:"400000.00", total_amount:"1200000.00", end_date:"2026-04-30", interest_total:"200000.00", installments:[...3]}
// expect "$ 400.000", "$ 1.200.000", 3 filas de cuotas
test("create loan error keeps values", ...)
// create rechaza ApiError("Saldo insuficiente en la cuenta") → mensaje visible; input capital sigue "1000000"
test("asks to create an account first", ...)   // useAccounts → [] → texto "Primero crea una cuenta" con link a /accounts
test("detail renders installments and pays next installment", ...)
// mock LoanDetail con 3 cuotas (1 PAID, 2 PENDING remaining "400000.00"); click "Cuota" → monto "400000.00";
// submit → apiFetch("/loans/7/payments/", {method:"POST", body:{amount:"400000.00", date:<hoy>, account:1, note:""}})
test("payment form hidden when loan is paid", ...)
```

- [ ] **Step 2: Verificar que fallan.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** — tests PASS; build OK; prueba manual con el backend: crear préstamo, ver cuotas, registrar un pago parcial y ver la cuota en "Parcial" y el saldo de la cuenta subir.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): loan creation with preview, detail and payments"`.

---

### Task 5: Dashboard y proyección

**Files:**
- Create: `src/features/dashboard/{api.ts, DashboardPage.tsx}`, `src/features/projection/{api.ts, ProjectionPage.tsx}`
- Modify: `src/App.tsx`
- Test: `src/features/dashboard/DashboardPage.test.tsx`, `src/features/projection/ProjectionPage.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, tipos `Dashboard` y `Projection`, `formatMoney`, `formatDate`, `StatusBadge`.
- Produces:
  - `useDashboard()` (key `["dashboard"]`, `GET /reports/dashboard/`).
  - `useProjection(date: ISODate, includeOverdue: boolean)` (key `["projection", date, includeOverdue]`, `GET /reports/projection/`, `enabled` solo con fecha).
  - `DashboardPage`: tarjetas Disponible (`total_balance`), Por cobrar (`outstanding_total`), Intereses ganados (`interest_earned`), Patrimonio (`net_worth`); saldos por cuenta; conteo de préstamos por estado (cada uno enlaza a `/loans?status=X`); listas "Próximas cuotas (7 días)" y "Cuotas vencidas" con enlace al préstamo.
  - `ProjectionPage`: selector de fecha (mínimo hoy; por defecto hoy + 30 días), casilla "Incluir cuotas vencidas", resultado: saldo actual, entradas esperadas, vencido (aparte), saldo proyectado, y tabla por cuenta.

- [ ] **Step 1: Escribir tests que fallan**

```tsx
test("dashboard shows the four headline numbers", ...)
// mock {total_balance:"600000.00", outstanding_total:"600000.00", interest_earned:"100000.00", net_worth:"1200000.00", loans_by_status:{ACTIVE:1,OVERDUE:0,DEFAULTED:0,PAID:0}, accounts:[], upcoming:[], overdue:[]}
// expect "$ 600.000" (x2), "$ 100.000", "$ 1.200.000"
test("status counts link to filtered loans", ...)   // enlace "Al día" con href "/loans?status=ACTIVE"
test("projection requests chosen date and toggles overdue", ...)
// cambiar fecha a 2026-12-31 → apiFetch llamado con query {date:"2026-12-31", include_overdue:false}
// marcar casilla → query con include_overdue:true; se ve projected_balance formateado
```

- [ ] **Step 2: Verificar que fallan.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Verificar** — `npm test -- --run` todo PASS; `npm run build` OK; recorrido manual completo con backend: login → crear cuenta → deudor → préstamo → pago → dashboard y proyección reflejan los cambios.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): dashboard and projection"`.
