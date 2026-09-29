import pytest

from financial_analysis.calculator import calculate_financial_metrics


@pytest.fixture
def sample_financials():
    return {
        "monthly_revenue": 5_000_000.0,
        "monthly_expenses": 4_000_000.0,
        "monthly_net_income": 1_000_000.0,
        "existing_monthly_debt_payment": 2_000_000.0,
        "total_outstanding_debt": 12_000_000.0,
    }


@pytest.fixture
def sample_loan():
    return {
        "amount": 10_000_000.0,
        "currency": "NGN",
        "purpose": "Working capital",
        "tenor_months": 24,
    }


def test_calculates_financial_metrics(sample_financials, sample_loan):
    result = calculate_financial_metrics(
        application_id="CR-001",
        financials=sample_financials,
        loan=sample_loan,
    )

    metrics = result["metrics"]

    assert metrics["net_profit_margin"]["value"] == pytest.approx(0.20)
    assert metrics["debt_to_revenue"]["value"] == pytest.approx(0.20)
    assert metrics["dscr"]["value"] == pytest.approx(0.50)
    assert metrics["loan_to_annual_revenue"]["value"] == pytest.approx(
        10_000_000 / 60_000_000
    )
    assert metrics["expense_ratio"]["value"] == pytest.approx(0.80)


def test_returns_application_id(sample_financials, sample_loan):
    result = calculate_financial_metrics(
        application_id="CR-001",
        financials=sample_financials,
        loan=sample_loan,
    )

    assert result["application_id"] == "CR-001"


def test_includes_calculation_for_each_metric(
    sample_financials,
    sample_loan,
):
    result = calculate_financial_metrics(
        application_id="CR-001",
        financials=sample_financials,
        loan=sample_loan,
    )

    metrics = result["metrics"]

    expected_metrics = {
        "net_profit_margin",
        "debt_to_revenue",
        "dscr",
        "loan_to_annual_revenue",
        "expense_ratio",
    }

    assert set(metrics.keys()) == expected_metrics

    for metric in metrics.values():
        assert "value" in metric
        assert "calculation" in metric


def test_dscr_is_not_calculated_when_there_is_no_existing_debt_service(
    sample_financials,
    sample_loan,
):
    sample_financials["existing_monthly_debt_payment"] = 0.0
    sample_financials["total_outstanding_debt"] = 0.0

    result = calculate_financial_metrics(
        application_id="CR-002",
        financials=sample_financials,
        loan=sample_loan,
    )

    dscr = result["metrics"]["dscr"]

    assert dscr["value"] is None
    assert dscr["calculation"] == (
        "Not applicable: no existing debt service"
    )


def test_rejects_zero_monthly_revenue(sample_financials, sample_loan):
    sample_financials["monthly_revenue"] = 0.0

    with pytest.raises(
        ValueError,
        match="Monthly revenue must be greater than zero",
    ):
        calculate_financial_metrics(
            application_id="CR-003",
            financials=sample_financials,
            loan=sample_loan,
        )


def test_rejects_negative_monthly_revenue(sample_financials, sample_loan):
    sample_financials["monthly_revenue"] = -1_000_000.0

    with pytest.raises(
        ValueError,
        match="Monthly revenue must be greater than zero",
    ):
        calculate_financial_metrics(
            application_id="CR-004",
            financials=sample_financials,
            loan=sample_loan,
        )