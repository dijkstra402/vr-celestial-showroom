# -*- coding: utf-8 -*-
"""
UE5 编辑器启动自动执行入口 (Content/Python/init_unreal.py)
"""
import unreal

_tick_handle = None
_ticks_waited = 0


def _on_editor_post_tick(delta_time):
    global _tick_handle, _ticks_waited
    _ticks_waited += 1

    # 等待编辑器初始化 60 帧 (约 1-2 秒)
    if _ticks_waited < 60:
        return

    # 等待资产注册表完成扫描
    try:
        ar = unreal.AssetRegistryHelpers.get_asset_registry()
        if ar.is_loading_assets():
            return
    except Exception:
        pass

    if _tick_handle is not None:
        unreal.unregister_slate_post_tick_callback(_tick_handle)
        _tick_handle = None

    # 执行 UE 5.1 原生场景全自动装配
    try:
        import setup_ue51_level
        setup_ue51_level.run_full_ue51_setup()
    except Exception as exc:
        unreal.log_warning(f"[init_unreal] 执行 setup_ue51_level 失败: {exc}")


try:
    _tick_handle = unreal.register_slate_post_tick_callback(_on_editor_post_tick)
    unreal.log("[init_unreal] 已注册《毕设1》VR 场景自动装配任务。")
except Exception as e:
    unreal.log_warning(f"[init_unreal] 注册启动回调失败: {e}")
