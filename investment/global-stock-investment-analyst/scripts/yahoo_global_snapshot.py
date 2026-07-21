#!/usr/bin/env python3
"""Compatibility wrapper. Use global_market_snapshot.py for current sources."""
import os
import runpy

runpy.run_path(os.path.join(os.path.dirname(__file__), "global_market_snapshot.py"), run_name="__main__")
