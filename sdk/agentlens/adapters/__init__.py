"""Framework Adapters — translate framework-specific activity into unified Events."""

from agentlens.adapters.base import BaseAdapter
from agentlens.adapters.manager import AdapterManager
from agentlens.adapters.openai import OpenAIAdapter

__all__ = ["BaseAdapter", "AdapterManager", "OpenAIAdapter"]
