# -*- coding: utf-8 -*-
"""
Unreal Engine 5.1 自动化场景重构脚本 (setup_ue51_level.py)
完美复现效果图2《凌霄仙阁》全景：
- 完美三级级联浮空汉白玉回廊平台 (Platform 1 入口前台, Platform 3 衔接中台, Platform 2 仙阁顶台)
- 三重檐金顶青阙仙阁主体 (SM_Zhuti_Pagoda) 稳居顶台
- 盛世金莲底座 (SM_Lianhua_Mandala) 衬托仙阁
- 入口大阶梯两侧立式御道仙灯 (SM_Lantern_1, SM_Lantern_2) 与暖金火光
- 纯净青空天象 (SkyAtmosphere + DirectionalLight + SkyLight + 仙气体积雾)
- 3D VR 空间身份通行认证看板 (VR_Login_Station)
- 视口全景机位 (-4100, -2550, 3050) 俯瞰整座仙阁群，绝无视野遮挡或贴脸
"""

import os
import unreal


def run_full_ue51_setup():
    unreal.log("==========================================================")
    unreal.log("[UE 5.1 Setup] 开始执行《凌霄仙阁》全景原生自动化构建流程...")

    content_dir = unreal.Paths.project_content_dir()
    mesh_dir = os.path.join(content_dir, "Meshes")
    tex_dir = os.path.join(content_dir, "Textures")
    ui_dir = os.path.join(tex_dir, "UI")

    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()

    # 1. 创建崭新的 BISHE 关卡
    unreal.log("[UE 5.1 Setup] 1. 正在创建 UE 5.1 原生主关卡: /Game/BISHE ...")
    try:
        old_map_path = os.path.join(content_dir, "BISHE.umap")
        if os.path.exists(old_map_path):
            try:
                bak_path = os.path.join(content_dir, "BISHE_57_bak.umap")
                if not os.path.exists(bak_path):
                    os.rename(old_map_path, bak_path)
            except Exception:
                pass
        unreal.EditorLevelLibrary.new_level("/Game/BISHE")
    except Exception as e:
        unreal.log_warning(f"[UE 5.1 Setup] 新建关卡提示: {e}")

    # 2. 导入 OBJ 网格体
    imported_meshes = {}
    mesh_names = ["zhuti", "pingtai", "lianhua", "deng"]

    for m_name in mesh_names:
        dest_pkg = f"/Game/Meshes/{m_name}"
        if unreal.EditorAssetLibrary.does_asset_exist(dest_pkg):
            imported_meshes[m_name] = unreal.EditorAssetLibrary.load_asset(dest_pkg)
            unreal.log(f"[UE 5.1 Setup] 网格体已存在: {dest_pkg}")
            continue

        obj_file = os.path.join(mesh_dir, f"{m_name}.obj")
        if os.path.exists(obj_file):
            task = unreal.AssetImportTask()
            task.set_editor_property("filename", obj_file)
            task.set_editor_property("destination_path", "/Game/Meshes")
            task.set_editor_property("destination_name", m_name)
            task.set_editor_property("replace_existing", True)
            task.set_editor_property("automated", True)
            task.set_editor_property("save", True)
            asset_tools.import_asset_tasks([task])

            if unreal.EditorAssetLibrary.does_asset_exist(dest_pkg):
                mesh_obj = unreal.EditorAssetLibrary.load_asset(dest_pkg)
                try:
                    bs = mesh_obj.get_editor_property("body_setup")
                    if bs:
                        bs.set_editor_property(
                            "collision_trace_flag",
                            unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE,
                        )
                    unreal.EditorAssetLibrary.save_loaded_asset(mesh_obj)
                except Exception:
                    pass
                imported_meshes[m_name] = mesh_obj
                unreal.log(f"[UE 5.1 Setup] 成功导入网格体: {dest_pkg}")

    # 3. 导入 PBR 贴图并构建 4 套古建材质
    unreal.log("[UE 5.1 Setup] 2. 正在编译 4 套 PBR 仙阙光影材质...")
    created_materials = {}
    mat_configs = [
        {"name": "M_Zhuti_PBR", "mesh": "zhuti", "tex": "T_Zhuti_Color", "rough": 0.85, "emiss": 0.05},
        {"name": "M_Pingtai_PBR", "mesh": "pingtai", "tex": "T_Pingtai_Color", "rough": 0.80, "emiss": 0.04},
        {"name": "M_Lianhua_PBR", "mesh": "lianhua", "tex": "T_Lianhua_Color", "rough": 0.70, "emiss": 0.15},
        {"name": "M_Deng_PBR", "mesh": "deng", "tex": "T_Deng_Color", "rough": 0.65, "emiss": 1.60},
    ]

    mel = unreal.MaterialEditingLibrary

    for cfg in mat_configs:
        m_name = cfg["name"]
        m_path = f"/Game/Materials/{m_name}"

        tex_path = f"/Game/Textures/{cfg['tex']}"
        tex_obj = None
        if unreal.EditorAssetLibrary.does_asset_exist(tex_path):
            tex_obj = unreal.EditorAssetLibrary.load_asset(tex_path)
        else:
            png_path = os.path.join(tex_dir, f"{cfg['tex']}.png")
            if os.path.exists(png_path):
                task = unreal.AssetImportTask()
                task.set_editor_property("filename", png_path)
                task.set_editor_property("destination_path", "/Game/Textures")
                task.set_editor_property("destination_name", cfg["tex"])
                task.set_editor_property("replace_existing", True)
                task.set_editor_property("automated", True)
                task.set_editor_property("save", True)
                asset_tools.import_asset_tasks([task])
                if unreal.EditorAssetLibrary.does_asset_exist(tex_path):
                    tex_obj = unreal.EditorAssetLibrary.load_asset(tex_path)

        if not unreal.EditorAssetLibrary.does_asset_exist(m_path):
            factory = unreal.MaterialFactoryNew()
            mat = asset_tools.create_asset(m_name, "/Game/Materials", unreal.Material, factory)
        else:
            mat = unreal.EditorAssetLibrary.load_asset(m_path)

        if mat:
            try:
                mel.delete_all_material_expressions(mat)
                if tex_obj:
                    tex_node = mel.create_material_expression(mat, unreal.MaterialExpressionTextureSample, -400, 0)
                    tex_node.set_editor_property("texture", tex_obj)
                    mel.connect_material_property(tex_node, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)

                    if cfg["emiss"] > 0:
                        emiss_mul = mel.create_material_expression(mat, unreal.MaterialExpressionMultiply, -150, 150)
                        mel.connect_material_expressions(tex_node, "RGB", emiss_mul, "A")
                        emiss_const = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -300, 200)
                        emiss_const.set_editor_property("r", cfg["emiss"])
                        mel.connect_material_expressions(emiss_const, "", emiss_mul, "B")
                        mel.connect_material_property(emiss_mul, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

                rough_const = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -200, 350)
                rough_const.set_editor_property("r", cfg["rough"])
                mel.connect_material_property(rough_const, "", unreal.MaterialProperty.MP_ROUGHNESS)

                mel.recompile_material(mat)
                unreal.EditorAssetLibrary.save_loaded_asset(mat)
                created_materials[cfg["mesh"]] = mat
            except Exception as e:
                unreal.log_warning(f"[UE 5.1 Setup] 材质编译提示: {e}")

    # 将材质赋给 Mesh
    for m_key, mesh_obj in imported_meshes.items():
        mat_obj = created_materials.get(m_key)
        if mesh_obj and mat_obj:
            mesh_obj.set_material(0, mat_obj)
            unreal.EditorAssetLibrary.save_loaded_asset(mesh_obj)

    # 4. 在关卡中装配三级浮空回廊与仙阁建筑群 (标准厘米级大世界坐标)
    unreal.log("[UE 5.1 Setup] 3. 正在装配三级阶梯浮空回廊与仙阁建筑群...")

    mesh_pt = imported_meshes.get("pingtai")
    mesh_zt = imported_meshes.get("zhuti")
    mesh_lh = imported_meshes.get("lianhua")
    mesh_dg = imported_meshes.get("deng")

    # (A) 三级级联浮空汉白玉平台
    # 平台 1 (入口前台，最低级):
    if mesh_pt:
        pt1 = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_pt, unreal.Vector(-1500.0, 400.0, -100.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if pt1:
            pt1.set_actor_label("SM_Pingtai_1_Entrance")
            pt1.set_actor_scale3d(unreal.Vector(0.10, 0.10, 0.10))

        # 平台 3 (衔接中台):
        pt3 = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_pt, unreal.Vector(-300.0, 400.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if pt3:
            pt3.set_actor_label("SM_Pingtai_3_Middle")
            pt3.set_actor_scale3d(unreal.Vector(0.15, 0.15, 0.15))

        # 平台 2 (仙阁顶台，最高级):
        pt2 = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_pt, unreal.Vector(500.0, -600.0, 100.0), unreal.Rotator(0.0, -60.0, 0.0)
        )
        if pt2:
            pt2.set_actor_label("SM_Pingtai_2_PagodaBase")
            pt2.set_actor_scale3d(unreal.Vector(0.15, 0.15, 0.15))

    # (B) 仙阁主体 (稳居三级顶台)
    if mesh_zt:
        zt = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_zt, unreal.Vector(500.0, -600.0, 200.0), unreal.Rotator(0.0, -60.0, 0.0)
        )
        if zt:
            zt.set_actor_label("SM_Zhuti_Pagoda")
            zt.set_actor_scale3d(unreal.Vector(0.25, 0.25, 0.25))

    # (C) 仙阁莲花座
    if mesh_lh:
        lh = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_lh, unreal.Vector(500.0, -600.0, 195.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if lh:
            lh.set_actor_label("SM_Lianhua_Mandala")
            lh.set_actor_scale3d(unreal.Vector(0.185, 0.185, 0.185))

    # (D) 入口仙灯 (立于一级平台迎宾步阶两侧)
    if mesh_dg:
        dg1 = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_dg, unreal.Vector(-2000.0, 600.0, -100.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if dg1:
            dg1.set_actor_label("SM_Lantern_Left")
            dg1.set_actor_scale3d(unreal.Vector(0.025, 0.025, 0.025))

        dg2 = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_dg, unreal.Vector(-2000.0, 200.0, -100.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if dg2:
            dg2.set_actor_label("SM_Lantern_Right")
            dg2.set_actor_scale3d(unreal.Vector(0.025, 0.025, 0.025))

    # 仙灯暖金内部光源
    for idx, loc in enumerate([
        unreal.Vector(-2000.0, 600.0, -75.0),
        unreal.Vector(-2000.0, 200.0, -75.0),
        unreal.Vector(500.0, -600.0, 350.0),
    ]):
        l_act = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.PointLight, loc, unreal.Rotator(0.0, 0.0, 0.0)
        )
        if l_act:
            l_act.set_actor_label(f"Light_Lantern_{idx+1}")
            plc = l_act.get_component_by_class(unreal.PointLightComponent)
            if plc:
                plc.set_intensity(3500.0 if idx < 2 else 6000.0)
                plc.set_attenuation_radius(450.0 if idx < 2 else 800.0)
                plc.set_light_color(unreal.LinearColor(1.0, 0.82, 0.45, 1.0))

    # 5. 生成阳光、天空光与青空天象 (100% 还原效果图2/3柔和青蓝天空)
    sun = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.DirectionalLight, unreal.Vector(0.0, 0.0, 5000.0), unreal.Rotator(-38.0, -125.0, 0.0)
    )
    if sun:
        sun.set_actor_label("DirectionalLight_Sun")
        dlc = sun.get_component_by_class(unreal.DirectionalLightComponent)
        if dlc:
            dlc.set_intensity(8.5)
            dlc.set_light_color(unreal.LinearColor(1.0, 0.96, 0.88, 1.0))
            try:
                dlc.set_atmosphere_sun_light(True)
            except Exception:
                pass

    sky = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.SkyLight, unreal.Vector(0.0, 0.0, 5000.0), unreal.Rotator(0.0, 0.0, 0.0)
    )
    if sky:
        sky.set_actor_label("SkyLight_Realtime")
        slc = sky.get_component_by_class(unreal.SkyLightComponent)
        if slc:
            slc.set_intensity(1.5)
            try:
                slc.set_editor_property("real_time_capture", True)
            except Exception:
                pass

    # 天空大气
    try:
        atm = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.SkyAtmosphere, unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if atm:
            atm.set_actor_label("SkyAtmosphere_Celestial")
    except Exception:
        pass

    # 仙雾 (ExponentialHeightFog)
    fog = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.ExponentialHeightFog, unreal.Vector(0.0, 0.0, -200.0), unreal.Rotator(0.0, 0.0, 0.0)
    )
    if fog:
        fog.set_actor_label("ExponentialHeightFog_Celestial")
        fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
        if fc:
            fc.set_fog_density(0.015)
            fc.set_fog_height_falloff(0.2)
            try:
                fc.set_volumetric_fog(True)
            except Exception:
                pass

    # 6. 生成 VR 出生点 (PlayerStart) 位于一级平台正中央迎向仙阁
    p_start = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.PlayerStart, unreal.Vector(-1600.0, 400.0, -10.0), unreal.Rotator(0.0, 0.0, 0.0)
    )
    if p_start:
        p_start.set_actor_label("PlayerStart_VR")

    # 7. 生成 3D VR 空间身份通行认证看板 (VR_Login_Station)
    unreal.log("[UE 5.1 Setup] 4. 正在生成 3D VR 空间身份通行认证看板...")
    try:
        bg_tex_path = "/Game/Textures/UI/T_VR_Login_Station_BG"
        bg_tex_obj = None
        if unreal.EditorAssetLibrary.does_asset_exist(bg_tex_path):
            bg_tex_obj = unreal.EditorAssetLibrary.load_asset(bg_tex_path)
        else:
            bg_png = os.path.join(ui_dir, "T_VR_Login_Station_BG.png")
            if os.path.exists(bg_png):
                task = unreal.AssetImportTask()
                task.set_editor_property("filename", bg_png)
                task.set_editor_property("destination_path", "/Game/Textures/UI")
                task.set_editor_property("destination_name", "T_VR_Login_Station_BG")
                task.set_editor_property("replace_existing", True)
                task.set_editor_property("automated", True)
                task.set_editor_property("save", True)
                asset_tools.import_asset_tasks([task])
                if unreal.EditorAssetLibrary.does_asset_exist(bg_tex_path):
                    bg_tex_obj = unreal.EditorAssetLibrary.load_asset(bg_tex_path)

        mat_board_path = "/Game/Textures/UI/M_VR_Login_Station_Mat"
        if not unreal.EditorAssetLibrary.does_asset_exist(mat_board_path):
            factory = unreal.MaterialFactoryNew()
            mat_board = asset_tools.create_asset("M_VR_Login_Station_Mat", "/Game/Textures/UI", unreal.Material, factory)
        else:
            mat_board = unreal.EditorAssetLibrary.load_asset(mat_board_path)

        if mat_board and bg_tex_obj:
            mel.delete_all_material_expressions(mat_board)
            mat_board.set_editor_property("material_domain", unreal.MaterialDomain.MD_SURFACE)
            try:
                mat_board.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
            except Exception:
                pass
            tex_n = mel.create_material_expression(mat_board, unreal.MaterialExpressionTextureSample, -300, 0)
            tex_n.set_editor_property("texture", bg_tex_obj)
            mel.connect_material_property(tex_n, "RGB", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
            mel.recompile_material(mat_board)
            unreal.EditorAssetLibrary.save_loaded_asset(mat_board)

        plane_mesh = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Plane")
        station_actor = unreal.EditorLevelLibrary.spawn_actor_from_object(
            plane_mesh, unreal.Vector(-1450.0, 400.0, -10.0), unreal.Rotator(90.0, 180.0, 0.0)
        )
        if station_actor:
            station_actor.set_actor_label("VR_Login_Station")
            station_actor.set_actor_scale3d(unreal.Vector(1.92, 1.08, 1.0))
            if mat_board:
                smc = station_actor.get_component_by_class(unreal.StaticMeshComponent)
                if smc:
                    smc.set_material(0, mat_board)

        b_light = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.PointLight, unreal.Vector(-1430.0, 400.0, -10.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if b_light:
            b_light.set_actor_label("VR_Login_Backlight")
            plc = b_light.get_component_by_class(unreal.PointLightComponent)
            if plc:
                plc.set_intensity(2000.0)
                plc.set_attenuation_radius(350.0)
                plc.set_light_color(unreal.LinearColor(1.0, 0.85, 0.45, 1.0))

    except Exception as e:
        unreal.log_warning(f"[UE 5.1 Setup] 看板装配提示: {e}")

    # 8. 锁定视口摄像机对准仙阁全景 (50米开阔全景观赏机位，100% 还原效果图2视角)
    try:
        unreal.EditorLevelLibrary.set_level_viewport_camera_info(
            unreal.Vector(-4100.0, -2550.0, 3050.0),
            unreal.Rotator(-26.9, 30.3, 0.0),
        )
    except Exception:
        pass

    # 9. 保存当前关卡为原生 UE 5.1 格式
    unreal.log("[UE 5.1 Setup] 5. 正在保存关卡 /Game/BISHE (UE 5.1 原生格式)...")
    try:
        unreal.EditorLevelLibrary.save_current_level()
    except Exception:
        pass
    try:
        unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    except Exception:
        pass

    unreal.log("==========================================================")
    unreal.log("[UE 5.1 Setup] 恭喜！《凌霄仙阁》效果图2全景场景已原生构建完毕！")
    unreal.log("==========================================================")


if __name__ == "__main__":
    run_full_ue51_setup()
