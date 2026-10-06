# Soplate Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API REST en Django que lleva cuentas (libro contable), deudores, préstamos con cronograma de cuotas, pagos FIFO, estados derivados, balance general y proyección de saldo.

**Architecture:** Tres apps de Django con responsabilidades separadas: `ledger` (cuentas y movimientos), `loans` (deudores, préstamos, cuotas, pagos) y `reports` (dashboard y proyección, solo lectura). La lógica de cálculo de préstamos vive en funciones puras (`loans/domain.py`) sin base de datos, para probarla aislada; las operaciones que escriben varias tablas viven en `services.py` dentro de `transaction.atomic()`. Las vistas DRF solo validan entrada, llaman servicios y serializan.

**Tech Stack:** Python 3.10+, Django 5.2 LTS, djangorestframework 3.16, djangorestframework-simplejwt 5.5, django-cors-headers 4, python-dateutil 2.9, pytest 8 + pytest-django 4.

**Spec:** `docs/superpowers/specs/2026-10-03-soplate-design.md`

## Global Constraints

- Todo el backend en `backend/`; comandos se ejecutan desde `backend/` con el virtualenv `backend/.venv` activo.
- Montos: `DecimalField(max_digits=14, decimal_places=2)`; nunca `float`. Redondeo `ROUND_HALF_UP` a `Decimal("0.01")` mediante `core.money.q2`.
- La API serializa montos como strings con 2 decimales (`"1200000.00"`), también en respuestas que no usan serializers de modelo.
- Todo modelo principal tiene `owner = ForeignKey(settings.AUTH_USER_MODEL, on_delete=CASCADE)`; toda vista filtra por `request.user` → objetos ajenos responden 404.
- FKs hacia `Account`, `Borrower` y `Loan` usan `on_delete=PROTECT`; un `ProtectedError` se responde como 400 `{"detail": "..."}`.
- Errores de negocio: lanzar `core.exceptions.BusinessError(mensaje)` → 400 `{"detail": mensaje}`. Mensajes en español.
- `TIME_ZONE = "America/Bogota"`, `LANGUAGE_CODE = "es-co"`. "Hoy" = `django.utils.timezone.localdate()`, solo en vistas; servicios y dominio reciben `today: date` como parámetro.
- Autenticación JWT (`Authorization: Bearer`), `IsAuthenticated` por defecto, sin paginación.
- CORS permitido para `http://localhost:5173`.
- Nombres de estado exactos: préstamo `ACTIVE | OVERDUE | DEFAULTED | PAID`; cuota `PENDING | PARTIAL | OVERDUE | PAID`.



## Review Focus

1. **Redondeo:** 100 en 3 cuotas → 33.33, 33.33, 33.34; la suma de cuotas debe ser exactamente el total (test en Task 3).
2. **Día 31 con frecuencia mensual:** inicio 31-ene → cuotas 28-feb, 31-mar, 30-abr (calcular siempre desde `start_date`, no encadenar) (test en Task 3).
3. **Pago mayor al saldo pendiente o préstamo mayor al saldo de la cuenta:** 400 con mensaje, nada se guarda (tests en Task 5).
4. **Aislamiento entre usuarios:** el usuario B recibe 404 al pedir la cuenta/préstamo de A y no puede usar la cuenta de A al crear un préstamo (tests en Tasks 2 y 6).
5. **Borrar una cuenta con movimientos:** 400 legible, no 500 (test en Task 2).

---



### Task 1: Proyecto Django, configuración, auth JWT

**Files:**

- Create: `.gitignore` (raíz: `.venv/`, `__pycache__/`, `*.sqlite3`, `node_modules/`, `dist/`, `.env`)
- Create: `backend/requirements.txt`, `backend/manage.py`, `backend/pytest.ini`, `backend/conftest.py`
- Create: `backend/config/{__init__,settings,urls,wsgi}.py`
- Create: `backend/core/{__init__,apps,money,exceptions,views}.py`
- Test: `backend/core/tests/test_auth.py`, `backend/core/tests/test_money.py`

**Interfaces:**

- Produces:
  - `core.money.q2(value: Decimal | int | str) -> Decimal` — cuantiza a 2 decimales, `ROUND_HALF_UP`.
  - `core.money.money_str(value: Decimal) -> str` — `str(q2(value))`.
  - `core.exceptions.BusinessError(Exception)` y `core.exceptions.api_exception_handler` (configurado en `REST_FRAMEWORK["EXCEPTION_HANDLER"]`): convierte `BusinessError` y `django.db.models.ProtectedError` en 400 `{"detail": str}`; delega el resto al handler de DRF.
  - `core.views.OwnedQuerysetMixin` — `get_queryset()` filtra `self.queryset` por `owner=self.request.user`; `perform_create` guarda `owner=self.request.user`.
  - Fixtures en `backend/conftest.py`: `user`, `other_user` (via `django_user_model.objects.create_user`), `api` (APIClient con `force_authenticate(user)`), `other_api`.
  - URLs: `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `GET /api/me/` → `{"id", "username", "email"}`.

- [x] **Step 1: Inicializar repo y entorno**

```bash
git init
python -m venv backend/.venv
backend/.venv/Scripts/activate        # Windows (Git Bash: source backend/.venv/Scripts/activate)
pip install "Django>=5.2,<5.3" "djangorestframework>=3.16,<3.17" "djangorestframework-simplejwt>=5.5,<6" "django-cors-headers>=4,<5" "python-dateutil>=2.9,<3" "pytest>=8,<9" "pytest-django>=4.9,<5"
pip freeze > backend/requirements.txt
cd backend && django-admin startproject config .
```

`pytest.ini`: `DJANGO_SETTINGS_MODULE = config.settings`, `python_files = test_*.py`.
Settings: apps `rest_framework`, `rest_framework_simplejwt`, `corsheaders`, `core` (más `ledger`, `loans`, `reports` cuando existan); valores de Global Constraints; `SIMPLE_JWT = {"ACCESS_TOKEN_LIFETIME": timedelta(hours=8), "REFRESH_TOKEN_LIFETIME": timedelta(days=7)}`.

- [x] **Step 2: Escribir tests que fallan**

```python
# core/tests/test_money.py
def test_q2_rounds_half_up():
    assert q2(Decimal("66666.665")) == Decimal("66666.67")
    assert q2(10) == Decimal("10.00")
    assert money_str(Decimal("5")) == "5.00"

# core/tests/test_auth.py
def test_token_login_and_me(client, django_user_model):
    django_user_model.objects.create_user("ana", password="clave-segura-1")
    r = client.post("/api/auth/token/", {"username": "ana", "password": "clave-segura-1"})
    assert r.status_code == 200 and "access" in r.json()
    me = client.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
    assert me.json()["username"] == "ana"

def test_me_requires_auth(client):
    assert client.get("/api/me/").status_code == 401
```

- [ ] **Step 3: Correr y verificar que fallan** — `pytest core -v` → FAIL (import/404).
- [ ] **Step 4: Implementar** `core/money.py`, `core/exceptions.py`, `core/views.py` (incluye `me` como `@api_view(["GET"])`), rutas en `config/urls.py`.
- [ ] **Step 5: Verificar** — `pytest core -v` → PASS; `python manage.py check` → sin problemas.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: scaffold django project with jwt auth"` (incluye `docs/`).

---



### Task 2: Ledger — cuentas, movimientos y transferencias

**Files:**

- Create: `backend/ledger/{__init__,apps,models,services,serializers,views,urls,admin}.py`
- Modify: `backend/config/settings.py` (INSTALLED_APPS), `backend/config/urls.py` (`path("api/", include("ledger.urls"))`)
- Test: `backend/ledger/tests/test_services.py`, `backend/ledger/tests/test_api.py`

**Interfaces:**

- Consumes: `q2`, `BusinessError`, `OwnedQuerysetMixin`, fixtures `user/other_user/api/other_api`.
- Produces:
  - `ledger.models.Account(owner, name: CharField(100), kind: CharField choices BANK|CASH|WALLET|OTHER, initial_balance: Decimal default 0, is_active: bool default True, created_at)`; `Account.objects.with_balance()` → queryset anotado con `balance = initial_balance + Coalesce(Sum("transactions__amount"), 0)`.
  - `ledger.models.Transaction(owner, account: FK Account PROTECT related_name="transactions", kind: CharField choices DEPOSIT|WITHDRAWAL|INCOME|EXPENSE|TRANSFER_IN|TRANSFER_OUT|LOAN_DISBURSEMENT|LOAN_PAYMENT, amount: Decimal con signo, date: DateField, description: CharField(255) blank, transfer_group: UUIDField null, created_at)`; `Meta.ordering = ["-date", "-id"]`. El FK `loan` **no** se crea aquí: lo agrega Task 4 con una migración nueva de `ledger`.
  - `ledger.models.SIGNS: dict[str, int]` — `+1` para DEPOSIT, INCOME, TRANSFER_IN, LOAN_PAYMENT; `-1` para el resto.
  - `ledger.services.account_balance(account: Account) -> Decimal`
  - `ledger.services.record_transaction(*, owner, account: Account, kind: str, amount: Decimal, date: date, description: str = "", transfer_group=None) -> Transaction` — recibe `amount > 0`, guarda `q2(amount) * SIGNS[kind]`; lanza `BusinessError` si la cuenta es de otro owner o si `kind` resta y `amount > account_balance(account)`.
  - `ledger.services.transfer(*, owner, from_account: Account, to_account: Account, amount: Decimal, date: date, description: str = "") -> tuple[Transaction, Transaction]` — atómico, mismo `uuid4()` en ambas; `BusinessError("No puedes transferir a la misma cuenta")` si son iguales.
  - Endpoints (formas exactas, consumidas por el frontend):
    - `GET/POST /api/accounts/`, `GET/PATCH/DELETE /api/accounts/{id}/` → `{id, name, kind, initial_balance, is_active, balance, created_at}` (`balance` read-only; `initial_balance` editable solo al crear).
    - `GET /api/transactions/?account=&kind=&date_from=&date_to=` → `[{id, account, account_name, kind, amount, date, description, transfer_group, created_at}]` (Task 4 añade `loan`).
    - `POST /api/transactions/` body `{account, kind, amount, date, description}`; `kind` ∈ {DEPOSIT, WITHDRAWAL, INCOME, EXPENSE} (otro → 400); `amount ≥ 0.01`.
    - `POST /api/transfers/` body `{from_account, to_account, amount, date, description}` → 201 `{"outgoing": Transaction, "incoming": Transaction}`.
  - Las cuentas referenciadas en bodies se validan con queryset `Account.objects.filter(owner=request.user)` (cuenta ajena → 400 "objeto no existe").

- [ ] **Step 1: Escribir tests de servicios que fallan**

```python
# ledger/tests/test_services.py  (pytest.mark.django_db)
def test_balance_is_initial_plus_signed_transactions(user):
    acc = Account.objects.create(owner=user, name="Banco", kind="BANK", initial_balance=Decimal("1000"))
    record_transaction(owner=user, account=acc, kind="DEPOSIT", amount=Decimal("500"), date=date(2026, 1, 1))
    record_transaction(owner=user, account=acc, kind="EXPENSE", amount=Decimal("200"), date=date(2026, 1, 2))
    assert account_balance(acc) == Decimal("1300.00")
    assert Account.objects.with_balance().get(pk=acc.pk).balance == Decimal("1300.00")
    assert Transaction.objects.get(kind="EXPENSE").amount == Decimal("-200.00")

def test_cannot_withdraw_more_than_balance(user):  # BusinessError, sin transacción guardada
def test_transfer_creates_two_linked_legs(user):
    # 1000 en A → transfer 300 a B: saldos 700 / 300, mismo transfer_group, kinds TRANSFER_OUT / TRANSFER_IN
def test_transfer_insufficient_funds_saves_nothing(user):  # Transaction.objects.count() == 0
```

- [ ] **Step 2: Escribir tests de API que fallan**

```python
# ledger/tests/test_api.py
def test_create_and_list_accounts_with_balance(api):
    r = api.post("/api/accounts/", {"name": "Efectivo", "kind": "CASH", "initial_balance": "250000.00"}, format="json")
    assert r.status_code == 201
    assert api.get("/api/accounts/").json()[0]["balance"] == "250000.00"

def test_manual_transaction_rejects_system_kinds(api, account):  # kind LOAN_PAYMENT → 400
def test_transfer_endpoint(api, user):  # 201, saldos actualizados en GET /api/accounts/
def test_other_user_gets_404_on_account(api, other_api, user):
    acc_id = api.post("/api/accounts/", {"name": "Mía", "kind": "BANK"}, format="json").json()["id"]
    assert other_api.get(f"/api/accounts/{acc_id}/").status_code == 404
def test_delete_account_with_transactions_returns_400(api, user):
    # crear cuenta + DEPOSIT → DELETE → 400 y "detail" en el json; la cuenta sigue existiendo
```

(Agregar fixture `account` en `ledger/tests/conftest.py`: cuenta del `user` con `initial_balance=Decimal("1000000")`.)

- [ ] **Step 3: Verificar que fallan** — `pytest ledger -v` → FAIL.
- [ ] **Step 4: Implementar modelos, migración, servicios, serializers,** `AccountViewSet(OwnedQuerysetMixin, ModelViewSet)`**,** `TransactionViewSet` **(list/create), vista** `transfer`**, admin.**
- [ ] **Step 5: Verificar** — `pytest -v` → PASS.
- [ ] **Step 6: Commit** — `git commit -am "feat(ledger): accounts, transactions and transfers"` (añadir archivos nuevos con `git add backend/ledger`).

---



### Task 3: Dominio de préstamos (funciones puras)

**Files:**

- Create: `backend/loans/{__init__,apps,domain}.py`
- Test: `backend/loans/tests/test_domain.py` (sin `django_db`)

**Interfaces:**

- Consumes: `core.money.q2`.
- Produces (en `loans/domain.py`):
  - Constantes/choices: `Frequency` (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`), `InterestMode` (`TOTAL`, `PER_PERIOD`), `LoanStatus` (`ACTIVE`, `OVERDUE`, `DEFAULTED`, `PAID`), `InstallmentStatus` (`PENDING`, `PARTIAL`, `OVERDUE`, `PAID`) como `models.TextChoices` con etiquetas en español.
  - `add_periods(start: date, frequency: str, k: int) -> date` — DAILY `+k días`, WEEKLY `+7k días`, BIWEEKLY `+15k días`, MONTHLY `start + relativedelta(months=k)`.
  - `@dataclass(frozen=True) ScheduledInstallment(number: int, due_date: date, principal_amount: Decimal, interest_amount: Decimal, amount: Decimal)`
  - `interest_total(principal: Decimal, interest_rate: Decimal, interest_mode: str, installments_count: int) -> Decimal`
  - `build_schedule(principal: Decimal, interest_rate: Decimal, interest_mode: str, installments_count: int, frequency: str, start_date: date) -> list[ScheduledInstallment]` — capital e interés por cuota = `q2(total_parte / n)`; la última cuota recibe `total_parte − suma de las anteriores`; `amount = principal_amount + interest_amount`.
  - `@dataclass(frozen=True) InstallmentState(number: int, due_date: date, amount: Decimal, principal_amount: Decimal, interest_amount: Decimal, paid_amount: Decimal, remaining: Decimal, status: str)`
  - `allocate_payments(installments: Sequence[<objeto con number, due_date, amount, principal_amount, interest_amount>], total_paid: Decimal, today: date) -> list[InstallmentState]` — ordena por `number`, reparte FIFO. Estado: `remaining == 0` → PAID; `due_date < today` → OVERDUE; `paid_amount > 0` → PARTIAL; si no, PENDING.
  - `loan_status(states: list[InstallmentState], today: date) -> str` — reglas de la spec §2.3 en orden (PAID, DEFAULTED si `today > states[-1].due_date`, OVERDUE, ACTIVE).
  - `days_overdue(states: list[InstallmentState], today: date) -> int` — días desde la cuota OVERDUE más antigua; 0 si no hay.

- [ ] **Step 1: Escribir tests que fallan**

```python
def test_total_mode_monthly_from_jan_31():
    s = build_schedule(Decimal("1000000"), Decimal("20"), "TOTAL", 3, "MONTHLY", date(2026, 1, 31))
    assert [i.due_date for i in s] == [date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]
    assert [i.principal_amount for i in s] == [Decimal("333333.33"), Decimal("333333.33"), Decimal("333333.34")]
    assert [i.interest_amount for i in s] == [Decimal("66666.67"), Decimal("66666.67"), Decimal("66666.66")]
    assert all(i.amount == Decimal("400000.00") for i in s)

def test_rounding_last_installment_absorbs_difference():
    s = build_schedule(Decimal("100"), Decimal("0"), "TOTAL", 3, "DAILY", date(2026, 1, 1))
    assert [i.amount for i in s] == [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]
    assert [i.due_date for i in s] == [date(2026, 1, 2), date(2026, 1, 3), date(2026, 1, 4)]

def test_per_period_interest():
    s = build_schedule(Decimal("1000000"), Decimal("10"), "PER_PERIOD", 6, "MONTHLY", date(2026, 1, 1))
    assert sum(i.interest_amount for i in s) == Decimal("600000.00")
    assert sum(i.amount for i in s) == Decimal("1600000.00")
    assert s[0].amount == Decimal("266666.67") and s[-1].amount == Decimal("266666.65")

def test_weekly_and_biweekly_dates():
    assert add_periods(date(2026, 1, 1), "WEEKLY", 1) == date(2026, 1, 8)
    assert add_periods(date(2026, 1, 1), "BIWEEKLY", 2) == date(2026, 1, 31)

# fixture: tres cuotas de 100 con vencimiento 2026-01-10, 01-20, 01-30
def test_allocate_fifo_partial():
    st = allocate_payments(three, Decimal("150"), today=date(2026, 1, 15))
    assert [(x.paid_amount, x.remaining, x.status) for x in st] == [
        (Decimal("100.00"), Decimal("0.00"), "PAID"),
        (Decimal("50.00"), Decimal("50.00"), "PARTIAL"),
        (Decimal("0.00"), Decimal("100.00"), "PENDING")]

def test_partial_becomes_overdue_after_due_date():  # today 2026-01-25 → st[1].status == "OVERDUE"

@pytest.mark.parametrize("paid,today,expected", [
    ("150", date(2026, 1, 15), "ACTIVE"),
    ("50",  date(2026, 1, 15), "OVERDUE"),
    ("0",   date(2026, 1, 10), "ACTIVE"),     # vence hoy: aún no está retrasada
    ("150", date(2026, 2, 1),  "DEFAULTED"),
    ("300", date(2026, 2, 1),  "PAID"),
])
def test_loan_status(three, paid, today, expected):
    assert loan_status(allocate_payments(three, Decimal(paid), today), today) == expected

def test_days_overdue():  # paid 0, today 2026-01-15 → 5
```

- [ ] **Step 2: Verificar que fallan** — `pytest loans/tests/test_domain.py -v` → FAIL (ImportError).
- [ ] **Step 3: Implementar** `loans/domain.py` (registrar `loans` en INSTALLED_APPS).
- [ ] **Step 4: Verificar** — PASS.
- [ ] **Step 5: Commit** — `git add backend/loans && git commit -m "feat(loans): pure schedule, fifo allocation and status logic"`.

---



### Task 4: Modelos de préstamos y servicios (crear préstamo, registrar pago, resumen)

**Files:**

- Create: `backend/loans/{models,services,admin}.py`, migraciones
- Modify: `backend/ledger/models.py` (agregar `Transaction.loan: FK "loans.Loan" PROTECT null blank related_name="transactions"`), `backend/ledger/services.py` (`record_transaction` gana el parámetro `loan=None`), `backend/ledger/serializers.py` (campo `loan` read-only en la salida)
- Test: `backend/loans/tests/test_services.py`, `backend/loans/tests/conftest.py`

**Interfaces:**

- Consumes: `build_schedule`, `allocate_payments`, `loan_status`, `days_overdue`, `interest_total`, `record_transaction`, `account_balance`, `BusinessError`, `q2`.
- Produces:
  - `Borrower(owner, full_name: CharField(150), document_id: CharField(30) blank, phone: CharField(30) blank, address: CharField(255) blank, notes: TextField blank, created_at)`, ordering `full_name`.
  - `Loan(owner, borrower: FK PROTECT related_name="loans", account: FK Account PROTECT related_name="loans", principal, interest_rate: Decimal(6,2) ≥ 0, interest_mode, installments_count: PositiveIntegerField, frequency, start_date, notes: TextField blank, created_at)`, ordering `-start_date, -id`.
  - `Installment(loan: FK CASCADE related_name="installments", number, due_date, principal_amount, interest_amount, amount)`, `unique_together (loan, number)`, ordering `number`.
  - `Payment(loan: FK PROTECT related_name="payments", account: FK Account PROTECT, transaction: OneToOneField Transaction PROTECT, amount, date, note: CharField(255) blank, created_at)`, ordering `-date, -id`.
  - `@dataclass LoanSummary(interest_total, total_amount, installment_amount, paid_total, outstanding, outstanding_principal, end_date: date, status: str, days_overdue: int, next_due_date: date | None, installments: list[InstallmentState])` — `installment_amount` = monto de la cuota 1; `outstanding_principal` = Σ remaining × (principal_amount / amount) por cuota, `q2`; `next_due_date` = primera cuota no PAID.
  - `services.summarize_loan(loan: Loan, today: date) -> LoanSummary` — usa `loan.installments.all()` y `Sum(payments.amount)` (aprovecha prefetch/annotate `paid_total` si existe en la instancia).
  - `services.create_loan(*, owner, borrower: Borrower, account: Account, principal: Decimal, interest_rate: Decimal, interest_mode: str, installments_count: int, frequency: str, start_date: date, notes: str = "") -> Loan` — atómico: valida owner de borrower y account (`BusinessError`), valida `principal <= account_balance(account)` → si no, `BusinessError("Saldo insuficiente en la cuenta")`; crea Loan, `Installment.objects.bulk_create`, y `record_transaction(kind="LOAN_DISBURSEMENT", amount=principal, date=start_date, loan=loan, description=f"Préstamo a {borrower.full_name}")`.
  - `services.register_payment(*, owner, loan: Loan, amount: Decimal, date: date, account: Account | None = None, note: str = "") -> Payment` — atómico; `account` por defecto `loan.account`; `BusinessError("El pago supera el saldo pendiente")` si `amount > outstanding`; `BusinessError("La fecha del pago es anterior al inicio del préstamo")` si `date < loan.start_date`; crea transacción `LOAN_PAYMENT` y el `Payment`.
  - Fixtures en `loans/tests/conftest.py`: `account` (1.000.000 inicial), `borrower`, `loan_factory(**overrides)` que llama a `create_loan` con defaults `principal=1000000, interest_rate=20, interest_mode="TOTAL", installments_count=3, frequency="MONTHLY", start_date=date(2026,1,31)`.

- [ ] **Step 1: Escribir tests que fallan**

```python
def test_create_loan_generates_schedule_and_disbursement(user, account, loan_factory):
    loan = loan_factory()
    assert loan.installments.count() == 3
    assert account_balance(account) == Decimal("0.00")
    assert Transaction.objects.get(loan=loan).kind == "LOAN_DISBURSEMENT"

def test_create_loan_insufficient_balance_saves_nothing(loan_factory):
    with pytest.raises(BusinessError):
        loan_factory(principal=Decimal("1000000.01"))
    assert Loan.objects.count() == 0 and Transaction.objects.count() == 0

def test_create_loan_with_other_users_account_fails(other_user, account, borrower):  # BusinessError

def test_payment_updates_balance_and_summary(user, account, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("500000"), date=date(2026, 2, 28))
    s = summarize_loan(loan, today=date(2026, 3, 1))
    assert s.paid_total == Decimal("500000.00") and s.outstanding == Decimal("700000.00")
    assert s.status == "ACTIVE" and s.next_due_date == date(2026, 3, 31)
    assert account_balance(account) == Decimal("500000.00")
    assert s.end_date == date(2026, 4, 30) and s.interest_total == Decimal("200000.00")

def test_overpayment_rejected(user, loan_factory):
    loan = loan_factory()
    with pytest.raises(BusinessError, match="supera"):
        register_payment(owner=user, loan=loan, amount=Decimal("1200000.01"), date=date(2026, 2, 1))
    assert Payment.objects.count() == 0

def test_full_payment_marks_paid(user, loan_factory):  # paga 1200000 → status "PAID", outstanding 0
def test_defaulted_after_end_date(user, loan_factory):  # sin pagos, today 2026-05-01 → "DEFAULTED", days_overdue == 62
```

- [ ] **Step 2: Verificar que fallan** — `pytest loans -v` → FAIL.
- [ ] **Step 3: Implementar modelos +** `makemigrations ledger loans` **+ servicios + admin.**
- [ ] **Step 4: Verificar** — `pytest -v` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(loans): models and loan/payment services"`.

---



### Task 5: API de deudores, préstamos y pagos

**Files:**

- Create: `backend/loans/{serializers,views,urls}.py`
- Modify: `backend/config/urls.py`
- Test: `backend/loans/tests/test_api.py`

**Interfaces:**

- Consumes: servicios de Task 4, `OwnedQuerysetMixin`.
- Produces (formas exactas):
  - `GET/POST /api/borrowers/`, `GET/PATCH/DELETE /api/borrowers/{id}/` → `{id, full_name, document_id, phone, address, notes, created_at}`.
  - `POST /api/loans/preview/` body `{principal, interest_rate, interest_mode, installments_count, frequency, start_date}` → 200 `{interest_total, total_amount, installment_amount, end_date, installments: [{number, due_date, principal_amount, interest_amount, amount}]}`.
  - `GET /api/loans/?status=&borrower=` → lista de **LoanListItem** `{id, borrower, borrower_name, account, account_name, principal, interest_rate, interest_mode, installments_count, frequency, start_date, end_date, installment_amount, total_amount, paid_total, outstanding, status, days_overdue, next_due_date}`. El filtro `status` se aplica en Python tras `summarize_loan` (volúmenes de un solo prestamista). Queryset con `select_related("borrower","account")`, `prefetch_related("installments")` y `annotate(paid_total=Coalesce(Sum("payments__amount"), 0))`.
  - `POST /api/loans/` body `{borrower, account, principal, interest_rate, interest_mode, installments_count, frequency, start_date, notes}` → 201 **LoanDetail**.
  - `GET /api/loans/{id}/`, `PATCH` (solo `notes`) → **LoanDetail** = LoanListItem + `{interest_total, outstanding_principal, notes, installments: [{number, due_date, amount, principal_amount, interest_amount, paid_amount, remaining, status}], payments: [{id, amount, date, account, account_name, note}]}`. Sin DELETE (405).
  - `GET /api/loans/{id}/payments/`, `POST` body `{amount, date, account?, note?}` → 201 **LoanDetail** actualizado.
  - Validación de serializers: `principal`, `amount` ≥ `0.01`; `interest_rate` ≥ 0; `installments_count` 1–1000; `borrower`/`account` limitados al owner.

- [ ] **Step 1: Escribir tests que fallan**

```python
def test_preview_does_not_persist(api):
    r = api.post("/api/loans/preview/", {"principal": "1000000", "interest_rate": "20", "interest_mode": "TOTAL",
        "installments_count": 3, "frequency": "MONTHLY", "start_date": "2026-01-31"}, format="json")
    assert r.status_code == 200
    assert r.json()["installment_amount"] == "400000.00" and r.json()["end_date"] == "2026-04-30"
    assert Loan.objects.count() == 0

def test_create_loan_and_detail(api, account, borrower):  # 201; len(installments)==3; status en {"ACTIVE","OVERDUE","DEFAULTED"}
def test_create_loan_insufficient_balance_400(api, account, borrower):  # principal "2000000" → 400, "detail" contiene "Saldo insuficiente"
def test_payment_endpoint_and_overpay(api, account, borrower):
    # crear préstamo vía API; POST payments {"amount":"400000","date":"2026-02-28"} → 201, paid_total "400000.00"
    # POST payments {"amount":"900000","date":"2026-03-01"} → 400
def test_filter_by_status(api, account, borrower):  # préstamo pagado completo → ?status=PAID lo incluye, ?status=ACTIVE no
def test_other_user_cannot_see_or_use(api, other_api, account, borrower):
    # GET /api/loans/{id}/ con other_api → 404; other_api POST /api/loans/ con account de user → 400
def test_delete_borrower_with_loans_400(api, account, borrower):
```

- [ ] **Step 2: Verificar que fallan** — `pytest loans/tests/test_api.py -v` → FAIL.
- [ ] **Step 3: Implementar serializers (entrada separada de salida; la salida se arma desde** `LoanSummary`**),** `BorrowerViewSet`**,** `LoanViewSet` **(list/retrieve/create/partial_update +** `@action preview` **y** `@action payments`**).**
- [ ] **Step 4: Verificar** — `pytest -v` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(loans): borrowers, loans and payments api"`.

---



### Task 6: Reportes — balance general y proyección

**Files:**

- Create: `backend/reports/{__init__,apps,services,views,urls}.py`
- Modify: `backend/config/settings.py`, `backend/config/urls.py`
- Test: `backend/reports/tests/test_reports.py`

**Interfaces:**

- Consumes: `Account.objects.with_balance()`, `summarize_loan`, `money_str`, fixtures de `loans/tests/conftest.py` (mover `account`, `borrower`, `loan_factory` a `backend/conftest.py` para compartirlos).
- Produces:
  - `reports.services.dashboard(owner, today: date) -> dict` →
  `{total_balance, outstanding_total, outstanding_principal, interest_earned, net_worth, accounts: [{id, name, balance}], loans_by_status: {"ACTIVE": int, "OVERDUE": int, "DEFAULTED": int, "PAID": int}, upcoming: [{loan_id, borrower_name, number, due_date, remaining}], overdue: [{loan_id, borrower_name, number, due_date, remaining, days_overdue}]}`.
  Solo cuentas `is_active`. `interest_earned` = Σ por préstamo `q2(paid_total × interest_total / total_amount)`. `upcoming` = cuotas no PAID con `today ≤ due_date ≤ today+7`, ordenadas por fecha. Montos como string (`money_str`), fechas ISO.
  - `reports.services.projection(owner, target_date: date, today: date, include_overdue: bool = False) -> dict` →
  `{date, current_balance, expected_inflows, overdue_amount, projected_balance, by_account: [{id, name, current_balance, expected_inflows, projected_balance}]}` — `expected_inflows` = Σ `remaining` de cuotas no PAID con `today ≤ due_date ≤ target_date`, asignado a `loan.account`; `overdue_amount` = Σ `remaining` de cuotas OVERDUE; se suma a `projected_balance` solo si `include_overdue`. `target_date < today` → `BusinessError("La fecha debe ser hoy o posterior")`.
  - `GET /api/reports/dashboard/`, `GET /api/reports/projection/?date=YYYY-MM-DD&include_overdue=true|false` (sin `date` → 400).

- [ ] **Step 1: Escribir tests que fallan**

```python
def test_dashboard_numbers(user, account, loan_factory):
    loan = loan_factory()                                    # 1.000.000 al 20 %, 3 cuotas de 400.000
    register_payment(owner=user, loan=loan, amount=Decimal("600000"), date=date(2026, 2, 28))
    d = dashboard(user, today=date(2026, 3, 1))
    assert d["total_balance"] == "600000.00"
    assert d["outstanding_total"] == "600000.00"
    assert d["interest_earned"] == "100000.00"
    assert d["net_worth"] == "1200000.00"
    assert d["loans_by_status"]["ACTIVE"] == 1

def test_projection_only_counts_due_until_target(user, account, loan_factory):
    loan_factory()
    p = projection(user, target_date=date(2026, 3, 31), today=date(2026, 2, 1))
    assert p["expected_inflows"] == "800000.00"            # cuotas 28-feb y 31-mar
    assert p["projected_balance"] == "800000.00"           # saldo actual 0 + 800.000

def test_projection_overdue_separate(user, account, loan_factory):
    loan_factory()
    p = projection(user, date(2026, 3, 31), today=date(2026, 3, 1), include_overdue=False)
    assert p["overdue_amount"] == "400000.00" and p["projected_balance"] == "400000.00"
    assert projection(user, date(2026, 3, 31), date(2026, 3, 1), True)["projected_balance"] == "800000.00"

def test_projection_endpoint_requires_date(api):  # GET sin date → 400
def test_reports_isolated_per_user(other_api, loan_factory):  # dashboard de other_user: total_balance "0.00", loans_by_status todos 0
```

- [ ] **Step 2: Verificar que fallan** — `pytest reports -v` → FAIL.
- [ ] **Step 3: Implementar servicios y vistas.**
- [ ] **Step 4: Verificar** — `pytest -v` → todo PASS; `python manage.py runserver` y `GET /api/reports/dashboard/` con token → 200.
- [ ] **Step 5: Commit** — `git commit -m "feat(reports): dashboard and balance projection"`.