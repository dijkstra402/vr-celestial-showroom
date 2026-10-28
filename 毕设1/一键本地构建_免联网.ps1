Write-Host "==========================================================" -ForegroundColor Green
Write-Host ">>> [1/3] 正在关闭已有虚幻引擎进程并准备本地装配..." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

Get-Process -Name UnrealEditor*, EpicGamesLauncher* -ErrorAction SilentlyContinue | Stop-Process -Force

$proj = $PSScriptRoot
if (-not $proj) { $proj = "D:\download\毕设1_UE5_Windows工程包\毕设1" }
$uproject = (Get-ChildItem -Path $proj -Filter "*.uproject" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName

Write-Host ">>> 当前毕设工程: $uproject" -ForegroundColor Cyan

# 清理高版本残留
Remove-Item -Path "$proj\Content\__ExternalActors__", "$proj\Content\__ExternalObjects__", "$proj\Content\BISHE_HLOD0_Instancing.uasset" -Recurse -Force -ErrorAction SilentlyContinue

$ueCandidates = @(
    "C:\Program Files\Epic Games\UE_5.1\Engine\Binaries\Win64\UnrealEditor.exe",
    "D:\Program Files\Epic Games\UE_5.1\Engine\Binaries\Win64\UnrealEditor.exe",
    "D:\Epic Games\UE_5.1\Engine\Binaries\Win64\UnrealEditor.exe",
    "C:\Epic Games\UE_5.1\Engine\Binaries\Win64\UnrealEditor.exe"
)
$ueEditor = $ueCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $ueEditor) {
    $ueEditor = (Get-Item "C:\Program Files\Epic Games\UE_5.*\Engine\Binaries\Win64\UnrealEditor.exe", "D:\Epic Games\UE_5.*\Engine\Binaries\Win64\UnrealEditor.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
$ueCmd = $ueEditor.Replace("UnrealEditor.exe", "UnrealEditor-Cmd.exe")

Write-Host ">>> [2/3] 正在由 UE 5.1 本地原生构建《凌霄仙阁》全景场景 (约15秒)..." -ForegroundColor Yellow
& $ueCmd "$uproject" -ExecutePythonScript="$proj\Content\Python\setup_ue51_level.py" -stdout -FullStdOutLogOutput -unattended

Write-Host ">>> [3/3] 构建完成！正在启动虚幻编辑器 5.1 展现效果图2开阔全景..." -ForegroundColor Green
Start-Process $ueEditor -ArgumentList "`"$uproject`"", "/Game/BISHE"
