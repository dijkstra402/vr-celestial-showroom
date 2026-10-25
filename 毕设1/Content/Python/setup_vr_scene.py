# -*- coding: utf-8 -*-
"""
Unreal Engine 5.7 自动化场景构建与材质装配脚本 (setup_vr_scene.py)
针对《毕设1》(BISHE.umap) 原生 VR 工程自动完成以下工作：
1. 自动创建并编译 4 套完整 PBR 材质 (M_Zhuti_PBR, M_Pingtai_PBR, M_Lianhua_PBR, M_Deng_PBR)
   自动连接 BaseColor、Metallic、Roughness、Normal 四张贴图及暖金自发光 (Emissive)。
2. 自动将编译好的 PBR 材质赋给 主体、平台、莲花、灯 全部静态网格体，彻底解决白模问题。
3. 自动开启 主体 与 平台 的复杂碰撞 (UseComplexAsSimple)，确保 VR 手柄射线传送可精准落脚。
4. 自动修复 BISHE.umap 关卡：
   - 清除误拖到天空球 (SM_SkySphere) 上的粗糙度贴图材质；
   - 自动在浮空台摆放 莲花 与 仙灯 + 暖金点光源；
   - 将 VolumetricCloud (体积云) 底部高度降到建筑所在的 Z=44810cm (0.40km)，让体积云直接环绕仙阁与浮空台；
   - 开启 ExponentialHeightFog 的 Volumetric Fog (体积雾) 仙气效果；
   - 将 VR 出生点 (PlayerStart) 从地面 (-200, 0, 92) 移至前排浮空台 (75720, 86010, 44910)，并将编辑器镜头对准仙阁。
"""

import unreal


ASSET_GROUPS = [
    {
        "folder": "/Game/zhuti",
        "tex_color_name": "T_Zhuti_Color",
        "mat_name": "M_Zhuti_PBR",
        "meshes": ["/Game/zhuti/主体"],
        "tint": (1.0, 1.0, 1.0),
        "emissive_strength": 0.05,
        "roughness_scale": 0.85,
    },
    {
        "folder": "/Game/pingtai",
        "tex_color_name": "T_Pingtai_Color",
        "mat_name": "M_Pingtai_PBR",
        "meshes": ["/Game/pingtai/平台"],
        "tint": (1.0, 1.0, 1.0),
        "emissive_strength": 0.04,
        "roughness_scale": 0.80,
    },
    {
        "folder": "/Game/lianhua",
        "tex_color_name": "T_Lianhua_Color",
        "mat_name": "M_Lianhua_PBR",
        "meshes": ["/Game/lianhua/莲花"],
        "tint": (1.0, 1.0, 1.0),
        "emissive_strength": 0.15,
        "roughness_scale": 0.70,
    },
    {
        "folder": "/Game/deng",
        "tex_color_name": "T_Deng_Color",
        "mat_name": "M_Deng_PBR",
        "meshes": [
            "/Game/deng/010e6e97ccdfb46f14510401fe5f679b",
            "/Game/deng/3732518bc670cc69757de0549e744697",
            "/Game/deng/63947c618bd8de5e7cdf769c7b841328",
            "/Game/deng/7368043f00bd649800750ca9bc32bdcb",
            "/Game/deng/7c9013ea4b66585fb4939721c8ab77ae",
            "/Game/deng/9431a94320f810bae30c4c545ad5b2d9",
            "/Game/deng/bd86a6a94ee1be7a7c174de51ae8800d",
        ],
        "tint": (1.05, 0.98, 0.85),
        "emissive_strength": 1.60,
        "roughness_scale": 0.65,
    },
]


def configure_textures(group):
    """加载并修正 PBR 贴图色彩空间，支持自动引入最新烘焙的全彩贴图 (T_*_Color)"""
    folder = group["folder"]
    tex_color_name = group.get("tex_color_name")

    tex_base = None
    if tex_color_name:
        tex_path = f"/Game/Textures/{tex_color_name}"
        if unreal.EditorAssetLibrary.does_asset_exist(tex_path):
            tex_base = unreal.EditorAssetLibrary.load_asset(tex_path)
        else:
            # 尝试从 Content/Textures/ 自动导入全彩 PNG
            png_file = unreal.Paths.project_content_dir() + f"Textures/{tex_color_name}.png"
            if unreal.Paths.file_exists(png_file):
                task = unreal.AssetImportTask()
                task.set_editor_property("filename", png_file)
                task.set_editor_property("destination_path", "/Game/Textures")
                task.set_editor_property("destination_name", tex_color_name)
                task.set_editor_property("replace_existing", True)
                task.set_editor_property("automated", True)
                task.set_editor_property("save", True)
                unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
                if unreal.EditorAssetLibrary.does_asset_exist(tex_path):
                    tex_base = unreal.EditorAssetLibrary.load_asset(tex_path)

    if not tex_base:
        tex_base = unreal.EditorAssetLibrary.load_asset(f"{folder}/texture_pbr_20250901")

    tex_metal = unreal.EditorAssetLibrary.load_asset(f"{folder}/texture_pbr_20250901_metallic")
    tex_rough = unreal.EditorAssetLibrary.load_asset(f"{folder}/texture_pbr_20250901_roughness")
    tex_norm = unreal.EditorAssetLibrary.load_asset(f"{folder}/texture_pbr_20250901_normal")

    if tex_base:
        tex_base.set_editor_property("srgb", True)
        unreal.EditorAssetLibrary.save_loaded_asset(tex_base)

    for linear_tex in (tex_metal, tex_rough):
        if linear_tex:
            linear_tex.set_editor_property("srgb", False)
            unreal.EditorAssetLibrary.save_loaded_asset(linear_tex)

    if tex_norm:
        tex_norm.set_editor_property("srgb", False)
        tex_norm.set_editor_property(
            "compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP
        )
        unreal.EditorAssetLibrary.save_loaded_asset(tex_norm)

    return tex_base, tex_metal, tex_rough, tex_norm


def build_pbr_material(group):
    """创建或更新完整 4 通道 PBR 材质球并自动连线编译"""
    folder = group["folder"]
    mat_name = group["mat_name"]
    mat_path = f"{folder}/{mat_name}"

    tex_base, tex_metal, tex_rough, tex_norm = configure_textures(group)

    if unreal.EditorAssetLibrary.does_asset_exist(mat_path):
        mat = unreal.EditorAssetLibrary.load_asset(mat_path)
    else:
        asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
        factory = unreal.MaterialFactoryNew()
        mat = asset_tools.create_asset(mat_name, folder, unreal.Material, factory)

    if not mat:
        unreal.log_warning(f"[VR Setup] 无法创建材质: {mat_path}")
        return None

    mel = unreal.MaterialEditingLibrary
    mel.delete_all_material_expressions(mat)

    # 1. BaseColor + 暖金古建色调增强
    if tex_base:
        node_base = mel.create_material_expression(
            mat, unreal.MaterialExpressionTextureSample, -420, -260
        )
        node_base.set_editor_property("texture", tex_base)

        node_tint = mel.create_material_expression(
            mat, unreal.MaterialExpressionConstant3Vector, -420, -80
        )
        r, g, b = group["tint"]
        node_tint.set_editor_property("constant", unreal.LinearColor(r, g, b, 1.0))

        node_mul = mel.create_material_expression(
            mat, unreal.MaterialExpressionMultiply, -180, -200
        )
        mel.connect_material_expressions(node_base, "RGB", node_mul, "A")
        mel.connect_material_expressions(node_tint, "", node_mul, "B")
        mel.connect_material_property(node_mul, "", unreal.MaterialProperty.MP_BASE_COLOR)

        # Emissive 暖光自发光
        if group["emissive_strength"] > 0:
            node_em_scale = mel.create_material_expression(
                mat, unreal.MaterialExpressionConstant, -420, 40
            )
            node_em_scale.set_editor_property("r", group["emissive_strength"])
            node_em_mul = mel.create_material_expression(
                mat, unreal.MaterialExpressionMultiply, -180, 0
            )
            mel.connect_material_expressions(node_base, "RGB", node_em_mul, "A")
            mel.connect_material_expressions(node_em_scale, "", node_em_mul, "B")
            mel.connect_material_property(
                node_em_mul, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR
            )

    # 2. Metallic 金属度
    if tex_metal:
        node_metal = mel.create_material_expression(
            mat, unreal.MaterialExpressionTextureSample, -420, 180
        )
        node_metal.set_editor_property("texture", tex_metal)
        node_metal.set_editor_property(
            "sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR
        )
        mel.connect_material_property(node_metal, "R", unreal.MaterialProperty.MP_METALLIC)

    # 3. Roughness 粗糙度
    if tex_rough:
        node_rough = mel.create_material_expression(
            mat, unreal.MaterialExpressionTextureSample, -420, 380
        )
        node_rough.set_editor_property("texture", tex_rough)
        node_rough.set_editor_property(
            "sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR
        )
        node_r_scale = mel.create_material_expression(
            mat, unreal.MaterialExpressionConstant, -420, 540
        )
        node_r_scale.set_editor_property("r", group["roughness_scale"])
        node_r_mul = mel.create_material_expression(
            mat, unreal.MaterialExpressionMultiply, -180, 420
        )
        mel.connect_material_expressions(node_rough, "R", node_r_mul, "A")
        mel.connect_material_expressions(node_r_scale, "", node_r_mul, "B")
        mel.connect_material_property(node_r_mul, "", unreal.MaterialProperty.MP_ROUGHNESS)

    # 4. Normal 法线贴图
    if tex_norm:
        node_norm = mel.create_material_expression(
            mat, unreal.MaterialExpressionTextureSample, -420, 680
        )
        node_norm.set_editor_property("texture", tex_norm)
        node_norm.set_editor_property(
            "sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL
        )
        mel.connect_material_property(node_norm, "RGB", unreal.MaterialProperty.MP_NORMAL)

    mel.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    return mat


def assign_materials_and_collision(group, mat):
    """将 PBR 材质赋给静态网格体，并开启复杂碰撞以支持 VR 传送落脚"""
    if not mat:
        return
    for mesh_path in group["meshes"]:
        mesh = unreal.EditorAssetLibrary.load_asset(mesh_path)
        if not mesh:
            continue
        num_mats = mesh.get_num_sections(0) if hasattr(mesh, "get_num_sections") else 1
        for idx in range(max(1, num_mats)):
            mesh.set_material(idx, mat)

        # 为主体和平台开启复杂碰撞作为简单碰撞，确保 VR 传送射线可落在台面上
        try:
            body_setup = mesh.get_editor_property("body_setup")
            if body_setup:
                body_setup.set_editor_property(
                    "collision_trace_flag",
                    unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE,
                )
        except Exception:
            pass

        unreal.EditorAssetLibrary.save_loaded_asset(mesh)


def configure_level_scene(created_mats):
    """配置 BISHE.umap 关卡中的模型材质、体积云高度、仙气雾与 VR 出生点"""
    actors = unreal.EditorLevelLibrary.get_all_level_actors()
    has_lotus = False
    has_pagoda_lights = False

    for actor in actors:
        if not actor:
            continue
        cls_name = actor.get_class().get_name()
        label = actor.get_actor_label()

        # 1. 修复静态网格体 Actor (清除误拖到天空球的材质，更新建筑与平台材质)
        if isinstance(actor, unreal.StaticMeshActor):
            smc = actor.get_editor_property("static_mesh_component") if hasattr(actor, "get_editor_property") else actor.static_mesh_component
            if not smc:
                continue
            sm = smc.get_editor_property("static_mesh")
            sm_path = sm.get_path_name() if sm else ""

            # 如果是被误拖了粗糙度材质的 SM_SkySphere，恢复默认或隐藏以显示真实 SkyAtmosphere + VolumetricCloud
            if "SM_SkySphere" in sm_path:
                actor.set_actor_hidden_in_game(True)
                smc.set_visibility(False)
                continue

            if "zhuti" in sm_path and "/Game/zhuti" in created_mats:
                smc.set_material(0, created_mats["/Game/zhuti"])
            elif "pingtai" in sm_path and "/Game/pingtai" in created_mats:
                smc.set_material(0, created_mats["/Game/pingtai"])
            elif "lianhua" in sm_path and "/Game/lianhua" in created_mats:
                has_lotus = True
                smc.set_material(0, created_mats["/Game/lianhua"])
            elif "deng" in sm_path and "/Game/deng" in created_mats:
                smc.set_material(0, created_mats["/Game/deng"])

        # 2. 调整 VolumetricCloud 高度至仙阁与浮空台所在高度 (Z ≈ 44810 cm = 0.448 km)
        elif cls_name == "VolumetricCloud":
            comp = actor.get_component_by_class(unreal.VolumetricCloudComponent)
            if comp:
                # 建筑位于 Z=44810~44840cm (0.448km)，将云层底部设为 0.38km、厚度 0.35km，使体积云直接环绕建筑四周
                comp.set_layer_bottom_altitude(0.38)
                comp.set_layer_height(0.35)
                comp.set_tracing_start_max_distance(30.0)
                comp.set_planet_radius(6360.0)

        # 3. 调整 ExponentialHeightFog 开启体积雾 (Volumetric Fog) 环绕浮空台
        elif cls_name == "ExponentialHeightFog":
            actor.set_actor_location(unreal.Vector(75650.0, 85800.0, 44750.0), False, False)
            comp = actor.get_component_by_class(unreal.ExponentialHeightFogComponent)
            if comp:
                comp.set_volumetric_fog(True)
                comp.set_fog_density(0.025)
                comp.set_fog_height_falloff(0.25)
                comp.set_volumetric_fog_scattering_distribution(0.35)
                comp.set_volumetric_fog_albedo(unreal.Color(b=255, g=248, r=242, a=255))

        # 4. 调整 SkyLight 实时捕获
        elif cls_name == "SkyLight":
            comp = actor.get_component_by_class(unreal.SkyLightComponent)
            if comp:
                comp.set_editor_property("real_time_capture", True)
                comp.set_intensity(1.35)

        # 5. 调整 DirectionalLight 暖金阳光角度 (匹配效果图3光影)
        elif cls_name == "DirectionalLight":
            actor.set_actor_rotation(unreal.Rotator(-38.0, -125.0, 0.0), False)
            comp = actor.get_component_by_class(unreal.DirectionalLightComponent)
            if comp:
                comp.set_intensity(8.5)
                comp.set_light_color(unreal.LinearColor(1.0, 0.95, 0.86, 1.0))

        # 6. 将 VR PlayerStart 移到第一座浮空台上，正对仙阁主体
        elif cls_name == "PlayerStart":
            actor.set_actor_location(unreal.Vector(75720.0, 86010.0, 44895.0), False, False)
            actor.set_actor_rotation(unreal.Rotator(0.0, -100.0, 0.0), False)

        elif label.startswith("VR_Celestial_Light"):
            has_pagoda_lights = True

    # 7. 若关卡中尚未摆放莲花，自动在浮空台边缘点缀莲花座
    if not has_lotus:
        lotus_mesh = unreal.EditorAssetLibrary.load_asset("/Game/lianhua/莲花")
        if lotus_mesh:
            lotus_spots = [
                (unreal.Vector(75680.0, 85940.0, 44816.0), unreal.Vector(0.45, 0.45, 0.45)),
                (unreal.Vector(75760.0, 85940.0, 44816.0), unreal.Vector(0.45, 0.45, 0.45)),
                (unreal.Vector(75660.0, 85740.0, 44836.0), unreal.Vector(0.55, 0.55, 0.55)),
            ]
            for idx, (loc, scale) in enumerate(lotus_spots):
                a = unreal.EditorLevelLibrary.spawn_actor_from_object(
                    lotus_mesh, loc, unreal.Rotator(0.0, idx * 45.0, 0.0)
                )
                if a:
                    a.set_actor_scale3d(scale)
                    a.set_actor_label(f"VR_Lotus_{idx+1}")

    # 8. 在仙阁与石灯位置布置暖金点光源，烘托辉煌古建质感
    if not has_pagoda_lights:
        light_spots = [
            (unreal.Vector(75650.0, 85680.0, 44910.0), 6000.0, 800.0),
            (unreal.Vector(75740.0, 86040.0, 44835.0), 2500.0, 350.0),
            (unreal.Vector(75700.0, 86040.0, 44835.0), 2500.0, 350.0),
        ]
        for idx, (loc, intensity, radius) in enumerate(light_spots):
            l_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
                unreal.PointLight, loc, unreal.Rotator(0.0, 0.0, 0.0)
            )
            if l_actor:
                l_actor.set_actor_label(f"VR_Celestial_Light_{idx+1}")
                plc = l_actor.get_component_by_class(unreal.PointLightComponent)
                if plc:
                    plc.set_intensity(intensity)
                    plc.set_attenuation_radius(radius)
                    plc.set_light_color(unreal.LinearColor(1.0, 0.78, 0.42, 1.0))

    # 9. 自动将 UE5 编辑器视口摄像机对准建筑（复刻图3俯视对角构图视角）
    try:
        unreal.EditorLevelLibrary.set_level_viewport_camera_info(
            unreal.Vector(75810.0, 86210.0, 44985.0),
            unreal.Rotator(-22.0, -108.0, 0.0),
        )
    except Exception:
        pass


def run_full_setup():
    """一键执行全部 UE5 材质构建、模型赋材质、体积云环绕与关卡保存"""
    unreal.log("==========================================================")
    unreal.log("[VR Setup] 开始自动装配《毕设1》PBR 材质、体积云与 VR 关卡...")
    created_mats = {}
    for group in ASSET_GROUPS:
        try:
            mat = build_pbr_material(group)
            if mat:
                created_mats[group["folder"]] = mat
                assign_materials_and_collision(group, mat)
                unreal.log(f"[VR Setup] 已完成 PBR 材质编译与绑定: {group['mat_name']}")
        except Exception as exc:
            unreal.log_warning(f"[VR Setup] 处理 {group['folder']} 时出错: {exc}")

    try:
        configure_level_scene(created_mats)
        unreal.EditorLevelLibrary.save_current_level()
        unreal.log("[VR Setup] BISHE.umap 关卡体积云、仙灯与 VR 出生点配置完毕并已保存！")
    except Exception as exc:
        unreal.log_warning(f"[VR Setup] 配置关卡时出错: {exc}")
    unreal.log("==========================================================")


if __name__ == "__main__":
    run_full_setup()
