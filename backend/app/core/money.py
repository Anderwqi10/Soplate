"""Utilidades de dinero: todo monto se maneja como Decimal con 2 decimales."""
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def q2(value: Decimal | int | str) -> Decimal:
    """Redondea a centavos (0.005 sube a 0.01)."""
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def money_str(value: Decimal) -> str:
    """Formato que viaja en la API: "1200000.00"."""
    return str(q2(value))
