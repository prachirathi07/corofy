"""
Comprehensive logging configuration with structured logging,
log rotation, and request ID tracking.
"""

import logging
import logging.handlers
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
import uuid
from contextvars import ContextVar

# Context variable for request ID tracking
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)

class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs logs in structured JSON format.
    Includes timestamp, level, module, message, and request ID.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        # Get request ID from context
        request_id = request_id_var.get()
        
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add request ID if available
        if request_id:
            log_data["request_id"] = request_id
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, 'extra_data'):
            log_data["extra"] = record.extra_data
        
        return json.dumps(log_data)


class ColoredConsoleFormatter(logging.Formatter):
    """
    Colored console formatter for better readability in development.
    """
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }
    
    def format(self, record: logging.LogRecord) -> str:
        # Get color for log level
        color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        reset = self.COLORS['RESET']
        
        # Format timestamp
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        
        # Get request ID
        request_id = request_id_var.get()
        request_id_str = f" [{request_id[:8]}]" if request_id else ""
        
        # Format message
        message = record.getMessage()
        
        # Build log line
        log_line = (
            f"{color}{record.levelname:8}{reset} "
            f"{timestamp} "
            f"{record.name:30.30} "
            f"{request_id_str:10} "
            f"{message}"
        )
        
        # Add exception if present
        if record.exc_info:
            log_line += "\n" + self.formatException(record.exc_info)
        
        return log_line


def setup_logging(
    log_level: str = "INFO",
    log_dir: str = "logs",
    enable_file_logging: bool = True,
    enable_json_logging: bool = False
):
    """
    Setup comprehensive logging configuration.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: Directory for log files
        enable_file_logging: Enable file logging with rotation
        enable_json_logging: Use JSON format for file logs
    """
    
    # Create logs directory if it doesn't exist
    if enable_file_logging:
        Path(log_dir).mkdir(parents=True, exist_ok=True)
    
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # Console handler (colored for development)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(ColoredConsoleFormatter())
    root_logger.addHandler(console_handler)
    
    # File handler with rotation (if enabled)
    if enable_file_logging:
        # Main log file (all logs)
        file_handler = logging.handlers.RotatingFileHandler(
            filename=f"{log_dir}/app.log",
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        
        if enable_json_logging:
            file_handler.setFormatter(StructuredFormatter())
        else:
            file_handler.setFormatter(logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            ))
        
        root_logger.addHandler(file_handler)
        
        # Error log file (errors only)
        error_handler = logging.handlers.RotatingFileHandler(
            filename=f"{log_dir}/error.log",
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        
        if enable_json_logging:
            error_handler.setFormatter(StructuredFormatter())
        else:
            error_handler.setFormatter(logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            ))
        
        root_logger.addHandler(error_handler)
    
    # Set specific log levels for noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    
    logging.info(f"🔧 Logging configured: level={log_level}, file_logging={enable_file_logging}")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given name.
    
    Args:
        name: Logger name (usually __name__)
    
    Returns:
        Logger instance
    """
    return logging.getLogger(name)


def set_request_id(request_id: Optional[str] = None):
    """
    Set request ID for the current context.
    
    Args:
        request_id: Request ID (generates new UUID if None)
    """
    if request_id is None:
        request_id = str(uuid.uuid4())
    request_id_var.set(request_id)
    return request_id


def get_request_id() -> Optional[str]:
    """Get current request ID from context"""
    return request_id_var.get()


def clear_request_id():
    """Clear request ID from context"""
    request_id_var.set(None)


class LoggerAdapter(logging.LoggerAdapter):
    """
    Logger adapter that adds extra context to log messages.
    """
    
    def process(self, msg, kwargs):
        # Add request ID to extra data
        request_id = get_request_id()
        if request_id:
            if 'extra' not in kwargs:
                kwargs['extra'] = {}
            kwargs['extra']['request_id'] = request_id
        
        return msg, kwargs
