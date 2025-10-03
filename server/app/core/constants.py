from enum import Enum

class EmailProvider(str, Enum):
    """
    Defines the supported email providers.
    Using an Enum makes the code more robust and readable.
    """
    GMAIL = "gmail"
    YAHOO = "yahoo"