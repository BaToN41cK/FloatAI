# -*- coding: utf-8 -*-
"""
Корневой запускатель для Windows.
Служит совместимостью с командами и двойным кликом из проводника.
Перенаправляет запуск в scripts/start_chat.py.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(ROOT, "scripts", "start_chat.py")

if not os.path.isfile(TARGET):
    sys.exit(f"Не найден файл запуска: {TARGET}")

subprocess.Popen([sys.executable, TARGET], cwd=ROOT, creationflags=0)
