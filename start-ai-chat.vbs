' Запуск AI Chat без консольного окна и без привязки к терминалу.
' Корневой файл нужен для совместимости с двойным кликом из проводника.
' Он передаёт управление в scripts\start-ai-chat.vbs.

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
script = root & "\scripts\start-ai-chat.vbs"

If fso.FileExists(script) Then
  sh.Run """" & script & """", 0, False
Else
  MsgBox "Не найден файл сценария: " & script & vbCrLf & "Проверьте, что папка scripts существует.", 16, "AI Chat"
End If
