import json
import logging

from app.core.logging import get_logger, setup_logging


def test_setup_logging_configures_root_handlers(tmp_path):
    log_file = tmp_path / "oto.log"

    setup_logging(level="DEBUG", log_file=str(log_file))

    root = logging.getLogger()
    assert root.level == logging.DEBUG
    assert len(root.handlers) >= 2  # console + rotating file


def test_get_logger_returns_named_logger():
    logger = get_logger("app.test")

    assert isinstance(logger, logging.Logger)
    assert logger.name == "app.test"


def test_logger_emits_structured_json_with_expected_fields(tmp_path, capsys):
    log_file = tmp_path / "oto.log"
    setup_logging(level="INFO", log_file=str(log_file))

    logger = get_logger("app.audit")
    logger.info(
        "audit.write",
        extra={"tabela": "empresa", "registro_id": "abc-123", "operacao": "INSERT", "usuario_id": "user-1"},
    )

    contents = log_file.read_text().strip().splitlines()
    assert contents, "expected at least one line written to the log file"

    record = json.loads(contents[-1])
    assert record["message"] == "audit.write"
    assert record["level"] == "INFO"
    assert record["logger"] == "app.audit"
    assert record["tabela"] == "empresa"
    assert record["registro_id"] == "abc-123"
    assert record["operacao"] == "INSERT"
    assert record["usuario_id"] == "user-1"
    assert "timestamp" in record
