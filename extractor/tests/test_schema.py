"""Tests for the Pydantic schema models."""

from __future__ import annotations

import json

import pytest

from src.schema import (
    ClockBus,
    ClockMux,
    ClockSource,
    ClockTree,
    DeviceData,
    DeviceInfo,
    Package,
    Peripheral,
    PeripheralGroup,
    PeripheralParam,
    Pin,
    PinElectrical,
    PinFunction,
    PinPositionGrid,
    PinPositionSide,
    PLL,
    ResourceCount,
)


class TestDeviceInfo:
    """Test DeviceInfo model creation and validation."""

    def test_required_fields(self):
        info = DeviceInfo(
            name="TMS320F28388D",
            manufacturer="Texas Instruments",
            family="C2000",
        )
        assert info.name == "TMS320F28388D"
        assert info.manufacturer == "Texas Instruments"
        assert info.family == "C2000"
        assert info.description == ""
        assert info.datasheet_url is None
        assert info.datasheet_version is None

    def test_all_fields(self):
        info = DeviceInfo(
            name="TMS320F28388D",
            manufacturer="Texas Instruments",
            family="C2000",
            description="Dual-core 32-bit MCU",
            datasheet_url="https://example.com/ds.pdf",
            datasheet_version="Rev. A",
        )
        assert info.description == "Dual-core 32-bit MCU"
        assert info.datasheet_url == "https://example.com/ds.pdf"
        assert info.datasheet_version == "Rev. A"

    def test_missing_required_field_raises(self):
        with pytest.raises(Exception):
            DeviceInfo(name="Test", manufacturer="Test")  # type: ignore[call-arg]


class TestPin:
    """Test Pin model with different position types."""

    def test_pin_with_side_position(self):
        pin = Pin(
            id="1",
            name="GPIO0",
            position=PinPositionSide(side="left", index=0),
            type="io",
        )
        assert pin.id == "1"
        assert pin.name == "GPIO0"
        assert pin.type == "io"
        assert pin.position.side == "left"
        assert pin.position.index == 0
        assert pin.functions == []
        assert pin.electrical is None

    def test_pin_with_grid_position(self):
        pin = Pin(
            id="A1",
            name="VDD",
            position=PinPositionGrid(row="A", col=1),
            type="power",
        )
        assert pin.position.row == "A"
        assert pin.position.col == 1

    def test_pin_with_functions(self):
        pin = Pin(
            id="5",
            name="EPWM1A",
            position=PinPositionSide(side="right", index=3),
            type="io",
            functions=[
                PinFunction(name="EPWM1A", peripheral="EPWM"),
                PinFunction(name="GPIO0", peripheral="GPIO", mux_mode=0),
            ],
        )
        assert len(pin.functions) == 2
        assert pin.functions[0].peripheral == "EPWM"
        assert pin.functions[1].mux_mode == 0

    def test_pin_with_electrical(self):
        pin = Pin(
            id="10",
            name="ADC-A0",
            position=PinPositionSide(side="left", index=0),
            type="analog",
            electrical=PinElectrical(voltage="3.3V", max_current="4mA"),
        )
        assert pin.electrical is not None
        assert pin.electrical.voltage == "3.3V"
        assert pin.electrical.max_current == "4mA"

    def test_pin_type_valid_literals(self):
        """Test that all valid pin types are accepted."""
        for pin_type in ("io", "analog", "power", "ground", "clock", "special"):
            pin = Pin(
                id="1",
                name="test",
                position=PinPositionSide(side="top", index=0),
                type=pin_type,
            )
            assert pin.type == pin_type

    def test_pin_type_invalid_raises(self):
        """Test that invalid pin type raises a validation error."""
        with pytest.raises(Exception):
            Pin(
                id="1",
                name="test",
                position=PinPositionSide(side="top", index=0),
                type="invalid",  # type: ignore[arg-type]
            )

    def test_position_side_invalid_raises(self):
        """Test that invalid side literal raises a validation error."""
        with pytest.raises(Exception):
            PinPositionSide(side="diagonal", index=0)  # type: ignore[arg-type]


class TestClockTree:
    """Test ClockTree and its sub-models."""

    def test_clock_source(self):
        src = ClockSource(
            id="xtal",
            name="X1/X2",
            frequency=20_000_000,
            type="external",
        )
        assert src.frequency == 20_000_000
        assert src.type == "external"
        assert src.enabled is True

    def test_clock_source_type_validation(self):
        with pytest.raises(Exception):
            ClockSource(
                id="bad",
                name="bad",
                frequency=100,
                type="crystal",  # type: ignore[arg-type]
            )

    def test_pll(self):
        pll = PLL(
            id="syspll",
            name="SYSPLL",
            source="xtal",
            input_div=1,
            multiplier=20,
            output_div=2,
            vco_frequency=400_000_000,
            output_frequency=200_000_000,
        )
        assert pll.vco_frequency == 400_000_000
        assert pll.output_frequency == 200_000_000
        assert pll.enabled is True

    def test_clock_bus(self):
        bus = ClockBus(
            id="sysclk",
            name="SYSCLK",
            source="syspll",
            divider=1,
            frequency=200_000_000,
        )
        assert bus.frequency == 200_000_000
        assert bus.divider == 1

    def test_clock_mux(self):
        mux = ClockMux(
            id="mux1",
            name="SYSCLK Mux",
            sources=["intosc1", "xtal"],
            selected="xtal",
            output_frequency=20_000_000,
        )
        assert len(mux.sources) == 2
        assert mux.selected == "xtal"

    def test_clock_tree_full(self):
        tree = ClockTree(
            sources=[
                ClockSource(id="intosc1", name="INTOSC1", frequency=10_000_000, type="internal"),
                ClockSource(id="xtal", name="X1/X2", frequency=20_000_000, type="external"),
            ],
            plls=[
                PLL(
                    id="syspll",
                    name="SYSPLL",
                    source="xtal",
                    input_div=1,
                    multiplier=20,
                    output_div=2,
                    vco_frequency=400_000_000,
                    output_frequency=200_000_000,
                ),
            ],
            buses=[
                ClockBus(id="sysclk", name="SYSCLK", source="syspll", divider=1, frequency=200_000_000),
                ClockBus(id="lspclk", name="LSPCLK", source="sysclk", divider=4, frequency=50_000_000),
            ],
        )
        assert len(tree.sources) == 2
        assert len(tree.plls) == 1
        assert len(tree.buses) == 2
        assert tree.muxes == []

    def test_empty_clock_tree(self):
        tree = ClockTree()
        assert tree.sources == []
        assert tree.plls == []
        assert tree.muxes == []
        assert tree.buses == []


class TestDeviceData:
    """Test full DeviceData construction."""

    def test_minimal_device_data(self):
        data = DeviceData(
            device=DeviceInfo(
                name="TestMCU",
                manufacturer="TestCorp",
                family="TestFamily",
            ),
        )
        assert data.device.name == "TestMCU"
        assert data.packages == []
        assert data.clock.sources == []
        assert data.peripherals == []
        assert data.resources == {}

    def test_full_device_data(self):
        data = DeviceData(
            device=DeviceInfo(
                name="TMS320F28388D",
                manufacturer="Texas Instruments",
                family="C2000",
                description="Dual-core MCU",
            ),
            packages=[
                Package(
                    name="180-pin HSEC ControlCard",
                    type="controlcard",
                    pin_count=2,
                    pins=[
                        Pin(
                            id="1",
                            name="GPIO0",
                            position=PinPositionSide(side="left", index=0),
                            type="io",
                            functions=[PinFunction(name="GPIO0", peripheral="GPIO")],
                        ),
                        Pin(
                            id="2",
                            name="GND",
                            position=PinPositionSide(side="left", index=1),
                            type="ground",
                            functions=[PinFunction(name="GND", peripheral="Power")],
                        ),
                    ],
                ),
            ],
            clock=ClockTree(
                sources=[
                    ClockSource(id="xtal", name="XTAL", frequency=20_000_000, type="external"),
                ],
            ),
            peripherals=[
                PeripheralGroup(
                    category="Timers",
                    peripherals=[
                        Peripheral(
                            name="EPWM",
                            type="EPWM",
                            enabled=False,
                            instances=8,
                            pins=["EPWM1A", "EPWM1B"],
                            params=[
                                PeripheralParam(name="frequency", label="PWM Freq", default=20000, unit="Hz"),
                            ],
                        ),
                    ],
                ),
            ],
            resources={"GPIO": ResourceCount(used=0, total=10)},
        )
        assert data.device.name == "TMS320F28388D"
        assert len(data.packages) == 1
        assert len(data.packages[0].pins) == 2
        assert len(data.clock.sources) == 1
        assert len(data.peripherals) == 1
        assert data.resources["GPIO"].total == 10


class TestSerialization:
    """Test model serialization."""

    def test_model_dump_json_roundtrip(self):
        """Test that model_dump_json produces valid JSON that can be re-parsed."""
        data = DeviceData(
            device=DeviceInfo(
                name="TMS320F28388D",
                manufacturer="Texas Instruments",
                family="C2000",
            ),
            packages=[
                Package(
                    name="ControlCard",
                    type="controlcard",
                    pin_count=1,
                    pins=[
                        Pin(
                            id="1",
                            name="GPIO0",
                            position=PinPositionSide(side="left", index=0),
                            type="io",
                            functions=[PinFunction(name="GPIO0", peripheral="GPIO")],
                        ),
                    ],
                ),
            ],
            clock=ClockTree(
                sources=[
                    ClockSource(id="xtal", name="XTAL", frequency=20_000_000, type="external"),
                ],
                plls=[
                    PLL(
                        id="syspll",
                        name="SYSPLL",
                        source="xtal",
                        multiplier=20,
                        output_div=2,
                        vco_frequency=400_000_000,
                        output_frequency=200_000_000,
                    ),
                ],
            ),
            resources={"GPIO": ResourceCount(used=1, total=5)},
        )
        json_str = data.model_dump_json()
        parsed = json.loads(json_str)
        assert parsed["device"]["name"] == "TMS320F28388D"
        assert parsed["packages"][0]["pins"][0]["type"] == "io"
        assert parsed["clock"]["sources"][0]["frequency"] == 20_000_000
        assert parsed["resources"]["GPIO"]["total"] == 5

    def test_model_dump_json_excludes_none(self):
        """Test that None optional fields are handled correctly."""
        pin = Pin(
            id="1",
            name="GPIO0",
            position=PinPositionSide(side="left", index=0),
            type="io",
        )
        json_str = pin.model_dump_json()
        parsed = json.loads(json_str)
        assert "electrical" in parsed  # Pydantic includes None by default
        assert parsed["electrical"] is None

    def test_model_reconstruct_from_json(self):
        """Test that a model can be reconstructed from its JSON output."""
        original = DeviceData(
            device=DeviceInfo(
                name="TestMCU",
                manufacturer="TestCorp",
                family="TestFamily",
                description="A test device",
            ),
            packages=[
                Package(
                    name="QFP-100",
                    type="qfp",
                    pin_count=100,
                ),
            ],
            resources={"ADC": ResourceCount(used=2, total=16)},
        )
        json_str = original.model_dump_json()
        restored = DeviceData.model_validate_json(json_str)
        assert restored.device.name == original.device.name
        assert restored.packages[0].type == "qfp"
        assert restored.resources["ADC"].used == 2
