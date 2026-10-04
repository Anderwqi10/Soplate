from decimal import Decimal

from core.money import money_str, q2


def test_q2_rounds_half_up():
    assert q2(Decimal("66666.665")) == Decimal("66666.67")
    assert q2(10) == Decimal("10.00")
    assert money_str(Decimal("5")) == "5.00"
