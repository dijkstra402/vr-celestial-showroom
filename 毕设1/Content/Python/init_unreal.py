# -*- coding: utf-8 -*-
"""
UE5 编辑器启动自动执行入口 (Content/Python/init_unreal.py)
当在 Unreal Engine 5 中打开《毕设1.uproject》时，引擎会自动执行本脚本：
等待默认关卡 /Game/BISHE 加载完成后，自动运行 setup_vr_scene.run_full_setup()，
无需任何手动连线或拖拽，直接完成白模上贴图、体积云环绕与 VR 预览准备。
"""

import unreal

_tick_handle = None
_ticks_waited = 0


def _on_editor_post_tick(delta_time):
    global _tick_handle, _ticks_waited
    _ticks_waited += 1

    # 1. 至少等待编辑器启动初始化 120 帧 (约 2-3 秒)
    if _ticks_waited < 120:
        return

    # 2. 确保资产注册表完成后台扫描索引
    try:
        ar = unreal.AssetRegistryHelpers.get_asset_registry()
        if ar.is_loading_assets():
            return  # 仍在扫描索引，继续等待下一次 Tick
    except Exception:
        pass

    # 3. 检查主关卡是否已打开
    try:
        world = unreal.EditorLevelLibrary.get_editor_world()
        if not world or "BISHE" not in world.get_name():
            if _ticks_waited < 300:
                return  # 等待关卡自动完成流式加载
            unreal.EditorLevelLibrary.load_level("/Game/BISHE")
    except Exception:
        pass

    if _tick_handle is not None:
        unreal.unregister_slate_post_tick_callback(_tick_handle)
        _tick_handle = None

    try:
        import setup_vr_scene
        setup_vr_scene.run_full_setup()
    except Exception as exc:
        unreal.log_warning(f"[init_unreal] 自动执行 setup_vr_scene 失败: {exc}")

    try:
        import setup_vr_login
        setup_vr_login.run_full_setup()
    except Exception as exc:
        unreal.log_warning(f"[init_unreal] 自动执行 setup_vr_login 失败: {exc}")


try:
    _tick_handle = unreal.register_slate_post_tick_callback(_on_editor_post_tick)
    unreal.log("[init_unreal] 已注册《毕设1》VR 场景自动装配任务，将在关卡加载后自动执行。")
except Exception as e:
    unreal.log_warning(f"[init_unreal] 注册启动回调失败: {e}")
