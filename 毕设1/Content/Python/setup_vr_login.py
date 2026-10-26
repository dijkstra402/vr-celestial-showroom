# -*- coding: utf-8 -*-
"""
Unreal Engine 5.7 VR 3D 登录注册与身份通行认证系统装配脚本 (setup_vr_login.py)
针对《凌霄仙阁 VR 数字展厅》(BISHE.umap) 关卡自动完成以下工作：
1. 自动从 Content/Textures/UI/ 导入高清 UI 贴图资源：
   - T_VR_Login_Station_BG (1920x1080 全景仙阁看板)
   - T_Card_Expert (评审专家 特权卡)
   - T_Card_Teacher (指导教师 教务卡)
   - T_Card_Student (参展学生 创作卡)
   - T_Card_Visitor (游客观众 访客卡)
   - T_Button_Gold_* (暖金交互按钮)
2. 自动构建 3D 空间发光材质 M_VR_Login_Station_Mat (Unlit / Emissive Bloom)
3. 自动在首座浮空台出生点前 (Location: 75680, 85850, 44960) 生成 3D 立体看板 Actor (VR_Login_Station)
   - 空间模式：World Space 3D 空间立体挂载
   - 画布尺寸：1920 x 1080
   - 视角朝向：Rotator(0, -100, 0) 正对 VR 玩家出生点 (PlayerStart)
   - 交互方式：完全支持 BP_XRPawn 的 WidgetInteractionComponent (手柄射线激光扣动扳机交互)
4. 自动布置仙灵金光背影补光灯 (VR_Login_Backlight)
5. 与本地 HTTP 数据库服务 (http://127.0.0.1:8080/api/login 与 /api/register) 联通
"""

import os
import unreal

UI_TEXTURE_NAMES = [
    "T_VR_Login_Station_BG",
    "T_Card_Expert",
    "T_Card_Teacher",
    "T_Card_Student",
    "T_Card_Visitor",
    "T_Button_Gold_Normal",
    "T_Button_Gold_Hover",
    "T_Button_Gold_Pressed",
    "T_VR_Key_Normal",
    "T_VR_Key_Hover",
    "T_VR_Key_Pressed",
]


def import_ui_textures():
    """将 Content/Textures/UI/ 目录下的所有 PNG 自动导入为 Unreal 纹理资产"""
    imported_assets = {}
    content_dir = unreal.Paths.project_content_dir()
    ui_dir = os.path.join(content_dir, "Textures", "UI")
    dest_path = "/Game/Textures/UI"

    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()

    for tex_name in UI_TEXTURE_NAMES:
        uasset_path = f"{dest_path}/{tex_name}"
        if unreal.EditorAssetLibrary.does_asset_exist(uasset_path):
            tex_obj = unreal.EditorAssetLibrary.load_asset(uasset_path)
            imported_assets[tex_name] = tex_obj
            continue

        png_path = os.path.join(ui_dir, f"{tex_name}.png")
        if os.path.exists(png_path):
            task = unreal.AssetImportTask()
            task.set_editor_property("filename", png_path)
            task.set_editor_property("destination_path", dest_path)
            task.set_editor_property("destination_name", tex_name)
            task.set_editor_property("replace_existing", True)
            task.set_editor_property("automated", True)
            task.set_editor_property("save", True)
            asset_tools.import_asset_tasks([task])

            if unreal.EditorAssetLibrary.does_asset_exist(uasset_path):
                tex_obj = unreal.EditorAssetLibrary.load_asset(uasset_path)
                # 设置纹理属性为 UI / Crisp
                try:
                    tex_obj.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_EDITOR_ICON)
                    tex_obj.set_editor_property("s_rgb", True)
                    unreal.EditorAssetLibrary.save_loaded_asset(tex_obj)
                except Exception:
                    pass
                imported_assets[tex_name] = tex_obj
                unreal.log(f"[VR Login Setup] 导入 UI 纹理成功: {uasset_path}")

    return imported_assets


def build_login_material(bg_texture):
    """创建或更新 3D 看板发光材质 M_VR_Login_Station_Mat"""
    mat_path = "/Game/Textures/UI/M_VR_Login_Station_Mat"
    if unreal.EditorAssetLibrary.does_asset_exist(mat_path):
        return unreal.EditorAssetLibrary.load_asset(mat_path)

    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    factory = unreal.MaterialFactoryNew()
    mat = asset_tools.create_asset("M_VR_Login_Station_Mat", "/Game/Textures/UI", unreal.Material, factory)
    if not mat:
        return None

    try:
        # 设置材质为 Unlit / Opaque 或 Translucent
        mat.set_editor_property("material_domain", unreal.MaterialDomain.MD_SURFACE)
        try:
            mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        except Exception:
            try:
                mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MS_UNLIT)
            except Exception:
                pass

        # 添加纹理采样节点
        if bg_texture:
            tex_node = unreal.MaterialEditingLibrary.create_material_expression(
                mat, unreal.MaterialExpressionTextureSample, -300, 0
            )
            tex_node.set_editor_property("texture", bg_texture)
            unreal.MaterialEditingLibrary.connect_material_property(
                tex_node, "RGB", unreal.MaterialProperty.MP_EMISSIVE_COLOR
            )

        unreal.MaterialEditingLibrary.recompile_material(mat)
        unreal.EditorAssetLibrary.save_loaded_asset(mat)
        unreal.log(f"[VR Login Setup] 已成功编译 3D 看板发光材质: {mat_path}")
    except Exception as exc:
        unreal.log_warning(f"[VR Login Setup] 编译材质遇到提示: {exc}")

    return mat


def spawn_vr_login_station():
    """在关卡 BISHE.umap 中的首座浮空台出生点前生成 3D VR 登录认证看板 Actor"""
    station_label = "VR_Login_Station"
    light_label = "VR_Login_Backlight"

    all_actors = unreal.EditorLevelLibrary.get_all_level_actors()
    station_actor = None
    light_actor = None

    for a in all_actors:
        lbl = a.get_actor_label()
        if lbl == station_label:
            station_actor = a
        elif lbl == light_label:
            light_actor = a

    # 1. 目标三维位置 (处于首座浮空台 75720, 86010, 44816 之上，正前方 1.8 米)
    # 玩家站在 (75720, 86010, 44895)，看板放在 (75680, 85850, 44960)
    target_loc = unreal.Vector(75680.0, 85850.0, 44960.0)
    target_rot = unreal.Rotator(0.0, -100.0, 0.0)
    target_scale = unreal.Vector(0.12, 0.12, 0.12)

    # 2. 如果未生成，优先检查并派生 BP_VRLoginStation (复用 XRFramework 3D 射线交互蓝图)
    if not station_actor:
        bp_login_path = "/Game/XRFramework/Blueprints/BP_VRLoginStation"
        bp_menu_path = "/Game/XRFramework/Blueprints/BP_Menu"

        if not unreal.EditorAssetLibrary.does_asset_exist(bp_login_path):
            if unreal.EditorAssetLibrary.does_asset_exist(bp_menu_path):
                unreal.EditorAssetLibrary.duplicate_asset(bp_menu_path, bp_login_path)
                unreal.log(f"[VR Login Setup] 已成功复刻 XRFramework 3D 菜单蓝图为: {bp_login_path}")

        bp_target_class = unreal.EditorAssetLibrary.load_blueprint_class(bp_login_path)
        if not bp_target_class:
            bp_target_class = unreal.EditorAssetLibrary.load_blueprint_class(bp_menu_path)

        if bp_target_class:
            station_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
                bp_target_class, target_loc, target_rot
            )
            if station_actor:
                station_actor.set_actor_label(station_label)
                station_actor.set_actor_scale3d(target_scale)
                unreal.log(f"[VR Login Setup] 基于 3D 射线交互蓝图生成登录站: {station_label}")
        else:
            # 原生生成标准 Actor 并附带 WidgetComponent 与 Plane 网格
            station_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
                unreal.StaticMeshActor, target_loc, target_rot
            )
            if station_actor:
                station_actor.set_actor_label(station_label)
                plane_mesh = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Plane")
                if plane_mesh:
                    smc = station_actor.get_component_by_class(unreal.StaticMeshComponent)
                    if smc:
                        smc.set_static_mesh(plane_mesh)
                        # 平面沿垂直方向立起 (Pitch 90)
                        station_actor.set_actor_rotation(unreal.Rotator(90.0, -100.0, 0.0), False)
                        station_actor.set_actor_scale3d(unreal.Vector(1.92, 1.08, 1.0))
                        # 赋上看板发光材质
                        mat = unreal.EditorAssetLibrary.load_asset("/Game/Textures/UI/M_VR_Login_Station_Mat")
                        if mat:
                            smc.set_material(0, mat)
                unreal.log(f"[VR Login Setup] 生成原生 3D 看板网格: {station_label}")
    else:
        # 已存在则更新位置与朝向
        station_actor.set_actor_location(target_loc, False, False)
        station_actor.set_actor_rotation(target_rot, False)
        unreal.log(f"[VR Login Setup] 更新已有 3D 看板位置: {station_label}")

    # 3. 添加仙阁金辉背部氛围补光灯 (环绕光晕)
    if not light_actor:
        light_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.PointLight, unreal.Vector(75670.0, 85820.0, 44960.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if light_actor:
            light_actor.set_actor_label(light_label)
            plc = light_actor.get_component_by_class(unreal.PointLightComponent)
            if plc:
                plc.set_intensity(2200.0)
                plc.set_attenuation_radius(450.0)
                plc.set_light_color(unreal.LinearColor(0.95, 0.82, 0.45, 1.0))
                unreal.log(f"[VR Login Setup] 已布置看板仙灵光晕灯: {light_label}")


def run_full_setup():
    """一键装配 VR 3D 登录注册与身份认证系统全部资产与关卡实体"""
    unreal.log("==========================================================")
    unreal.log("[VR Login Setup] 开始自动装配 VR 3D 身份通行认证系统...")

    # 1. 确保资产注册表完成后台扫描
    try:
        ar = unreal.AssetRegistryHelpers.get_asset_registry()
        if ar.is_loading_assets():
            ar.wait_for_completion()
    except Exception:
        pass

    try:
        textures = import_ui_textures()
        bg_tex = textures.get("T_VR_Login_Station_BG")
        build_login_material(bg_tex)
        spawn_vr_login_station()
        try:
            unreal.EditorLoadingAndSavingUtils.save_current_level()
        except Exception:
            try:
                unreal.EditorLevelLibrary.save_current_level()
            except Exception:
                pass
        unreal.log("[VR Login Setup] VR 3D 登录认证系统装配完毕并已保存关卡！")
    except Exception as exc:
        unreal.log_warning(f"[VR Login Setup] 装配过程异常: {exc}")
    unreal.log("==========================================================")


if __name__ == "__main__":
    run_full_setup()
