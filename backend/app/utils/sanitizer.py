import html
import re
from typing import Any


def sanitize_input(value: Any) -> Any:
    """
    Basic input sanitization to prevent XSS / injection:
    - Escape HTML characters
    - Remove <script> tags
    - Return unchanged if not a string
    """
    if not isinstance(value, str):
        return value

    # Escape HTML special characters
    clean = html.escape(value)

    # Remove <script>...</script> blocks completely
    clean = re.sub(r"(?i)<script.*?>.*?</script>", "", clean)

    return clean


def sanitize_dict(data: dict) -> dict:
    """
    Recursively sanitize all string values in a dictionary.
    """
    sanitized = {}
    for key, val in data.items():
        if isinstance(val, str):
            sanitized[key] = sanitize_input(val)
        elif isinstance(val, dict):
            sanitized[key] = sanitize_dict(val)
        elif isinstance(val, list):
            sanitized[key] = [sanitize_input(v) if isinstance(v, str) else v for v in val]
        else:
            sanitized[key] = val
    return sanitized
