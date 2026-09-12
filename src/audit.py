"""In-memory SHA-256 tamper-evident provenance log demonstration (src/audit.py).

The chain provides an application-level in-process tamper-evidence demonstration.
It is thread-safe within the active process, but not durable across application restarts,
not cryptographically signed by private PKI hardware tokens, not externally anchored to
an independent ledger, and not proof that user-supplied provenance labels are authentic.
Provenance layering: data objects (see src/adapter.py) may carry the broader
data-level tag set, including the '[unverified]' default assigned to raw inputs
before validation. This ledger, however, only certifies events under the strict
4-tier taxonomy below. Data must be classified as measured, model, synthetic,
or calibrated before it can enter the chain; 'unverified' data is rejected so
that no uncertified claim is ever hash-chained.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple, Iterator, Union
import collections
import copy
import hashlib
import json
import threading
import time
import datetime
import numpy as np

# Canonical 4-tier provenance taxonomy for ledger certification (Requirement R5).
# Data-level defaults like '[unverified]' (see src/adapter.py) are intentionally
# excluded: unclassified data must never enter the hash-chained record.
PROVENANCE_TAGS = {"[measured]", "[model]", "[synthetic]", "[calibrated]"}


def canonical_json_serializer(obj: Any) -> Any:
    """Deterministic JSON serializer for numpy arrays, scalar types, datetimes, and custom objects."""
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    elif isinstance(obj, (np.floating, float)):
        if np.isnan(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    elif isinstance(obj, bytes):
        return obj.decode("utf-8")
    elif hasattr(obj, "to_dict"):
        return obj.to_dict()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def compute_canonical_json(data: Dict[str, Any]) -> str:
    """Produces deterministic canonical compact JSON string with sorted keys."""
    return json.dumps(
        data,
        default=canonical_json_serializer,
        sort_keys=True,
        separators=(",", ":"),
    )


@dataclass
class AuditBlock:
    """Hash-chained audit block used for tamper-evidence demonstrations."""
    index: int
    timestamp: float
    event_type: str
    provenance_tag: str
    payload: Dict[str, Any]
    prev_hash: str
    block_hash: str = field(init=False)
    timestamp_iso: str = field(init=False)

    def __post_init__(self):
        if self.provenance_tag not in PROVENANCE_TAGS:
            raise ValueError(f"Invalid provenance tag '{self.provenance_tag}'. Must be one of {PROVENANCE_TAGS}")
        self.timestamp_iso = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(self.timestamp))
        self.block_hash = self.compute_hash()

    def compute_hash(self) -> str:
        """Calculates deterministic SHA-256 hash across canonical block contents."""
        block_dict = {
            "index": self.index,
            "timestamp": round(self.timestamp, 4),
            "event_type": self.event_type,
            "provenance_tag": self.provenance_tag,
            "payload": self.payload,
            "prev_hash": self.prev_hash,
        }
        canonical_str = compute_canonical_json(block_dict)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def is_hash_valid(self) -> bool:
        """Validates that stored block_hash matches recomputed hash."""
        return self.block_hash == self.compute_hash()

    @property
    def event_hash(self) -> str:
        return self.block_hash

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "timestamp_iso": self.timestamp_iso,
            "event_type": self.event_type,
            "provenance_tag": self.provenance_tag,
            "payload": self.payload,
            "prev_hash": self.prev_hash,
            "block_hash": self.block_hash,
            "event_hash": self.block_hash,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditBlock":
        blk = cls(
            index=data["index"],
            timestamp=data["timestamp"],
            event_type=data["event_type"],
            provenance_tag=data["provenance_tag"],
            payload=data["payload"],
            prev_hash=data["prev_hash"],
        )
        if "block_hash" in data:
            blk.block_hash = data["block_hash"]
        return blk


# Compatibility alias
AuditEvent = AuditBlock


class AuditLedger:
    """
    In-memory SHA-256 chain recording advisory-model events.
    """

    GENESIS_HASH = "0" * 64

    def __init__(
        self,
        well_id: str = "OIL-BAGHEWALA-EOR-V2",
        auto_genesis: bool = True,
        genesis_payload: Optional[Dict[str, Any]] = None,
    ):
        self.well_id = str(well_id)
        self.chain: List[AuditBlock] = []
        self._lock = threading.RLock()
        if auto_genesis:
            self._create_genesis_block(genesis_payload)

    def _create_genesis_block(self, custom_payload: Optional[Dict[str, Any]] = None) -> None:
        """Initializes the root Genesis block."""
        payload = custom_payload if custom_payload is not None else {
            "well_id": self.well_id,
            "system": "VECTROSYNC_ENTERPRISE_TWIN",
            "status": "ONLINE",
            "asset_attribution": "Asset: Well #14, Baghewala Heavy Oil Asset, Bikaner-Nagaur Basin, Rajasthan | Operator: Oil India Limited",
        }
        genesis = AuditBlock(
            index=0,
            timestamp=time.time(),
            event_type="SYSTEM_INITIALIZATION",
            provenance_tag="[model]",
            payload=payload,
            prev_hash=self.GENESIS_HASH,
        )
        self.chain.append(genesis)

    def record_event(
        self,
        event_type: str,
        provenance_tag: str,
        payload: Dict[str, Any],
        timestamp: Optional[float] = None,
    ) -> AuditBlock:
        """Appends a new verified event block to the ledger."""
        ts = time.time() if timestamp is None else float(timestamp)
        if not np.isfinite(ts):
            raise ValueError("Audit timestamp must be finite.")
        with self._lock:
            prev_hash = self.chain[-1].block_hash if self.chain else self.GENESIS_HASH
            block = AuditBlock(
                index=len(self.chain),
                timestamp=ts,
                event_type=str(event_type),
                provenance_tag=provenance_tag,
                payload=copy.deepcopy(payload),
                prev_hash=prev_hash,
            )
            self.chain.append(block)
            return block

    def verify_block(self, block_idx: int) -> Tuple[bool, Optional[str]]:
        """Verifies an individual block by index."""
        if block_idx < 0 or block_idx >= len(self.chain):
            return False, f"Block index {block_idx} out of range (0 to {len(self.chain) - 1})."
        block = self.chain[block_idx]
        if not block.is_hash_valid():
            return False, f"Block {block_idx} hash mismatch."
        if block_idx == 0:
            if block.prev_hash != self.GENESIS_HASH:
                return False, "Genesis block points to invalid previous hash."
        else:
            prev_block = self.chain[block_idx - 1]
            if block.prev_hash != prev_block.block_hash:
                return False, f"Block {block_idx} does not link to previous block {block_idx - 1}."
        return True, None

    def verify_chain(self) -> Tuple[bool, Optional[str]]:
        """
        Verifies cryptographic continuity and block hash validity across entire chain.
        """
        with self._lock:
            if len(self.chain) == 0:
                return False, "Ledger is empty; genesis block is missing."

            if self.chain[0].index != 0 or self.chain[0].prev_hash != self.GENESIS_HASH:
                return False, "Corrupted Genesis block 0 header."
            if not self.chain[0].is_hash_valid():
                return False, "Genesis block 0 self-hash mismatch."

            for i in range(1, len(self.chain)):
                curr = self.chain[i]
                prev = self.chain[i - 1]

                if curr.index != i:
                    return False, f"Broken index sequence at block {i}."
                if curr.prev_hash != prev.block_hash:
                    return False, f"Broken hash chain link at block {i} (points to incorrect parent)."
                if not curr.is_hash_valid():
                    return False, f"Tampered data detected in block {i}."

            return True, None

    def verify_chain_integrity(self) -> Tuple[bool, Optional[str]]:
        return self.verify_chain()

    def filter_by_event_type(self, event_type: str) -> List[AuditBlock]:
        return [b for b in self.chain if b.event_type == event_type]

    def filter_by_provenance(self, provenance_tag: str) -> List[AuditBlock]:
        return [b for b in self.chain if b.provenance_tag == provenance_tag]

    def search_payload_key(self, key: str, value: Any) -> List[AuditBlock]:
        return [b for b in self.chain if b.payload.get(key) == value]

    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [blk.to_dict() for blk in reversed(self.chain[-limit:])]

    def get_recent_events_table(self, limit: int = 15) -> List[Dict[str, Any]]:
        events = []
        for blk in reversed(self.chain[-limit:]):
            d = blk.to_dict()
            d["prev_hash_short"] = blk.prev_hash[:10] + "..."
            d["event_hash_short"] = blk.block_hash[:12] + "..."
            events.append(d)
        return events

    def export_summary(self) -> Dict[str, Any]:
        is_valid, _ = self.verify_chain()
        type_counts = collections.Counter(b.event_type for b in self.chain)
        prov_counts = collections.Counter(b.provenance_tag for b in self.chain)
        return {
            "well_id": self.well_id,
            "total_blocks": len(self.chain),
            "is_tamper_free": is_valid,
            "verification_status": "PASSED" if is_valid else "FAILED",
            "event_type_breakdown": dict(type_counts),
            "provenance_breakdown": dict(prov_counts),
        }

    def export_json(self, indent: int = 2) -> str:
        return json.dumps({
            "well_id": self.well_id,
            "chain": [blk.to_dict() for blk in self.chain],
        }, indent=indent)

    def to_json(self, indent: int = 2) -> str:
        return self.export_json(indent=indent)

    def import_json(self, json_str: str) -> None:
        data = json.loads(json_str)
        self.well_id = data.get("well_id", self.well_id)
        chain_blocks = []
        for blk_data in data["chain"]:
            chain_blocks.append(AuditBlock.from_dict(blk_data))
        with self._lock:
            self.chain = chain_blocks
        is_valid, err = self.verify_chain()
        if not is_valid:
            raise ValueError(f"Imported ledger is cryptographically invalid: {err}")

    @classmethod
    def from_json(cls, json_str: str, verify: bool = True) -> "AuditLedger":
        ledger = cls(auto_genesis=False)
        ledger.import_json(json_str)
        if verify:
            is_valid, err = ledger.verify_chain()
            if not is_valid:
                raise ValueError(f"Ledger verification failed: {err}")
        return ledger

    def __len__(self) -> int:
        return len(self.chain)

    def __getitem__(self, item: int) -> AuditBlock:
        return self.chain[item]

    def __iter__(self) -> Iterator[AuditBlock]:
        return iter(self.chain)


# Compatibility alias
ProvenanceAuditLedger = AuditLedger
DEFAULT_AUDIT_LEDGER = AuditLedger()
