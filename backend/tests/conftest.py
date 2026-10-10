import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import db  # noqa: E402


@pytest.fixture
def fresh_db(tmp_path):
    """Each test gets its own empty SQLite file."""
    url = f"sqlite:///{tmp_path / 'test.db'}"
    db.init_db(url)
    return url
