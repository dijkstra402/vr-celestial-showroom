# 仙阙凌霄 · VR 场景与虚拟数字展厅系统

> 毕业设计 / VR 沉浸式应用与三维数字化展示交互系统

![场景效果预览](vr_digital_showroom/public/selenium_final.png)

## 📌 项目概述

本项目围绕中国传统古典天阁与浮空仙境岛屿，构建了高保真、可交互的虚拟现实（VR）数字展厅。完整覆盖虚幻引擎 5 原生工程与轻量级跨平台 WebVR 展厅系统，满足多端观看、用户登录、实时互动评论与统一美术资产测试导入等要求。

### 核心亮点
1. **PBR 次世代材质与古建结构**：
   - 四层八角天阁（碧玉琉璃瓦、飞檐金脊、白玉廊柱、碧玉雕窗与相轮宝顶）；
   - 三级层叠浮空地台（汉白玉底座搭配金色同心圆曼陀罗浮雕与金莲花纹样）；
   - 莲花承托底座与迎宾石灯笼（暖金点光源与飘拂青流苏）。
2. **建筑环绕 3D 体积云与仙境雾气**：
   - 随时间自然盘旋飘动的程序化体积云团环抱主阁莲花基座；
   - 阶梯与台阶边沿层叠如流水的缭绕云霭；
   - 支持一键切换「仙境浓云」、「灵空轻雾」、「晴空微霁」三种云雾浓度模式。
3. **多平台 VR 沉浸式观看**：
   - **电脑端**：360° 自由旋转漫游与细节缩放；
   - **手机端**：支持**手机陀螺仪**全景沉浸环顾与**手机 VR 双目分屏模式**（装入便携 VR 眼镜盒即刻裸眼 3D 漫游）；
   - **专业 VR 头显**：在 Meta Quest、Pico、Apple Vision Pro 中原生一键入镜（WebXR）。
4. **互动交流与资产导入系统**：
   - 用户注册与登录体系；
   - 实时飘动弹幕与展厅留言簿；
   - **3D 空间图钉评论**：在建筑与平台任意立体表面点击扎入带空间坐标的图钉标签；
   - **学院统一美术资源测试导入面板**：支持 3D 展品模型（`.glb` / `.gltf`）与展画一键陈列至展台。

---

## 🚀 快速启动（零环境依赖运行）

展厅系统采用纯原生标准库构建，无需执行 `npm install` 或安装第三方扩展包，开箱即用：

### 方式 1：使用 Node.js（纯内置模块）
```bash
cd vr_digital_showroom
node server.js
# 或直接双击运行 start.sh (Mac) / start.bat (Windows)
```

### 方式 2：使用 Python 3（纯内置模块）
```bash
cd vr_digital_showroom
python3 server.py
```

启动后控制台将输出访问地址：
* **本机电脑端**：`http://localhost:8080`
* **手机 / VR 头显（连接同一 Wi-Fi）**：`http://<局域网IP>:8080`

---

## 📂 项目工程结构

```
├── bishe.fbx                  # 原始大场景 FBX 模型资产（通过 Git LFS 管理）
├── 毕设1/                     # Unreal Engine 5.7 原生 VR 项目工程
│   ├── 毕设1.uproject          # 虚幻引擎项目工程文件 (UE 5.7, OpenXR 插件)
│   ├── Config/                # 引擎默认输入、VR 模式与项目设置
│   └── Content/               # 游戏资产包
│       ├── zhuti/             # 主阁 3D 资产与 4K PBR 贴图
│       ├── pingtai/           # 浮空台 3D 资产与 4K PBR 贴图
│       ├── lianhua/           # 莲花基座 3D 资产与 4K PBR 贴图
│       ├── deng/              # 迎宾宫灯 3D 资产与 4K PBR 贴图
│       └── BISHE.umap         # 关卡地图与 World Partition
└── vr_digital_showroom/       # 零依赖跨平台 WebVR 数字展厅系统
    ├── server.js              # 纯 Node 内置模块 HTTP 后端服务
    ├── server.py              # 纯 Python 内置模块 HTTP 后端服务
    ├── start.sh / start.bat   # Mac/Linux 与 Windows 一键启动脚本
    └── public/                # 前端交互与 Three.js 场景源码
        ├── index.html         # 展厅主页面与多端响应式 UI
        ├── css/style.css      # 国风典雅毛玻璃样式
        └── js/                # 离线 3D 引擎与业务逻辑
```
