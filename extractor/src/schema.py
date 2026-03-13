"""Pydantic models for the MCU device data schema."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DeviceInfo(BaseModel):
    name: str
    manufacturer: str
    family: str
    description: str = ""
    datasheet_url: str | None = None
    datasheet_version: str | None = None


class PinFunction(BaseModel):
    name: str
    peripheral: str
    mux_mode: int | None = None


class PinElectrical(BaseModel):
    voltage: str | None = None
    max_current: str | None = None


class PinPositionSide(BaseModel):
    side: Literal["top", "bottom", "left", "right"]
    index: int


class PinPositionGrid(BaseModel):
    row: str
    col: int


class Pin(BaseModel):
    id: str
    name: str
    position: PinPositionSide | PinPositionGrid
    type: Literal["io", "analog", "power", "ground", "clock", "special"]
    functions: list[PinFunction] = Field(default_factory=list)
    electrical: PinElectrical | None = None
    assigned_function: str | None = None
    user_label: str | None = None


class Package(BaseModel):
    name: str
    type: Literal["bga", "qfp", "lqfp", "controlcard", "launchpad"]
    pin_count: int
    dimensions: dict[str, int] | None = None
    pins: list[Pin] = Field(default_factory=list)


class ClockSource(BaseModel):
    id: str
    name: str
    frequency: int
    type: Literal["internal", "external"]
    enabled: bool = True


class PLL(BaseModel):
    id: str
    name: str
    source: str
    input_div: int = 1
    multiplier: int = 1
    output_div: int = 1
    vco_frequency: int = 0
    output_frequency: int = 0
    enabled: bool = True


class ClockMux(BaseModel):
    id: str
    name: str
    sources: list[str] = Field(default_factory=list)
    selected: str = ""
    output_frequency: int = 0


class ClockBus(BaseModel):
    id: str
    name: str
    source: str
    divider: int = 1
    frequency: int = 0


class ClockTree(BaseModel):
    sources: list[ClockSource] = Field(default_factory=list)
    plls: list[PLL] = Field(default_factory=list)
    muxes: list[ClockMux] = Field(default_factory=list)
    buses: list[ClockBus] = Field(default_factory=list)


class PeripheralParam(BaseModel):
    options: list[str | int | float] | None = None
    min: float | None = None
    max: float | None = None
    default: str | int | float | bool
    value: str | int | float | bool | None = None
    unit: str | None = None


class Peripheral(BaseModel):
    name: str
    type: str
    enabled: bool = False
    instances: int = 1
    pins: list[str] = Field(default_factory=list)
    config: dict[str, PeripheralParam] = Field(default_factory=dict)


class PeripheralGroup(BaseModel):
    category: str
    peripherals: list[Peripheral] = Field(default_factory=list)


class ResourceCount(BaseModel):
    used: int = 0
    total: int = 0


class DeviceData(BaseModel):
    device: DeviceInfo
    packages: list[Package] = Field(default_factory=list)
    clock: ClockTree = Field(default_factory=ClockTree)
    peripherals: list[PeripheralGroup] = Field(default_factory=list)
    resources: dict[str, ResourceCount] = Field(default_factory=dict)
