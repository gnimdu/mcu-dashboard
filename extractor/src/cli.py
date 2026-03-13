"""CLI entry point for MCU data extraction."""

from __future__ import annotations

import json
from pathlib import Path

import click
from rich.console import Console

console = Console()


@click.group()
@click.version_option(version="0.1.0")
def main() -> None:
    """MCU Dashboard Data Extractor - Extract pin mapping and clock data from manufacturer datasheets."""
    pass


@main.command()
@click.option("--input", "-i", "input_path", required=True, type=click.Path(exists=True), help="Input Excel file path")
@click.option("--output", "-o", "output_path", required=True, type=click.Path(), help="Output JSON file path")
def excel(input_path: str, output_path: str) -> None:
    """Extract pinout data from an Excel file."""
    from .excel_extractor import extract_from_excel

    console.print(f"[bold blue]Extracting from Excel:[/] {input_path}")

    device_data = extract_from_excel(Path(input_path))

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(device_data.model_dump_json(indent=2))

    console.print(f"[bold green]Done![/] Output written to {output_path}")
    console.print(f"  Packages: {len(device_data.packages)}")
    for pkg in device_data.packages:
        console.print(f"    {pkg.name}: {len(pkg.pins)} pins")


@main.command()
@click.option("--input", "-i", "input_path", required=True, type=click.Path(exists=True), help="Input PDF file path")
@click.option("--output", "-o", "output_path", required=True, type=click.Path(), help="Output JSON file path")
def pdf(input_path: str, output_path: str) -> None:
    """Extract pinout and clock data from a PDF datasheet."""
    from .pdf_extractor import extract_from_pdf

    console.print(f"[bold blue]Extracting from PDF:[/] {input_path}")

    device_data = extract_from_pdf(Path(input_path))

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(device_data.model_dump_json(indent=2))

    console.print(f"[bold green]Done![/] Output written to {output_path}")


@main.command()
@click.option("--excel", "-e", "excel_path", required=True, type=click.Path(exists=True), help="Excel pinout file")
@click.option("--pdf", "-p", "pdf_path", required=True, type=click.Path(exists=True), help="PDF datasheet file")
@click.option("--output", "-o", "output_path", required=True, type=click.Path(), help="Output JSON file path")
def merge(excel_path: str, pdf_path: str, output_path: str) -> None:
    """Merge data from Excel pinout and PDF datasheet into a complete device profile."""
    from .excel_extractor import extract_from_excel
    from .pdf_extractor import extract_from_pdf

    console.print("[bold blue]Merging Excel + PDF data[/]")

    excel_data = extract_from_excel(Path(excel_path))
    pdf_data = extract_from_pdf(Path(pdf_path))

    # Merge: Excel provides pins, PDF provides clock tree and additional details
    merged = excel_data.model_copy()
    if pdf_data.clock.sources:
        merged.clock = pdf_data.clock
    if pdf_data.device.description:
        merged.device.description = pdf_data.device.description

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(merged.model_dump_json(indent=2))

    console.print(f"[bold green]Done![/] Merged output written to {output_path}")


if __name__ == "__main__":
    main()
