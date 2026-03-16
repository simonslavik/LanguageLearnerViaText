"""PDF parsing service — extracts text from uploaded PDF files."""

from PyPDF2 import PdfReader


def extract_text_from_pdf(file_path: str) -> str:
    """Read a PDF file and return its full text content.

    Args:
        file_path: Absolute or relative path to the PDF file.

    Returns:
        Extracted text as a single string with pages separated by newlines.

    Raises:
        ValueError: If the PDF contains no extractable text.
        FileNotFoundError: If the file does not exist.
    """
    reader = PdfReader(file_path)
    pages_text: list[str] = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text.strip())

    if not pages_text:
        raise ValueError(
            "The uploaded PDF contains no extractable text. "
            "It may be a scanned image — please upload a text-based PDF."
        )

    return "\n\n".join(pages_text)
