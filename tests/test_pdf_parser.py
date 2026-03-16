"""Tests for the PDF parser service."""

import os
import pytest
from unittest.mock import patch, MagicMock

from app.services.pdf_parser import extract_text_from_pdf


def test_extract_text_file_not_found():
    """Raise FileNotFoundError for a missing file."""
    with pytest.raises(Exception):
        extract_text_from_pdf("/nonexistent/path.pdf")


@patch("app.services.pdf_parser.PdfReader")
def test_extract_text_empty_pdf(mock_reader_cls):
    """Raise ValueError when the PDF has no extractable text."""
    mock_reader = MagicMock()
    mock_page = MagicMock()
    mock_page.extract_text.return_value = ""
    mock_reader.pages = [mock_page]
    mock_reader_cls.return_value = mock_reader

    with pytest.raises(ValueError, match="no extractable text"):
        extract_text_from_pdf("dummy.pdf")


@patch("app.services.pdf_parser.PdfReader")
def test_extract_text_success(mock_reader_cls):
    """Return joined text from multiple pages."""
    mock_reader = MagicMock()
    page1, page2 = MagicMock(), MagicMock()
    page1.extract_text.return_value = "Hello world"
    page2.extract_text.return_value = "Second page"
    mock_reader.pages = [page1, page2]
    mock_reader_cls.return_value = mock_reader

    result = extract_text_from_pdf("dummy.pdf")
    assert "Hello world" in result
    assert "Second page" in result
