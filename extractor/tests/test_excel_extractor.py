"""Tests for the excel_extractor helper functions."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.excel_extractor import (
    _build_resources,
    _classify_peripheral,
    _classify_pin_type,
    _extract_hsec_numbers,
    _infer_device_name,
    _parse_functions,
)
from src.schema import Pin, PinFunction, PinPositionSide, ResourceCount


class TestInferDeviceName:
    """Test _infer_device_name with various filename patterns."""

    def test_explicit_part_number(self):
        path = Path("F28388D_ControlCard_pinout.xlsx")
        assert _infer_device_name(path) == "TMS320F28388D"

    def test_f28379d_pattern(self):
        path = Path("f28379d_pinout.xlsx")
        assert _infer_device_name(path) == "TMS320F28379D"

    def test_f28004x_pattern(self):
        path = Path("F28004x_ControlCard.xlsx")
        assert _infer_device_name(path) == "TMS320F28004X"

    def test_contains_2838_fallback(self):
        path = Path("controlcard_2838_pinmap.xlsx")
        assert _infer_device_name(path) == "TMS320F28388D"

    def test_no_match_returns_stem_upper(self):
        path = Path("unknown_device_pinout.xlsx")
        assert _infer_device_name(path) == "UNKNOWN_DEVICE_PINOUT"

    def test_five_digit_part(self):
        path = Path("F28003x_launchpad.xlsx")
        assert _infer_device_name(path) == "TMS320F28003X"


class TestClassifyPeripheral:
    """Test _classify_peripheral with known peripheral names."""

    def test_epwm(self):
        assert _classify_peripheral("EPWM1A") == "EPWM"

    def test_epwm_via_pwm_pattern(self):
        assert _classify_peripheral("PWM5") == "EPWM"

    def test_adc(self):
        assert _classify_peripheral("ADCA0") == "ADC"

    def test_adcin(self):
        assert _classify_peripheral("ADCIN14") == "ADC"

    def test_can(self):
        assert _classify_peripheral("CANA_TX") == "CAN"

    def test_i2c(self):
        assert _classify_peripheral("I2CA_SDA") == "I2C"

    def test_spi(self):
        assert _classify_peripheral("SPIA_SIMO") == "SPI"

    def test_sci_uart(self):
        assert _classify_peripheral("SCIA_TX") == "SCI"
        assert _classify_peripheral("UARTA_RX") == "SCI"

    def test_gpio(self):
        assert _classify_peripheral("GPIO12") == "GPIO"

    def test_eqep(self):
        assert _classify_peripheral("EQEP1A") == "EQEP"

    def test_fsi(self):
        assert _classify_peripheral("FSITXA_D0") == "FSI"

    def test_lin(self):
        assert _classify_peripheral("LINA_TX") == "LIN"

    def test_sd(self):
        assert _classify_peripheral("SD-D1") == "SD"

    def test_ecap(self):
        assert _classify_peripheral("ECAP1") == "ECAP"

    def test_mcbsp(self):
        assert _classify_peripheral("McBSPA_DX") == "MCBSP"

    def test_trip_zone_maps_to_epwm(self):
        assert _classify_peripheral("TZ1") == "EPWM"
        assert _classify_peripheral("TZ5IN") == "EPWM"

    def test_unknown_returns_other(self):
        assert _classify_peripheral("XRSN") == "Other"
        assert _classify_peripheral("ERRORSTS") == "Other"


class TestClassifyPinType:
    """Test _classify_pin_type with different pin names."""

    def test_adc_pin_is_analog(self):
        assert _classify_pin_type("ADC-A0", []) == "analog"

    def test_adcin_pin_is_analog(self):
        assert _classify_pin_type("ADCIN14", []) == "analog"

    def test_dac_pin_is_analog(self):
        assert _classify_pin_type("DACA_OUT", []) == "analog"

    def test_xtal_pin_is_clock(self):
        assert _classify_pin_type("XTAL", []) == "clock"

    def test_osc_pin_is_clock(self):
        assert _classify_pin_type("OSC1", []) == "clock"

    def test_x1_pin_is_clock(self):
        assert _classify_pin_type("X1", []) == "clock"

    def test_x2_pin_is_clock(self):
        assert _classify_pin_type("X2", []) == "clock"

    def test_xrsn_pin_is_special(self):
        assert _classify_pin_type("XRSN", []) == "special"

    def test_errorsts_pin_is_special(self):
        assert _classify_pin_type("ERRORSTS", []) == "special"

    def test_gpio_pin_is_io(self):
        assert _classify_pin_type("GPIO0", []) == "io"

    def test_epwm_pin_is_io(self):
        assert _classify_pin_type("EPWM1A", []) == "io"

    def test_sci_pin_is_io(self):
        assert _classify_pin_type("SCIA_TX", []) == "io"


class TestExtractHsecNumbers:
    """Test _extract_hsec_numbers with multi-line HSEC strings."""

    def test_empty_string(self):
        assert _extract_hsec_numbers("") == []

    def test_single_number(self):
        assert _extract_hsec_numbers("42") == ["42"]

    def test_multiline_numbers(self):
        result = _extract_hsec_numbers("9\n11\n15")
        assert "9" in result
        assert "11" in result
        assert "15" in result

    def test_number_with_text(self):
        result = _extract_hsec_numbers("9 VSS")
        assert "9" in result

    def test_multiline_with_text(self):
        result = _extract_hsec_numbers("161 TMS\n163 TCK")
        assert "161" in result
        assert "163" in result

    def test_complex_multiline(self):
        result = _extract_hsec_numbers("75\n77\n79")
        assert result[0] == "75"
        assert "77" in result
        assert "79" in result

    def test_whitespace_handling(self):
        result = _extract_hsec_numbers("  42  \n  44  ")
        assert "42" in result
        assert "44" in result


class TestParseFunctions:
    """Test _parse_functions with various function strings."""

    def test_empty_func_str(self):
        result = _parse_functions("EPWM1A", "")
        assert len(result) == 1
        assert result[0].name == "EPWM1A"
        assert result[0].peripheral == "EPWM"

    def test_nan_func_str(self):
        result = _parse_functions("GPIO12", "nan")
        assert len(result) == 1
        assert result[0].name == "GPIO12"
        assert result[0].peripheral == "GPIO"

    def test_gpio_func_str_adds_gpio(self):
        """When func_str is 'GPIO' and primary is not GPIO, GPIO is appended."""
        result = _parse_functions("EPWM1A", "GPIO")
        assert len(result) == 2
        assert result[0].name == "EPWM1A"
        assert result[1].name == "GPIO"
        assert result[1].peripheral == "GPIO"

    def test_gpio_func_str_no_duplicate(self):
        """When primary is already GPIO, 'GPIO' func_str should not duplicate."""
        result = _parse_functions("GPIO5", "GPIO")
        assert len(result) == 1
        assert result[0].name == "GPIO5"

    def test_rsv_func_str(self):
        result = _parse_functions("SCIA_TX", "rsv")
        assert len(result) == 1
        assert result[0].name == "SCIA_TX"

    def test_multiple_functions(self):
        result = _parse_functions("EPWM1A", "GPIO0 SCIA_TX")
        names = [f.name for f in result]
        assert "EPWM1A" in names
        assert "GPIO0" in names
        assert "SCIA_TX" in names

    def test_and_or_pattern(self):
        result = _parse_functions("ADC-A0", "ADC1 (and/or DACA)")
        names = [f.name for f in result]
        assert "ADC-A0" in names
        assert "ADC1" in names
        assert "DACA" in names

    def test_no_duplicate_names(self):
        result = _parse_functions("EPWM1A", "EPWM1A GPIO0")
        # EPWM1A should only appear once (already the primary)
        epwm_count = sum(1 for f in result if f.name == "EPWM1A")
        assert epwm_count == 1

    def test_or_keyword_filtered(self):
        result = _parse_functions("GPIO0", "SCIA_TX or EPWM1A")
        names = [f.name for f in result]
        assert "or" not in names
        assert "SCIA_TX" in names
        assert "EPWM1A" in names

    def test_parenthetical_notes_removed(self):
        result = _parse_functions("GPIO0", "SCIA_TX (active low)")
        names = [f.name for f in result]
        assert "active" not in names
        assert "low)" not in names
        assert "SCIA_TX" in names


class TestBuildResources:
    """Test _build_resources with sample pin data."""

    def _make_pin(self, name: str, pin_type: str, pin_id: str = "1") -> Pin:
        """Helper to create a minimal pin."""
        return Pin(
            id=pin_id,
            name=name,
            position=PinPositionSide(side="left", index=0),
            type=pin_type,
        )

    def test_gpio_count(self):
        pins = [
            self._make_pin("GPIO0", "io", "1"),
            self._make_pin("GPIO1", "io", "2"),
            self._make_pin("GPIO2", "io", "3"),
            self._make_pin("GND", "ground", "4"),
            self._make_pin("VDD", "power", "5"),
        ]
        resources = _build_resources(pins, {})
        assert resources["GPIO"].total == 3
        assert resources["GPIO"].used == 0

    def test_adc_count(self):
        pins = [
            self._make_pin("ADC-A0", "analog", "1"),
            self._make_pin("ADC-A1", "analog", "2"),
            self._make_pin("GPIO0", "io", "3"),
        ]
        resources = _build_resources(pins, {})
        assert resources["ADC"].total == 2

    def test_epwm_count_divided_by_2(self):
        pins = [self._make_pin("GPIO0", "io")]
        resource_raw = {"EPWM": 16}
        resources = _build_resources(pins, resource_raw)
        assert resources["EPWM"].total == 8

    def test_epwm_capped_at_16(self):
        pins = [self._make_pin("GPIO0", "io")]
        resource_raw = {"EPWM": 100}
        resources = _build_resources(pins, resource_raw)
        assert resources["EPWM"].total == 16

    def test_epwm_minimum_1(self):
        pins = [self._make_pin("GPIO0", "io")]
        resource_raw = {"EPWM": 1}
        resources = _build_resources(pins, resource_raw)
        assert resources["EPWM"].total == 1

    def test_peripheral_instances_from_raw(self):
        pins = [self._make_pin("GPIO0", "io")]
        resource_raw = {"SPI": 12, "SCI": 9, "I2C": 6}
        resources = _build_resources(pins, resource_raw)
        assert resources["SPI"].total == 4  # 12 // 3
        assert resources["SCI"].total == 3  # 9 // 3
        assert resources["I2C"].total == 2  # 6 // 3

    def test_peripheral_not_present_if_zero(self):
        pins = [self._make_pin("GPIO0", "io")]
        resources = _build_resources(pins, {})
        assert "SPI" not in resources
        assert "CAN" not in resources

    def test_all_used_counts_start_at_zero(self):
        pins = [
            self._make_pin("GPIO0", "io", "1"),
            self._make_pin("ADC-A0", "analog", "2"),
        ]
        resource_raw = {"EPWM": 8, "SPI": 6}
        resources = _build_resources(pins, resource_raw)
        for name, rc in resources.items():
            assert rc.used == 0, f"{name} should have used=0"

    def test_small_raw_counts_get_minimum_1(self):
        pins = [self._make_pin("GPIO0", "io")]
        resource_raw = {"CAN": 2, "EQEP": 1}
        resources = _build_resources(pins, resource_raw)
        assert resources["CAN"].total == 1  # max(1, 2 // 3) = max(1, 0) = 1
        assert resources["EQEP"].total == 1
