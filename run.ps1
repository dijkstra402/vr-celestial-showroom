Write-Host "==========================================================" -ForegroundColor Green
Write-Host ">>> [1/4] 开始执行《凌霄仙阁》UE 5.1 全景自动化装配..." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

# 1. 关闭正在运行的 UE 进程避免文件锁定
Get-Process -Name UnrealEditor*, EpicGamesLauncher* -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. 毫秒级定位工程目录 (杜绝全盘递归卡死)
$candidates = @(
    "D:\download\毕设1_UE5_Windows工程包\毕设1",
    "D:\download\毕设1_UE5_Windows工程包",
    "D:\download\毕设1"
)
$proj = $candidates | Where-Object { Test-Path "$_\*.uproject" } | Select-Object -First 1
if (-not $proj) {
    $proj = (Get-ChildItem -Path "D:\download" -Filter "*.uproject" -Depth 3 -ErrorAction SilentlyContinue | Select-Object -First 1).Directory.FullName
}
if (-not $proj) { $proj = "D:\download\毕设1_UE5_Windows工程包\毕设1" }

$uprojectFile = (Get-ChildItem -Path $proj -Filter "*.uproject" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
Write-Host ">>> [1/4] 定位到毕设工程: $proj" -ForegroundColor Cyan
Write-Host ">>> [1/4] 工程文件: $uprojectFile" -ForegroundColor Cyan

# 3. 准备目录并高速下载模型与材质贴图
$meshDir = "$proj\Content\Meshes"
$texDir = "$proj\Content\Textures"
$uiDir = "$texDir\UI"
$pyDir = "$proj\Content\Python"
New-Item -ItemType Directory -Path $meshDir, $texDir, $uiDir, $pyDir -Force | Out-Null

$base = "http://test.ideawit.com/models"

# 下载 4 个标准三维模型
@("zhuti.obj", "pingtai.obj", "lianhua.obj", "deng.obj") | ForEach-Object {
    $target = "$meshDir\$_"
    if (-not (Test-Path $target) -or ((Get-Item $target).Length -lt 1000000)) {
        Write-Host ">>> [2/4] 正在下载三维资产: $_ ..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri "$base/$_" -OutFile $target -UseBasicParsing
    } else {
        Write-Host ">>> [2/4] 三维资产已就绪: $_" -ForegroundColor DarkCyan
    }
}

# 下载 4 套 PBR 仙阙全彩贴图 (告别纯白模)
@("T_Zhuti_Color.png", "T_Pingtai_Color.png", "T_Lianhua_Color.png", "T_Deng_Color.png") | ForEach-Object {
    $target = "$texDir\$_"
    if (-not (Test-Path $target) -or ((Get-Item $target).Length -lt 100000)) {
        Write-Host ">>> [2/4] 正在下载全彩 PBR 贴图: $_ ..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri "$base/$_" -OutFile $target -UseBasicParsing
    } else {
        Write-Host ">>> [2/4] 材质贴图已就绪: $_" -ForegroundColor DarkCyan
    }
}

$uiBg = "$uiDir\T_VR_Login_Station_BG.png"
if (-not (Test-Path $uiBg)) {
    Invoke-WebRequest -Uri "$base/T_VR_Login_Station_BG.png" -OutFile $uiBg -UseBasicParsing
}

Invoke-WebRequest -Uri "$base/setup_ue51_level.py" -OutFile "$pyDir\setup_ue51_level.py" -UseBasicParsing
Invoke-WebRequest -Uri "$base/init_unreal.py" -OutFile "$pyDir\init_unreal.py" -UseBasicParsing

# 清理高版本残留
Remove-Item -Path "$proj\Content\__ExternalActors__", "$proj\Content\__ExternalObjects__", "$proj\Content\BISHE_HLOD0_Instancing.uasset" -Recurse -Force -ErrorAction SilentlyContinue

# 4. 定位 UE 5.1 执行文件 (毫秒级直达，杜绝递归)
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
& $ueCmd "$uprojectFile" -ExecutePythonScript="$pyDir\setup_ue51_level.py" -stdout -FullStdOutLogOutput -unattended

Write-Host ">>> [4/4] 构建完成！正在启动虚幻编辑器 5.1 展现效果图2开阔全景..." -ForegroundColor Green
Start-Process $ueEditor -ArgumentList "`"$uprojectFile`"", "/Game/BISHE"
