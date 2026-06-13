"""
Sistema de logging profesional para ETL con métricas y análisis de deltas.
Genera logs detallados con rotación automática y resúmenes de ejecución.
"""

import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
from typing import Dict, Any
import json


class ETLLogger:
    """Logger especializado para el proceso ETL con métricas y análisis."""

    def __init__(self, log_dir: str = "logs"):
        self.log_dir = log_dir
        self.execution_start = None
        self.metrics = {
            "execution_id": None,
            "start_time": None,
            "end_time": None,
            "duration_seconds": None,
            "total_fetched": 0,
            "total_processed": 0,
            "total_matched": 0,
            "new_appointments": 0,
            "updated_appointments": 0,
            "unchanged_appointments": 0,
            "errors": [],
            "analysts_summary": {},
            "sync_summary": {}
        }

        # Crear directorio de logs si no existe
        os.makedirs(log_dir, exist_ok=True)

        # Configurar logger principal
        self.logger = self._setup_logger()

    def _setup_logger(self) -> logging.Logger:
        """Configura el logger con handlers para archivo y consola."""
        logger = logging.getLogger("ETL")
        logger.setLevel(logging.DEBUG)

        # Evitar duplicados si ya está configurado
        if logger.handlers:
            return logger

        # Formato detallado para logs
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)-8s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        # Handler para archivo (con rotación)
        log_file = os.path.join(self.log_dir, "etl.log")
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=10,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)

        # Handler para consola
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)

        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

        return logger

    def start_execution(self):
        """Inicia una nueva ejecución de ETL."""
        self.execution_start = datetime.now()
        self.metrics["execution_id"] = self.execution_start.strftime("%Y%m%d_%H%M%S")
        self.metrics["start_time"] = self.execution_start.isoformat()

        self.logger.info("=" * 80)
        self.logger.info(f"ETL EXECUTION STARTED - ID: {self.metrics['execution_id']}")
        self.logger.info("=" * 80)

    def end_execution(self):
        """Finaliza la ejecución y genera el resumen."""
        execution_end = datetime.now()
        self.metrics["end_time"] = execution_end.isoformat()
        self.metrics["duration_seconds"] = (execution_end - self.execution_start).total_seconds()

        # Generar resumen
        self._log_summary()

        # Guardar resumen en JSON
        self._save_summary_json()

        self.logger.info("=" * 80)
        self.logger.info("ETL EXECUTION COMPLETED")
        self.logger.info("=" * 80)

    def log_fetching_start(self, analyst_email: str):
        """Registra inicio de fetch para un analista."""
        self.logger.info(f"Fetching events for analyst: {analyst_email}")

    def log_fetching_result(self, analyst_email: str, event_count: int):
        """Registra resultado de fetch."""
        self.logger.info(f"  → Found {event_count} events for {analyst_email}")
        self.metrics["total_fetched"] += event_count

        if analyst_email not in self.metrics["analysts_summary"]:
            self.metrics["analysts_summary"][analyst_email] = {
                "fetched": 0,
                "matched": 0,
                "new": 0,
                "updated": 0
            }
        self.metrics["analysts_summary"][analyst_email]["fetched"] = event_count

    def log_processing_event(self, event_id: str, summary: str):
        """Registra procesamiento de un evento."""
        self.logger.debug(f"Processing event: {event_id} - {summary[:50]}")

    def log_match_result(self, event_id: str, match_status: str, client_name: str = None, confidence: float = 0.0):
        """Registra resultado de matching."""
        if client_name:
            self.logger.debug(f"  Match: {match_status} → {client_name} ({confidence:.0%})")
        else:
            self.logger.debug(f"  Match: {match_status}")

    def log_db_operation(self, operation: str, event_id: str, is_new: bool):
        """Registra operación de base de datos."""
        if is_new:
            self.logger.debug(f"  DB: INSERT {event_id}")
            self.metrics["new_appointments"] += 1
        else:
            # Aquí deberíamos comparar si realmente cambió algo
            self.logger.debug(f"  DB: UPDATE {event_id}")
            self.metrics["updated_appointments"] += 1

    def log_sync_operation(self, group_name: str, source_client: str, target_count: int, new_count: int):
        """Registra operación de sincronización de clínicas."""
        self.logger.info(f"Syncing {group_name}: {source_client} → {target_count} targets")
        self.logger.info(f"  → {new_count} new appointments synchronized")

        if group_name not in self.metrics["sync_summary"]:
            self.metrics["sync_summary"][group_name] = {
                "source": source_client,
                "targets": target_count,
                "new_synced": 0
            }
        self.metrics["sync_summary"][group_name]["new_synced"] += new_count

    def log_error(self, error_msg: str, exception: Exception = None):
        """Registra un error."""
        self.logger.error(f"ERROR: {error_msg}")
        if exception:
            self.logger.exception(exception)
        self.metrics["errors"].append({
            "timestamp": datetime.now().isoformat(),
            "message": error_msg,
            "exception": str(exception) if exception else None
        })

    def update_metrics(self, **kwargs):
        """Actualiza métricas personalizadas."""
        for key, value in kwargs.items():
            if key in self.metrics:
                self.metrics[key] = value

    def _log_summary(self):
        """Imprime resumen detallado de la ejecución."""
        self.logger.info("")
        self.logger.info("=" * 80)
        self.logger.info("EXECUTION SUMMARY")
        self.logger.info("=" * 80)
        self.logger.info(f"Execution ID:        {self.metrics['execution_id']}")
        self.logger.info(f"Duration:            {self.metrics['duration_seconds']:.2f} seconds")
        self.logger.info("")
        self.logger.info("EVENTS PROCESSED:")
        self.logger.info(f"  Total Fetched:     {self.metrics['total_fetched']}")
        self.logger.info(f"  Total Processed:   {self.metrics['total_processed']}")
        self.logger.info(f"  Total Matched:     {self.metrics['total_matched']}")
        self.logger.info("")
        self.logger.info("DATABASE OPERATIONS:")
        self.logger.info(f"  New appointments:      {self.metrics['new_appointments']}")
        self.logger.info(f"  Updated appointments:  {self.metrics['updated_appointments']}")
        self.logger.info(f"  Unchanged:             {self.metrics['unchanged_appointments']}")
        self.logger.info("")

        # Resumen por analista
        if self.metrics["analysts_summary"]:
            self.logger.info("ANALYST BREAKDOWN:")
            for analyst, stats in self.metrics["analysts_summary"].items():
                analyst_name = analyst.split('@')[0]
                self.logger.info(f"  {analyst_name}:")
                self.logger.info(f"    Fetched: {stats['fetched']}, Matched: {stats.get('matched', 0)}")

        # Resumen de sincronización
        if self.metrics["sync_summary"]:
            self.logger.info("")
            self.logger.info("CLINIC SYNCHRONIZATION:")
            total_synced = sum(s["new_synced"] for s in self.metrics["sync_summary"].values())
            self.logger.info(f"  Total synced appointments: {total_synced}")
            for group, stats in self.metrics["sync_summary"].items():
                self.logger.info(f"    {group}: {stats['new_synced']} new")

        # Errores
        if self.metrics["errors"]:
            self.logger.info("")
            self.logger.info("ERRORS ENCOUNTERED:")
            for error in self.metrics["errors"]:
                self.logger.error(f"  {error['timestamp']}: {error['message']}")

    def _save_summary_json(self):
        """Guarda el resumen en formato JSON."""
        summary_file = os.path.join(
            self.log_dir,
            f"etl_summary_{self.metrics['execution_id']}.json"
        )

        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(self.metrics, f, indent=2, ensure_ascii=False)

        self.logger.info(f"Summary saved to: {summary_file}")

    def info(self, msg: str):
        """Alias para logger.info"""
        self.logger.info(msg)

    def debug(self, msg: str):
        """Alias para logger.debug"""
        self.logger.debug(msg)

    def warning(self, msg: str):
        """Alias para logger.warning"""
        self.logger.warning(msg)

    def error(self, msg: str):
        """Alias para logger.error"""
        self.logger.error(msg)
