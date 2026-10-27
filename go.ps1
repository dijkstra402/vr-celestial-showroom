Write-Host "==========================================================" -ForegroundColor Green
Write-Host ">>> [1/4] 正在关闭旧进程与准备本地环境..." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

Get-Process -Name UnrealEditor*, EpicGamesLauncher* -ErrorAction SilentlyContinue | Stop-Process -Force

$candidates = @(
    "D:\download\毕设1_UE5_Windows工程包\毕设1",
    "D:\download\毕设1_UE5_Windows工程包",
    "D:\download\毕设1"
)
$proj = $candidates | Where-Object { Test-Path "$_\*.uproject" } | Select-Object -First 1
if (-not $proj) { $proj = "D:\download\毕设1_UE5_Windows工程包\毕设1" }

$uprojectFile = (Get-ChildItem -Path $proj -Filter "*.uproject" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
Write-Host ">>> [1/4] 定位到毕设工程: $proj" -ForegroundColor Cyan
Write-Host ">>> [1/4] 工程主文件: $uprojectFile" -ForegroundColor Cyan

# 检测本地是否已有上传的增量包，若无则从高速节点拉取单文件 zip
$localZip = (Get-Item "$env:USERPROFILE\Desktop\*更新*.zip", "D:\download\*更新*.zip", "D:\download\update.zip" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if ($localZip -and (Test-Path $localZip)) {
    Write-Host ">>> [2/4] 检测到您已本地上传增量包: $localZip (免下载)" -ForegroundColor Green
    $zipPath = $localZip
} else {
    $zipPath = "$proj\update.zip"
    Write-Host ">>> [2/4] 正在从国内高速节点下载完整增量包 (19.9MB)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "http://test.ideawit.com/models/update.zip" -OutFile $zipPath -UseBasicParsing
    Write-Host ">>> [2/4] 增量包下载完成！" -ForegroundColor Green
}

Write-Host ">>> [2/4] 正在解压模型、PBR全彩贴图与场景脚本到工程目录..." -ForegroundColor Cyan
Expand-Archive -Path $zipPath -DestinationPath $proj -Force

# 清理高版本残留
Remove-Item -Path "$proj\Content\__ExternalActors__", "$proj\Content\__ExternalObjects__", "$proj\Content\BISHE_HLOD0_Instancing.uasset" -Recurse -Force -ErrorAction SilentlyContinue

# 定位 UE 5.1
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

Write-Host ">>> [3/4] 正在由 UE 5.1 原生构建效果图2全景三级浮空回廊与仙阁建筑群 (约15秒)..." -ForegroundColor Yellow
& $ueCmd "$uprojectFile" -ExecutePythonScript="$proj\Content\Python\setup_ue51_level.py" -stdout -FullStdOutLogOutput -unattended

Write-Host ">>> [4/4] 构建完成！正在启动虚幻编辑器 5.1 展现效果图2开阔全景..." -ForegroundColor Green
Start-Process $ueEditor -ArgumentList "`"$uprojectFile`"", "/Game/BISHE"
