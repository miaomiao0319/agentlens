"""Tests for AdapterManager."""

import pytest
from agentlens.adapters.base import BaseAdapter
from agentlens.adapters.manager import AdapterManager
from agentlens.event_bus import EventBus
from agentlens.session import SessionManager


class FakeAdapter(BaseAdapter):
    """Test double that tracks setup/teardown calls."""

    def __init__(self, name: str = "fake"):
        self._name = name
        self.setup_count = 0
        self.teardown_count = 0
        self._active = False

    def setup(self, event_bus, session_manager):
        self.setup_count += 1
        self._active = True

    def teardown(self):
        self.teardown_count += 1
        self._active = False

    @property
    def framework_name(self) -> str:
        return self._name

    @property
    def is_active(self) -> bool:
        return self._active


class TestAdapterManager:
    def test_register(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)
        am.register(FakeAdapter("test"))

        assert am.registered_count == 1
        assert "test" in am.list_registered()

    def test_register_replaces_existing(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        a1 = FakeAdapter("test")
        a2 = FakeAdapter("test")
        am.register(a1)
        am.register(a2)

        assert am.registered_count == 1

    def test_activate_calls_setup(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        adapter = FakeAdapter("test")
        am.register(adapter)
        am.activate("test")

        assert adapter.setup_count == 1
        assert am.is_active("test")

    def test_activate_unregistered_raises(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        with pytest.raises(KeyError):
            am.activate("nonexistent")

    def test_deactivate_calls_teardown(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        adapter = FakeAdapter("test")
        am.register(adapter)
        am.activate("test")
        am.deactivate("test")

        assert adapter.teardown_count == 1
        assert not am.is_active("test")

    def test_deactivate_inactive_is_noop(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        adapter = FakeAdapter("test")
        am.register(adapter)
        am.deactivate("test")  # no-op

        assert adapter.teardown_count == 0

    def test_unregister_deactivates_first(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        adapter = FakeAdapter("test")
        am.register(adapter)
        am.activate("test")
        am.unregister("test")

        assert adapter.teardown_count == 1
        assert am.registered_count == 0

    def test_deactivate_all(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        a1 = FakeAdapter("a")
        a2 = FakeAdapter("b")
        am.register(a1)
        am.register(a2)
        am.activate("a")
        am.activate("b")
        am.deactivate_all()

        assert a1.teardown_count == 1
        assert a2.teardown_count == 1
        assert am.active_count == 0

    def test_double_activate_is_noop(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        adapter = FakeAdapter("test")
        am.register(adapter)
        am.activate("test")
        am.activate("test")  # second time

        assert adapter.setup_count == 1  # not 2

    def test_get_active(self):
        bus = EventBus()
        mgr = SessionManager()
        am = AdapterManager(bus, mgr)

        am.register(FakeAdapter("a"))
        am.register(FakeAdapter("b"))
        am.activate("b")
        am.activate("a")

        assert am.get_active() == ["a", "b"]
