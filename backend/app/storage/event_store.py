"""
Event storage with a modular backend.

Default backend: in-memory (thread-safe ring buffer + index). The architecture
keeps a clean `EventStore` interface so a persistent backend can be added.

Optional backend: MongoDB Atlas. When STORAGE_BACKEND=mongo and MONGO_URI is
set, every analysed event is also written through to a MongoDB collection
(write-through). Live dashboard queries and stats still read from the in-memory
buffer so the demo stays fast and reliable; Mongo provides durable persistence.
"""
from __future__ import annotations

import logging
import threading
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

logger = logging.getLogger("intelliapi.storage")


class EventStore:
    """In-memory event store with thread-safe access and aggregate stats."""

    def __init__(self, max_events: int = 2000):
        self._events: deque = deque(maxlen=max_events)
        self._by_id: dict[str, dict] = {}
        self._lock = threading.Lock()
        self._mongo = None

    # ---- backends --------------------------------------------------------
    def init_mongo(self) -> None:
        """Optionally connect to MongoDB Atlas for write-through persistence."""
        if settings.storage_backend != "mongo" or not settings.mongo_uri:
            return
        if "<" in settings.mongo_uri:
            logger.warning("MONGO_URI looks like a placeholder - skipping Mongo backend.")
            return
        try:
            from pymongo import MongoClient
            self._mongo = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
            db = self._mongo[settings.mongo_db]
            self._mongo_coll = db[settings.mongo_collection]
            self._mongo_coll.create_index("event_id", unique=True)
            logger.info("MongoDB Atlas connected (db=%s, coll=%s)",
                        settings.mongo_db, settings.mongo_collection)
        except Exception as e:
            logger.warning("MongoDB connection failed, continuing in-memory only: %s", e)
            self._mongo = None

    # ---- core operations --------------------------------------------------
    def add(self, event: dict) -> None:
        with self._lock:
            self._events.append(event)
            self._by_id[event["event_id"]] = event
        # write-through to Mongo (best-effort, never block inference)
        if self._mongo is not None:
            try:
                self._mongo_coll.update_one(
                    {"event_id": event["event_id"]},
                    {"$set": dict(event)},
                    upsert=True,
                )
            except Exception as e:
                logger.warning("Mongo write-through failed: %s", e)

    def recent(self, limit: int = 50) -> list[dict]:
        with self._lock:
            items = list(self._events)
        items.reverse()  # newest first
        return items[:limit]

    def get(self, event_id: str) -> Optional[dict]:
        with self._lock:
            return self._by_id.get(event_id)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()
            self._by_id.clear()

    def all(self) -> list[dict]:
        with self._lock:
            return list(self._events)

    # ---- aggregate stats --------------------------------------------------
    def stats(self) -> dict:
        with self._lock:
            events = list(self._events)
        n = len(events)
        if n == 0:
            return {
                "total_requests": 0, "detected_attacks": 0, "allowed_requests": 0,
                "monitored_requests": 0, "blocked_requests": 0,
                "attack_rate": 0.0, "avg_inference_latency_ms": 0.0,
                "attack_type_distribution": {}, "decision_distribution": {},
                "risk_distribution": {},
            }

        detected = sum(1 for e in events if e.get("prediction") == "ATTACK")
        allowed = sum(1 for e in events if e.get("decision") == "ALLOW")
        monitored = sum(1 for e in events if e.get("decision") == "MONITOR")
        blocked = sum(1 for e in events if e.get("decision") == "BLOCK")
        latencies = [e.get("inference_latency_ms", 0.0) for e in events]

        attack_type_dist: dict[str, int] = {}
        decision_dist: dict[str, int] = {}
        risk_dist: dict[str, int] = {}
        for e in events:
            at = e.get("attack_type") or "none"
            attack_type_dist[at] = attack_type_dist.get(at, 0) + 1
            d = e.get("decision") or "UNKNOWN"
            decision_dist[d] = decision_dist.get(d, 0) + 1
            r = e.get("risk_level") or "UNKNOWN"
            risk_dist[r] = risk_dist.get(r, 0) + 1

        return {
            "total_requests": n,
            "detected_attacks": detected,
            "allowed_requests": allowed,
            "monitored_requests": monitored,
            "blocked_requests": blocked,
            "attack_rate": round(detected / n, 4),
            "avg_inference_latency_ms": round(sum(latencies) / n, 3),
            "attack_type_distribution": attack_type_dist,
            "decision_distribution": decision_dist,
            "risk_distribution": risk_dist,
        }


# Module-level singleton.
_store: Optional[EventStore] = None


def get_store() -> EventStore:
    global _store
    if _store is None:
        _store = EventStore(max_events=settings.max_events_stored)
        _store.init_mongo()
    return _store
