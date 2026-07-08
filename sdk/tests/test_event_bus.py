"""Tests for the EventBus."""

import pytest
from agentlens.event_bus import EventBus
from agentlens.schema import BaseEvent, EventType, EventStatus, CustomEvent


class TestEventBus:
    def test_subscribe_and_publish(self):
        bus = EventBus()
        received: list[BaseEvent] = []

        def handler(event: BaseEvent) -> None:
            received.append(event)

        bus.subscribe(handler)
        event = CustomEvent(name="test", data={"x": 1})
        bus.publish(event)

        assert len(received) == 1
        assert received[0] is event
        assert received[0].name == "test"

    def test_multiple_subscribers(self):
        bus = EventBus()
        results: list[str] = []

        bus.subscribe(lambda e: results.append("a"))
        bus.subscribe(lambda e: results.append("b"))

        bus.publish(CustomEvent(name="x"))

        assert results == ["a", "b"]

    def test_unsubscribe(self):
        bus = EventBus()
        received: list[BaseEvent] = []

        def handler(event: BaseEvent) -> None:
            received.append(event)

        bus.subscribe(handler)
        bus.publish(CustomEvent(name="a"))
        bus.unsubscribe(handler)
        bus.publish(CustomEvent(name="b"))

        assert len(received) == 1

    def test_unsubscribe_not_registered(self):
        bus = EventBus()

        def handler(event: BaseEvent) -> None:
            pass

        # Should not raise
        bus.unsubscribe(handler)

    def test_subscriber_count(self):
        bus = EventBus()
        assert bus.subscriber_count == 0

        bus.subscribe(lambda e: None)
        assert bus.subscriber_count == 1

        bus.subscribe(lambda e: None)
        assert bus.subscriber_count == 2

    def test_broken_subscriber_does_not_break_others(self):
        bus = EventBus()
        good: list[BaseEvent] = []

        def bad(event: BaseEvent) -> None:
            raise RuntimeError("boom")

        def ok(event: BaseEvent) -> None:
            good.append(event)

        bus.subscribe(bad)
        bus.subscribe(ok)
        bus.publish(CustomEvent(name="test"))

        assert len(good) == 1

    def test_same_callback_not_duplicated(self):
        bus = EventBus()
        received: list[BaseEvent] = []

        def handler(event: BaseEvent) -> None:
            received.append(event)

        bus.subscribe(handler)
        bus.subscribe(handler)  # duplicate
        bus.publish(CustomEvent(name="x"))

        assert len(received) == 1  # not 2

    def test_no_subscribers_does_not_raise(self):
        bus = EventBus()
        bus.publish(CustomEvent(name="x"))  # no crash

    def test_thread_safety_publish_and_subscribe(self):
        import threading

        bus = EventBus()
        received: list[BaseEvent] = []
        errors: list[Exception] = []

        def handler(event: BaseEvent) -> None:
            received.append(event)

        bus.subscribe(handler)

        def publish_n(n: int) -> None:
            for i in range(n):
                try:
                    bus.publish(CustomEvent(name=f"t{i}"))
                except Exception as exc:
                    errors.append(exc)

        threads = [threading.Thread(target=publish_n, args=(50,)) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(received) == 200
        assert len(errors) == 0
