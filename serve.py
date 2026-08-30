#!/usr/bin/env python3
"""Sert public_html/ en local sur http://127.0.0.1:7722 (évite les blocages CORS)."""
import http.server
import os
from pathlib import Path

os.chdir(Path(__file__).resolve().parent / 'public_html')
http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=7722, bind='127.0.0.1')
