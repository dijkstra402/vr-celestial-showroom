@echo off
chcp 65001 >nul
echo ==========================================================
echo [1/3] 正在关闭已有虚幻引擎进程...
echo ==========================================================
taskkill /F /IM UnrealEditor.exe >nul 2>&1
taskkill /F /IM UnrealEditor-Cmd.exe >nul 2>&1

set "PROJ_DIR=%~dp0"
set "UPROJECT=%PROJ_DIR%毕设1.uproject"
if not exist "%UPROJECT%" (
    for %%f in ("%PROJ_DIR%*.uproject") do set "UPROJECT=%%~ff"
)

echo.
echo >>> 当前毕设工程: %UPROJECT%

set "UE_ED=C:\Program Files\Epic Games\UE_5.1\Engine\Binaries\Win64\UnrealEditor.exe"
if not exist "%UE_ED%" set "UE_ED=D:\Program Files\Epic Games\UE_5.1\Engine\Binaries\Win64\UnrealEditor.exe"
if not exist "%UE_ED%" set "UE_ED=D:\Epic Games\UE_5.1\Engine\Binaries\Win64\UnrealEditor.exe"
if not exist "%UE_ED%" set "UE_ED=C:\Epic Games\UE_5.1\Engine\Binaries\Win64\UnrealEditor.exe"

set "UE_CMD=%UE_ED:UnrealEditor.exe=UnrealEditor-Cmd.exe%"

echo >>> 虚幻引擎路径: %UE_ED%
echo.
echo ==========================================================
echo [2/3] 正在由 UE 5.1 原生构建效果图2全景关卡 (约15秒)...
echo ==========================================================
"%UE_CMD%" "%UPROJECT%" -ExecutePythonScript="%PROJ_DIR%Content\Python\setup_ue51_level.py" -stdout -FullStdOutLogOutput -unattended

echo.
echo ==========================================================
echo [3/3] 构建完成！正在启动虚幻编辑器 5.1 展现效果图2开阔全景...
echo ==========================================================
start "" "%UE_ED%" "%UPROJECT%" /Game/BISHE
echo 成功启动！
