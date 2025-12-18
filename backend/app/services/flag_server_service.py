import base64
import logging
from typing import Dict, Optional, Tuple

from bson import ObjectId
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key

from app.core.config import settings
from app.schemas.challenge import ChallengeMode

logger = logging.getLogger(__name__)


class FlagServerService:
    """
    Minimal secure flag server helper:
    - Stores challenge/team public keys (short-lived, in-memory)
    - Encrypts flags with RSA-OAEP for delivery to challenge containers/VMs
    """

    def __init__(self) -> None:
        # cache: (challenge_id, team_id, flag_name) -> pem public key string
        self._public_keys: Dict[Tuple[str, str, str], str] = {}
        self._challenge_collection = None

    async def _get_challenges(self):
        if self._challenge_collection is None:
            from app.db.init_db import get_database
            db = await get_database()
            if db is None:
                raise RuntimeError("Database connection failed")
            self._challenge_collection = db["challenges"]
        return self._challenge_collection

    def register_public_key(self, challenge_id: str, team_id: str, flag_name: str, public_key_pem: str) -> None:
        key = (challenge_id, team_id, flag_name or "default")
        self._public_keys[key] = public_key_pem
        logger.info(f"Registered public key for challenge={challenge_id}, team={team_id}, flag={flag_name}")

    async def _get_flag_value(self, challenge_id: str, flag_name: str) -> str:
        challenges = await self._get_challenges()
        challenge = await challenges.find_one({"_id": ObjectId(challenge_id)})
        if not challenge:
            raise ValueError("Challenge not found")

        mode = challenge.get("config", {}).get("mode") or challenge.get("challenge_category")
        flags_list = challenge.get("flags") or challenge.get("config", {}).get("flags") or []

        if mode == ChallengeMode.MULTI_FLAG or mode == "multi_flag":
            for flag_item in flags_list:
                if (flag_item.get("name") or "default") == flag_name:
                    value = flag_item.get("value")
                    if value:
                        return str(value)
            raise ValueError(f"Flag {flag_name} not found for challenge")

        # single-flag fallback
        if challenge.get("flag"):
            return str(challenge["flag"])

        if flags_list:
            value = flags_list[0].get("value")
            if value:
                return str(value)

        raise ValueError("No flag configured")

    def _encrypt_with_public_key(self, public_key_pem: str, plaintext: str) -> str:
        public_key = load_pem_public_key(public_key_pem.encode("utf-8"))
        ciphertext = public_key.encrypt(
            plaintext.encode("utf-8"),
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
        )
        return base64.b64encode(ciphertext).decode("utf-8")

    async def get_encrypted_flag(self, challenge_id: str, team_id: str, flag_name: str) -> str:
        key = (challenge_id, team_id, flag_name or "default")
        if key not in self._public_keys:
            raise ValueError("No public key registered for this challenge/team/flag")

        flag_value = await self._get_flag_value(challenge_id, flag_name or "default")
        public_key_pem = self._public_keys[key]
        encrypted = self._encrypt_with_public_key(public_key_pem, flag_value)
        return encrypted


flag_server_service = FlagServerService()
