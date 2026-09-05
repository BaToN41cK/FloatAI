' Запуск AI Chat без консольного окна и без привязки к терминалу.
' Двойной клик по этому файлу — приложение живёт независимо.
' Приоритет: упакованный exe из dist\, затем dev-режим (electron.exe).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
' Скрипт лежит в scripts\ — корень проекта на уровень выше
dir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
packaged = dir & "\dist\AI Chat Overlay.exe"
exe = dir & "\node_modules\electron\dist\electron.exe"
sh.CurrentDirectory = dir
If fso.FileExists(packaged) Then
  sh.Run """" & packaged & """", 0, False
ElseIf fso.FileExists(exe) Then
  ' > NUL 2>&1: electron.exe (dev) — консольное приложение; без перенаправления
  ' stdout/stderr остаётся «мёртвой трубой» и любой console.* роняет его с EPIPE.
  q = Chr(34)
  sh.Run "cmd /c " & q & q & exe & q & " " & q & dir & q & " > NUL 2>&1" & q, 0, False
Else
  MsgBox "Не найден ни dist\AI Chat Overlay.exe, ни node_modules\electron — сначала выполните npm install или npm run dist.", 16, "AI Chat"
End If
