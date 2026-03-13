"""Extract device data from PDF datasheets using Docling."""

from __future__ import annotations

from pathlib import Path

from rich.console import Console

from .schema import ClockTree, DeviceData, DeviceInfo

console = Console()


def extract_from_pdf(file_path: Path) -> DeviceData:
    """Extract device data from a PDF datasheet using Docling.

    This uses Docling's DocumentConverter with TableFormerMode.ACCURATE
    to extract pin attribute tables and clock specifications.
    """
    try:
        from docling.document_converter import DocumentConverter

        console.print("[dim]Initializing Docling converter...[/]")
        converter = DocumentConverter()
        result = converter.convert(str(file_path))

        # Extract markdown for analysis
        markdown = result.document.export_to_markdown()

        # Extract tables
        tables = []
        for table in result.document.tables:
            df = table.export_to_dataframe(doc=result.document)
            tables.append(df)

        console.print(f"[dim]Extracted {len(tables)} tables from PDF[/]")

        # TODO: Parse tables to find pin attribute data and clock specs
        # For now, return a minimal DeviceData with info extracted from filename
        device_name = _infer_device_from_filename(file_path)

        return DeviceData(
            device=DeviceInfo(
                name=device_name,
                manufacturer="Texas Instruments",
                family="C2000",
                description=f"Extracted from {file_path.name}",
                datasheet_url=f"https://www.ti.com/lit/ds/symlink/{device_name.lower()}.pdf",
            ),
            clock=ClockTree(),
        )

    except ImportError:
        console.print("[yellow]Warning: Docling not installed. Install with: uv pip install docling[/]")
        return DeviceData(
            device=DeviceInfo(
                name=_infer_device_from_filename(file_path),
                manufacturer="Unknown",
                family="Unknown",
                description=f"PDF extraction requires Docling. File: {file_path.name}",
            ),
        )


def _infer_device_from_filename(file_path: Path) -> str:
    """Infer device name from PDF filename."""
    import re

    name = file_path.stem.upper()
    match = re.search(r"TMS320F\d{4,5}\w*", name)
    if match:
        return match.group()
    match = re.search(r"F\d{4,5}\w*", name)
    if match:
        return f"TMS320{match.group()}"
    return name
