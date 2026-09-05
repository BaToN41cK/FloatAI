# -*- coding: utf-8 -*-
"""
Лаунчер AI Chat Overlay без окна cmd.

Запуск:
  - двойной клик (если .py связан с pythonw.exe), или
  > pythonw start_chat.py   (без консоли)
  > python start_chat.py    (консоль закроется сама, приложение останется)

Просто стартует electron-приложение отвязанным процессом и завершается.
"""
import os
import subprocess
import sys

# Скрипт лежит в scripts\ — корень проекта на уровень выше
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VBS = os.path.join(BASE_DIR, "scripts", "start-ai-chat.vbs")
PACKAGED = os.path.join(BASE_DIR, "dist", "AI Chat Overlay.exe")
EXE = os.path.join(BASE_DIR, "node_modules", "electron", "dist", "electron.exe")

DETACHED = 0x00000008          # DETACHED_PROCESS
NO_WINDOW = 0x08000000         # CREATE_NO_WINDOW

# Флаги: без окна консоли + отвязка от родительского процесса
flags = DETACHED | NO_WINDOW

if os.path.isfile(PACKAGED):
    # Приоритет — упакованное приложение (npm run dist)
    subprocess.Popen([PACKAGED], cwd=BASE_DIR, creationflags=flags, close_fds=True)
elif os.path.isfile(EXE):
    # Dev-режим: electron.exe напрямую, скрыто и независимо
    subprocess.Popen(
        [EXE, BASE_DIR],
        cwd=BASE_DIR,
        creationflags=flags,
        close_fds=True,
    )
elif os.path.isfile(VBS):
    # Fallback: скрытый запуск через wscript (VBS сам всё делает)
    subprocess.Popen(
        ["wscript.exe", VBS],
        cwd=BASE_DIR,
        creationflags=flags,
        close_fds=True,
    )
else:
    sys.exit("Не найден ни dist\\AI Chat Overlay.exe, ни electron.exe — сначала выполните: npm install или npm run dist")
