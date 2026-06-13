"""
Tests del guard anti-destructivo en load_clientes_maestro.py.
El script destructivo NO debe correr sin el flag explícito.
"""
import pytest

from src.scripts.load_clientes_maestro import _assert_destructive_allowed


def test_guard_bloquea_sin_flag(monkeypatch):
    monkeypatch.delenv("ALLOW_DESTRUCTIVE_LOAD", raising=False)
    with pytest.raises(RuntimeError):
        _assert_destructive_allowed()


def test_guard_permite_con_flag_yes(monkeypatch):
    monkeypatch.setenv("ALLOW_DESTRUCTIVE_LOAD", "yes")
    _assert_destructive_allowed()  # no debe lanzar


def test_guard_bloquea_con_valor_invalido(monkeypatch):
    monkeypatch.setenv("ALLOW_DESTRUCTIVE_LOAD", "quizas")
    with pytest.raises(RuntimeError):
        _assert_destructive_allowed()
