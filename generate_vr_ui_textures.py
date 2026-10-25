#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成《凌霄仙阁》VR 3D 登录注册与身份认证面板的高清 PBR / UMG 贴图资源
包含：
1. T_VR_Login_Station_BG.png (1920x1080): 仙阁玄青底板、金丝云纹边框、分栏框
2. T_Card_Expert.png (560x220): 评审专家 身份卡
3. T_Card_Teacher.png (560x220): 指导教师 身份卡
4. T_Card_Student.png (560x220): 参展学生 身份卡
5. T_Card_Visitor.png (560x220): 游客观众 身份卡
6. T_Button_Gold_Normal.png / T_Button_Gold_Hover.png: 暖金流光按钮
7. T_VR_Key_Normal.png / T_VR_Key_Hover.png: 3D 虚拟软键盘按键
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "毕设1/Content/Textures/UI"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 寻找字体
FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
]
FONT_SONG = None
for p in FONT_PATHS:
    if os.path.exists(p):
        FONT_SONG = p
        break

def get_font(size, bold=False):
    if FONT_SONG:
        try:
            return ImageFont.truetype(FONT_SONG, size)
        except Exception:
            pass
    return ImageFont.load_default()

def draw_corner_ornaments(draw, x0, y0, x1, y1, color, size=24, line_w=3):
    """绘制传统古建金石四角折角纹"""
    # 左上
    draw.line([(x0, y0 + size), (x0, y0), (x0 + size, y0)], fill=color, width=line_w)
    draw.line([(x0 + 6, y0 + size - 6), (x0 + 6, y0 + 6), (x0 + size - 6, y0 + 6)], fill=color, width=1)
    # 右上
    draw.line([(x1 - size, y0), (x1, y0), (x1, y0 + size)], fill=color, width=line_w)
    draw.line([(x1 - size + 6, y0 + 6), (x1 - 6, y0 + 6), (x1 - 6, y0 + size - 6)], fill=color, width=1)
    # 左下
    draw.line([(x0, y1 - size), (x0, y1), (x0 + size, y1)], fill=color, width=line_w)
    draw.line([(x0 + 6, y1 - size + 6), (x0 + 6, y1 - 6), (x0 + size - 6, y1 - 6)], fill=color, width=1)
    # 右下
    draw.line([(x1 - size, y1), (x1, y1), (x1, y1 - size)], fill=color, width=line_w)
    draw.line([(x1 - size + 6, y1 - 6), (x1 - 6, y1 - 6), (x1 - 6, y1 - size + 6)], fill=color, width=1)


def generate_main_bg():
    w, h = 1920, 1080
    im = Image.new("RGBA", (w, h), (11, 19, 43, 240))
    draw = ImageDraw.Draw(im)

    # 1. 渐变背景光晕
    for y in range(h):
        ratio = y / h
        r = int(11 + 8 * (1 - ratio) + 12 * ratio)
        g = int(19 + 12 * (1 - ratio) + 8 * ratio)
        b = int(43 + 25 * (1 - ratio) + 10 * ratio)
        alpha = int(235 + 15 * math.sin(ratio * math.pi))
        draw.line([(0, y), (w, y)], fill=(r, g, b, alpha))

    # 2. 外部主边框与金石角花
    border_color = (212, 175, 55, 230)
    draw.rectangle([20, 20, w - 21, h - 21], outline=border_color, width=3)
    draw.rectangle([28, 28, w - 29, h - 29], outline=(212, 175, 55, 100), width=1)
    draw_corner_ornaments(draw, 20, 20, w - 21, h - 21, border_color, size=48, line_w=4)

    # 3. 顶部 Header 装饰条
    draw.line([(60, 120), (w - 61, 120)], fill=(212, 175, 55, 160), width=2)
    draw.line([(60, 124), (w - 61, 124)], fill=(46, 196, 182, 120), width=1)

    # 顶部标题文字
    font_title = get_font(44)
    font_sub = get_font(20)
    title_text = "凌 霄 仙 阁 · VR 数 字 展 厅 通 行 认 证"
    sub_text = "OPENXR IMMERSIVE AUTHENTICATION & ACCESS CONTROL STATION"

    tb_t = draw.textbbox((0, 0), title_text, font=font_title)
    tw_t = tb_t[2] - tb_t[0]
    draw.text(((w - tw_t) // 2, 40), title_text, font=font_title, fill=(245, 225, 165, 255))

    tb_s = draw.textbbox((0, 0), sub_text, font=font_sub)
    tw_s = tb_s[2] - tb_s[0]
    draw.text(((w - tw_s) // 2, 92), sub_text, font=font_sub, fill=(180, 210, 225, 220))

    # 4. 左右分栏面板背景
    # 左栏：答辩身份通道
    left_x0, left_y0, left_x1, left_y1 = 60, 150, 920, 960
    draw.rectangle([left_x0, left_y0, left_x1, left_y1], fill=(16, 26, 56, 190), outline=(212, 175, 55, 120), width=2)
    draw_corner_ornaments(draw, left_x0, left_y0, left_x1, left_y1, (212, 175, 55, 180), size=24, line_w=2)

    font_sec = get_font(26)
    font_sec_desc = get_font(16)
    draw.text((left_x0 + 30, left_y0 + 20), "通道一：毕业答辩快速通道 (一键免密认证)", font=font_sec, fill=(245, 225, 165, 255))
    draw.text((left_x0 + 30, left_y0 + 54), "专为答辩评审与演示设计，手柄激光对准卡片点击即可瞬间进入展厅", font=font_sec_desc, fill=(170, 195, 210, 200))

    # 右栏：常规登录与虚拟键盘
    right_x0, right_y0, right_x1, right_y1 = 960, 150, w - 60, 960
    draw.rectangle([right_x0, right_y0, right_x1, right_y1], fill=(16, 26, 56, 190), outline=(46, 196, 182, 120), width=2)
    draw_corner_ornaments(draw, right_x0, right_y0, right_x1, right_y1, (46, 196, 182, 180), size=24, line_w=2)

    draw.text((right_x0 + 30, right_y0 + 20), "通道二：账号登录 / 注册新用户 (3D软键盘交互)", font=font_sec, fill=(245, 225, 165, 255))
    draw.text((right_x0 + 30, right_y0 + 54), "支持手柄射线全按键输入，实时同步本地云端数据库 (HTTP API)", font=font_sec_desc, fill=(170, 195, 210, 200))

    # 底部状态栏
    draw.line([(60, 990), (w - 61, 990)], fill=(212, 175, 55, 100), width=1)
    font_stat = get_font(18)
    draw.text((70, 1010), "[ 服务就绪 ] 展厅后端: http://127.0.0.1:8080 (支持局域网同步)", font=font_stat, fill=(46, 196, 182, 230))
    draw.text((w - 580, 1010), "[ 交互提示 ] 扣动 VR 手柄 Index Trigger 扳机键发射激光点击交互", font=font_stat, fill=(245, 225, 165, 230))

    im.save(os.path.join(OUTPUT_DIR, "T_VR_Login_Station_BG.png"), "PNG")
    print("Generated T_VR_Login_Station_BG.png")


def generate_identity_card(name, tag, desc, cred, grad_colors, filename):
    w, h = 800, 150
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    c_start, c_end, border_col = grad_colors

    # 渐变底色
    for x in range(w):
        t = x / w
        r = int(c_start[0] * (1 - t) + c_end[0] * t)
        g = int(c_start[1] * (1 - t) + c_end[1] * t)
        b = int(c_start[2] * (1 - t) + c_end[2] * t)
        draw.line([(x, 0), (x, h)], fill=(r, g, b, 225))

    # 边框与金石角花
    draw.rectangle([0, 0, w - 1, h - 1], outline=border_col, width=2)
    draw_corner_ornaments(draw, 0, 0, w - 1, h - 1, border_col, size=16, line_w=2)

    # 身份印章块
    stamp_w, stamp_h = 100, 100
    stamp_x, stamp_y = 25, 25
    draw.rectangle([stamp_x, stamp_y, stamp_x + stamp_w, stamp_y + stamp_h], fill=(12, 20, 42, 210), outline=border_col, width=2)
    font_seal = get_font(38)
    seal_char = name[:1]
    tb = draw.textbbox((0, 0), seal_char, font=font_seal)
    draw.text((stamp_x + (stamp_w - (tb[2]-tb[0]))//2, stamp_y + (stamp_h - (tb[3]-tb[1]))//2 - 4), seal_char, font=font_seal, fill=border_col)

    # 身份名称与标签
    font_name = get_font(30)
    font_tag = get_font(18)
    font_desc = get_font(18)
    font_cred = get_font(16)

    draw.text((145, 26), name, font=font_name, fill=(255, 255, 255, 255))

    # Tag 胶囊背景
    tb_tag = draw.textbbox((0, 0), tag, font=font_tag)
    tag_w = tb_tag[2] - tb_tag[0] + 16
    draw.rectangle([310, 30, 310 + tag_w, 56], fill=(212, 175, 55, 50), outline=border_col, width=1)
    draw.text((318, 32), tag, font=font_tag, fill=border_col)

    # 权限描述
    draw.text((145, 72), desc, font=font_desc, fill=(210, 225, 240, 230))
    # 快捷凭据提示
    draw.text((145, 104), f"凭据通道: {cred}", font=font_cred, fill=(160, 185, 205, 190))

    # 右侧箭头提示 [ 进入 > ]
    draw.rectangle([w - 140, 48, w - 30, 102], fill=(212, 175, 55, 40), outline=border_col, width=2)
    font_btn = get_font(20)
    draw.text((w - 122, 63), "点击通行", font=font_btn, fill=(255, 245, 210, 255))

    im.save(os.path.join(OUTPUT_DIR, filename), "PNG")
    print(f"Generated {filename}")


def generate_buttons():
    # 金色常规主按钮
    w, h = 360, 70
    for state, col_start, col_end, border in [
        ("Normal", (180, 140, 30), (220, 185, 60), (245, 225, 140)),
        ("Hover", (215, 175, 45), (255, 220, 90), (255, 250, 190)),
        ("Pressed", (150, 115, 20), (190, 150, 40), (210, 175, 80))
    ]:
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)
        for y in range(h):
            t = y / h
            r = int(col_start[0] * (1 - t) + col_end[0] * t)
            g = int(col_start[1] * (1 - t) + col_end[1] * t)
            b = int(col_start[2] * (1 - t) + col_end[2] * t)
            draw.line([(0, y), (w, y)], fill=(r, g, b, 245))
        draw.rectangle([0, 0, w - 1, h - 1], outline=border, width=2)
        draw_corner_ornaments(draw, 0, 0, w - 1, h - 1, border, size=12, line_w=2)
        im.save(os.path.join(OUTPUT_DIR, f"T_Button_Gold_{state}.png"), "PNG")

    # 3D 软键盘按键
    kw, kh = 64, 64
    for k_state, bg_col, bdr_col in [
        ("Normal", (24, 38, 70, 230), (212, 175, 55, 150)),
        ("Hover", (40, 65, 115, 245), (255, 225, 100, 240)),
        ("Pressed", (60, 90, 150, 255), (46, 196, 182, 255))
    ]:
        k_im = Image.new("RGBA", (kw, kh), bg_col)
        k_draw = ImageDraw.Draw(k_im)
        k_draw.rectangle([0, 0, kw - 1, kh - 1], outline=bdr_col, width=2)
        k_im.save(os.path.join(OUTPUT_DIR, f"T_VR_Key_{k_state}.png"), "PNG")

    print("Generated button and key textures.")


if __name__ == "__main__":
    generate_main_bg()
    generate_identity_card(
        "评审专家",
        "特权全开",
        "权限：全展厅全景传送漫游 · 展品模型旋转评析 · 评审专家批注留言",
        "admin (特权免密直达)",
        ((35, 25, 65), (20, 35, 75), (245, 215, 110)),
        "T_Card_Expert.png"
    )
    generate_identity_card(
        "指导教师",
        "教务评阅",
        "权限：全展台巡回审阅 · 毕业设计成绩审定 · 展品历史版本回溯",
        "admin / 123",
        ((15, 45, 55), (25, 30, 65), (46, 196, 182)),
        "T_Card_Teacher.png"
    )
    generate_identity_card(
        "参展学生",
        "作品创作者",
        "权限：个人毕业展台管理 · 3D展品模型上传配置 · 展厅互动留言",
        "student / 123",
        ((20, 35, 65), (15, 25, 50), (100, 180, 255)),
        "T_Card_Student.png"
    )
    generate_identity_card(
        "游客观众",
        "访客漫游",
        "权限：展厅第一人称漫游 · 凌霄仙阁全景观赏 · 展品点赞点评",
        "免密访客通行证",
        ((25, 40, 45), (18, 28, 48), (200, 220, 240)),
        "T_Card_Visitor.png"
    )
    generate_buttons()
    print("All VR UI Textures successfully generated in Content/Textures/UI/!")
