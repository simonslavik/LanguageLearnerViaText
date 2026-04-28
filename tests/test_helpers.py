"""Unit tests for app/utils/helpers.py."""

import pytest
from app.utils.helpers import allowed_file


class TestAllowedFile:
    def test_pdf_allowed(self):
        assert allowed_file("document.pdf") is True

    def test_pdf_uppercase_allowed(self):
        assert allowed_file("DOCUMENT.PDF") is True

    def test_pdf_mixed_case_allowed(self):
        assert allowed_file("Report.Pdf") is True

    def test_txt_not_allowed(self):
        assert allowed_file("notes.txt") is False

    def test_docx_not_allowed(self):
        assert allowed_file("resume.docx") is False

    def test_jpg_not_allowed(self):
        assert allowed_file("photo.jpg") is False

    def test_exe_not_allowed(self):
        assert allowed_file("malware.exe") is False

    def test_no_extension_not_allowed(self):
        assert allowed_file("nodotfile") is False

    def test_empty_string_not_allowed(self):
        assert allowed_file("") is False

    def test_dot_only_not_allowed(self):
        """A filename of just '.' has no valid extension."""
        assert allowed_file(".") is False

    def test_pdf_with_path_separators(self):
        """Extension check works regardless of directory prefix."""
        assert allowed_file("some/nested/path/file.pdf") is True

    def test_double_extension_uses_last(self):
        """Only the last extension matters."""
        assert allowed_file("archive.tar.gz") is False
        assert allowed_file("archive.tar.pdf") is True
