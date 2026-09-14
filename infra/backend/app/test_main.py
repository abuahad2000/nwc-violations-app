from pathlib import Path


def test_backend_files_are_present() -> None:
    root = Path(__file__).parents[2]
    assert (root / "requirements.txt").exists()
    assert (root / "Dockerfile").exists()
