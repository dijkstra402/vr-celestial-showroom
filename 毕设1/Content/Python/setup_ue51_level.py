# -*- coding: utf-8 -*-
"""
Unreal Engine 5.1 自动化全流程重建脚本 (setup_ue51_level.py)
专为解决低版本 UE 5.1 无法读取高版本 (UE 5.7) .uasset/.umap 资产问题而开发：
1. 自动从 Content/Meshes/ 导入标准通用 OBJ 模型 (zhuti.obj, pingtai.obj, lianhua.obj, deng.obj)
2. 自动从 Content/Textures/ 导入全彩 PBR 贴图并编译 4 套次世代物理材质
3. 自动在 UE 5.1 原生环境下生成崭新主关卡 /Game/BISHE 并摆放全部建筑模型、仙灯、暖金阳光、体积雾
4. 自动在出生浮空台前布置 3D VR 空间身份通行认证看板 (VR_Login_Station)
5. 自动配置 PlayerStart 与手柄传送落脚复杂碰撞，并原生保存为 UE 5.1 关卡！
"""

import os
import unreal


def run_full_ue51_setup():
    unreal.log("==========================================================")
    unreal.log("[UE 5.1 Setup] 开始执行《凌霄仙阁》UE 5.1 原生全自动构建流程...")

    content_dir = unreal.Paths.project_content_dir()
    mesh_dir = os.path.join(content_dir, "Meshes")
    tex_dir = os.path.join(content_dir, "Textures")
    ui_dir = os.path.join(tex_dir, "UI")

    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()

    # 0. 检查当前关卡是否已经装配完毕
    all_actors = unreal.EditorLevelLibrary.get_all_level_actors()
    has_zhuti = any("SM_Zhuti" in a.get_actor_label() or "zhuti" in a.get_name().lower() for a in all_actors)
    if has_zhuti:
        unreal.log("[UE 5.1 Setup] 关卡中已存在仙阁建筑，无需重复装配。")
        return

    # 1. 创建或载入新的 BISHE 关卡
    unreal.log("[UE 5.1 Setup] 1. 正在创建 UE 5.1 原生标准关卡: /Game/BISHE ...")
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

    # 2. 导入 OBJ 几何网格体
    imported_meshes = {}
    mesh_names = ["zhuti", "pingtai", "lianhua", "deng"]

    fallbacks = {
        "zhuti": ["/Game/zhuti/主体", "/Game/zhuti/zhuti"],
        "pingtai": ["/Game/pingtai/平台", "/Game/pingtai/pingtai"],
        "lianhua": ["/Game/lianhua/莲花", "/Game/lianhua/lianhua"],
        "deng": ["/Game/deng/bd86a6a94ee1be7a7c174de51ae8800d", "/Game/deng/3732518bc670cc69757de0549e744697", "/Game/deng/deng"],
    }

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
                # 开启复杂碰撞作为简单碰撞，供 VR 传送射线落脚
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

        # 备选：如果 OBJ 不存在，自动寻找工程内已有资产
        if not imported_meshes.get(m_name):
            for fb_path in fallbacks.get(m_name, []):
                if unreal.EditorAssetLibrary.does_asset_exist(fb_path):
                    m_obj = unreal.EditorAssetLibrary.load_asset(fb_path)
                    if m_obj:
                        imported_meshes[m_name] = m_obj
                        unreal.log(f"[UE 5.1 Setup] 使用既有网格体资产: {fb_path}")
                        break

    # 3. 导入 PBR 漫反射全彩纹理与构建 PBR 材质
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

        # 确保漫反射 PNG 已导入
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

        # 构建 Material
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

                    # 发光
                    if cfg["emiss"] > 0:
                        emiss_mul = mel.create_material_expression(mat, unreal.MaterialExpressionMultiply, -150, 150)
                        mel.connect_material_expressions(tex_node, "RGB", emiss_mul, "A")
                        emiss_const = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -300, 200)
                        emiss_const.set_editor_property("r", cfg["emiss"])
                        mel.connect_material_expressions(emiss_const, "", emiss_mul, "B")
                        mel.connect_material_property(emiss_mul, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

                # 粗糙度
                rough_const = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -200, 350)
                rough_const.set_editor_property("r", cfg["rough"])
                mel.connect_material_property(rough_const, "", unreal.MaterialProperty.MP_ROUGHNESS)

                mel.recompile_material(mat)
                unreal.EditorAssetLibrary.save_loaded_asset(mat)
                created_materials[cfg["mesh"]] = mat
                unreal.log(f"[UE 5.1 Setup] 已编译材质: {m_path}")
            except Exception as e:
                unreal.log_warning(f"[UE 5.1 Setup] 材质编译提示: {e}")

    # 将材质绑定到导入的 Mesh
    for m_key, mesh_obj in imported_meshes.items():
        mat_obj = created_materials.get(m_key)
        if mesh_obj and mat_obj:
            mesh_obj.set_material(0, mat_obj)
            unreal.EditorAssetLibrary.save_loaded_asset(mesh_obj)

    # 4. 在关卡中生成全部建筑与仙阙空间实体
    unreal.log("[UE 5.1 Setup] 3. 正在生成仙阙建筑、仙灯与体积光影...")

    # 平台 (Platform)
    mesh_pt = imported_meshes.get("pingtai")
    if mesh_pt:
        a_pt = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_pt, unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if a_pt:
            a_pt.set_actor_label("SM_Pingtai")

    # 主体 (Pagoda)
    mesh_zt = imported_meshes.get("zhuti")
    if mesh_zt:
        a_zt = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_zt, unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if a_zt:
            a_zt.set_actor_label("SM_Zhuti")

    # 莲花基座 (Lotus)
    mesh_lh = imported_meshes.get("lianhua")
    if mesh_lh:
        lotus_spots = [
            (unreal.Vector(0.0, 0.0, 0.0), unreal.Vector(1.0, 1.0, 1.0)),
        ]
        for idx, (loc, sc) in enumerate(lotus_spots):
            a_lh = unreal.EditorLevelLibrary.spawn_actor_from_object(
                mesh_lh, loc, unreal.Rotator(0.0, idx * 45.0, 0.0)
            )
            if a_lh:
                a_lh.set_actor_label(f"SM_Lianhua_{idx+1}")

    # 仙灯 (Lanterns)
    mesh_dg = imported_meshes.get("deng")
    if mesh_dg:
        a_dg = unreal.EditorLevelLibrary.spawn_actor_from_object(
            mesh_dg, unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if a_dg:
            a_dg.set_actor_label("SM_Deng")

    # 5. 生成阳光与天空光 (匹配效果图3暖金古建光影)
    sun = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.DirectionalLight, unreal.Vector(0.0, 0.0, 1000.0), unreal.Rotator(-38.0, -125.0, 0.0)
    )
    if sun:
        sun.set_actor_label("DirectionalLight_Sun")
        dlc = sun.get_component_by_class(unreal.DirectionalLightComponent)
        if dlc:
            dlc.set_intensity(8.5)
            dlc.set_light_color(unreal.LinearColor(1.0, 0.95, 0.86, 1.0))

    sky = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.SkyLight, unreal.Vector(0.0, 0.0, 1200.0), unreal.Rotator(0.0, 0.0, 0.0)
    )
    if sky:
        sky.set_actor_label("SkyLight_Realtime")
        slc = sky.get_component_by_class(unreal.SkyLightComponent)
        if slc:
            slc.set_intensity(1.5)

    # 雾气 (ExponentialHeightFog)
    fog = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.ExponentialHeightFog, unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator(0.0, 0.0, 0.0)
    )
    if fog:
        fog.set_actor_label("ExponentialHeightFog_Celestial")
        fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
        if fc:
            fc.set_fog_density(0.02)
            try:
                fc.set_volumetric_fog(True)
            except Exception:
                pass

    # 点光源 (暖金石灯笼照明)
    for idx, loc in enumerate([
        unreal.Vector(150.0, 150.0, 80.0),
        unreal.Vector(-150.0, 150.0, 80.0),
        unreal.Vector(0.0, -250.0, 120.0),
    ]):
        l_act = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.PointLight, loc, unreal.Rotator(0.0, 0.0, 0.0)
        )
        if l_act:
            l_act.set_actor_label(f"Light_Lantern_{idx+1}")
            plc = l_act.get_component_by_class(unreal.PointLightComponent)
            if plc:
                plc.set_intensity(3000.0)
                plc.set_attenuation_radius(600.0)
                plc.set_light_color(unreal.LinearColor(1.0, 0.82, 0.45, 1.0))

    # 6. 生成 VR 出生点 (PlayerStart)
    p_start = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.PlayerStart, unreal.Vector(0.0, 300.0, 100.0), unreal.Rotator(0.0, -90.0, 0.0)
    )
    if p_start:
        p_start.set_actor_label("PlayerStart_VR")

    # 7. 生成 3D VR 空间身份通行认证看板 (VR_Login_Station)
    unreal.log("[UE 5.1 Setup] 4. 正在生成 3D VR 空间身份通行认证看板...")
    try:
        # 导入看板背景贴图
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

        # 看板发光材质
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

        # 生成 3D 看板网格
        plane_mesh = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Plane")
        station_actor = unreal.EditorLevelLibrary.spawn_actor_from_object(
            plane_mesh, unreal.Vector(0.0, 160.0, 150.0), unreal.Rotator(90.0, -90.0, 0.0)
        )
        if station_actor:
            station_actor.set_actor_label("VR_Login_Station")
            station_actor.set_actor_scale3d(unreal.Vector(1.92, 1.08, 1.0))
            if mat_board:
                smc = station_actor.get_component_by_class(unreal.StaticMeshComponent)
                if smc:
                    smc.set_material(0, mat_board)

        # 看板仙灵金辉背光
        b_light = unreal.EditorLevelLibrary.spawn_actor_from_class(
            unreal.PointLight, unreal.Vector(0.0, 140.0, 150.0), unreal.Rotator(0.0, 0.0, 0.0)
        )
        if b_light:
            b_light.set_actor_label("VR_Login_Backlight")
            plc = b_light.get_component_by_class(unreal.PointLightComponent)
            if plc:
                plc.set_intensity(2500.0)
                plc.set_attenuation_radius(400.0)
                plc.set_light_color(unreal.LinearColor(1.0, 0.85, 0.45, 1.0))

    except Exception as e:
        unreal.log_warning(f"[UE 5.1 Setup] 看板装配提示: {e}")

    # 8. 保存当前关卡为原生 UE 5.1 关卡
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
    unreal.log("[UE 5.1 Setup] 恭喜！《凌霄仙阁》UE 5.1 原生关卡装配完毕！")
    unreal.log("==========================================================")


if __name__ == "__main__":
    run_full_ue51_setup()
