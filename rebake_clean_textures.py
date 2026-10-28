import os
import subprocess
import numpy as np
from PIL import Image, ImageFilter

OUT_DIR = "vr_digital_showroom/public/assets/textures"
UE_TEX_DIR = "毕设1/Content/Textures"
SCRATCH = "/Users/sml/.gemini/antigravity/brain/36a1c08b-28ef-43c5-8b39-10727ef6604c/scratch"

os.makedirs(UE_TEX_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

def load_raw_greyscale(prefix):
    uasset = f"毕设1/Content/{prefix}/texture_pbr_20250901.uasset"
    extractor = f"{SCRATCH}/ooz_src/extract_payload"
    env = os.environ.copy()
    env["DYLD_LIBRARY_PATH"] = f"{SCRATCH}/ooz_src"
    raw = subprocess.check_output([extractor, uasset, "/dev/stdout"], env=env)
    arr = np.frombuffer(raw[:67108864], dtype=np.uint8).reshape((128, 32, 4096, 4))
    arr = np.cumsum(arr, axis=1, dtype=np.uint16).astype(np.uint8).reshape((4096, 4096, 4))
    rgb = arr[:, :, [2, 1, 0]]
    im = Image.fromarray(rgb, mode="RGB").resize((2048, 2048), Image.Resampling.LANCZOS)
    lum = np.array(im, dtype=np.float32).mean(axis=-1) / 255.0
    return lum

def load_raw_normal(prefix):
    uasset = f"毕设1/Content/{prefix}/texture_pbr_20250901_normal.uasset"
    extractor = f"{SCRATCH}/ooz_src/extract_payload"
    env = os.environ.copy()
    env["DYLD_LIBRARY_PATH"] = f"{SCRATCH}/ooz_src"
    raw = subprocess.check_output([extractor, uasset, "/dev/stdout"], env=env)
    arr = np.frombuffer(raw[:67108864], dtype=np.uint8).reshape((128, 32, 4096, 4))
    arr = np.cumsum(arr, axis=1, dtype=np.uint16).astype(np.uint8).reshape((4096, 4096, 4))
    rgb = arr[:, :, [2, 1, 0]]
    im = Image.fromarray(rgb, mode="RGB").resize((2048, 2048), Image.Resampling.LANCZOS)
    norm = np.array(im, dtype=np.float32) / 255.0
    nx_t = norm[:, :, 0] * 2.0 - 1.0
    ny_t = norm[:, :, 1] * 2.0 - 1.0
    slope = np.clip(np.hypot(nx_t, ny_t), 0.0, 1.0)
    return norm, slope

def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0 + 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

def lerp_color(c0, c1, w):
    w = w[..., None]
    return c0 * (1.0 - w) + c1 * w

MARBLE_LIGHT  = np.array([0.925, 0.905, 0.870], dtype=np.float32)
MARBLE_SHADOW = np.array([0.700, 0.660, 0.600], dtype=np.float32)
GOLD_BRIGHT   = np.array([0.895, 0.705, 0.295], dtype=np.float32)
GOLD_DEEP     = np.array([0.590, 0.420, 0.145], dtype=np.float32)
GOLD_GROOVE   = np.array([0.480, 0.330, 0.110], dtype=np.float32)
JADE_LIGHT    = np.array([0.550, 0.670, 0.780], dtype=np.float32) # Low-saturation celestial misty glaze (calibrated for PBR scene lighting to match user ref)
JADE_DEEP     = np.array([0.380, 0.480, 0.590], dtype=np.float32) # Subtle shadow tone for desaturated celadon door

print("Baking authentic zhuti texture...")
lum = load_raw_greyscale("zhuti")
norm_t, slope = load_raw_normal("zhuti")
uv_buf = np.fromfile(f"{SCRATCH}/zhuti_uv.bin", dtype=np.float32).reshape((2048, 2048, 7))
px, py, pz, nx, ny, nz, valid = [uv_buf[:, :, i] for i in range(7)]

lum_blur = np.array(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=12)), dtype=np.float32) / 255.0
detail = lum - lum_blur
lum_norm = np.clip((lum - 0.24) / 0.56, 0.0, 1.0)

base_marble = lerp_color(MARBLE_SHADOW, MARBLE_LIGHT, smoothstep(0.05, 0.92, lum_norm))
base_gold   = lerp_color(GOLD_DEEP, GOLD_BRIGHT, smoothstep(0.08, 0.88, lum_norm))
base_jade   = lerp_color(JADE_DEEP, JADE_LIGHT, smoothstep(0.05, 0.88, lum_norm))

# Centered coordinate frame for regular octagonal pagoda geometry:
x0, z0 = -0.28, -0.35
dx = px - x0
dz = pz - z0
r_xz = np.hypot(dx, dz)
ang_deg = np.degrees(np.arctan2(dz, dx)) % 360.0

gold_mask = np.zeros_like(lum)
jade_mask = np.zeros_like(lum)
groove_mask = np.zeros_like(lum)

# A. Spire
gold_mask = np.maximum(gold_mask, smoothstep(67.5, 68.6, py))

# B. Roof Hip Ridges & Eaves
roof_band = smoothstep(56.8, 57.8, py) * (1.0 - smoothstep(68.2, 69.2, py))
dist_from_corner = np.abs((ang_deg % 45.0) - 22.5)
ridge_mask = roof_band * (1.0 - smoothstep(2.6, 4.8, dist_from_corner))
ridge_edge = roof_band * smoothstep(2.4, 3.4, dist_from_corner) * (1.0 - smoothstep(3.4, 4.8, dist_from_corner))
groove_mask = np.maximum(groove_mask, ridge_edge * 0.65)
eave_rim = smoothstep(55.2, 56.2, py) * (1.0 - smoothstep(59.8, 60.8, py)) * smoothstep(21.5, 24.0, r_xz)
gold_mask = np.maximum(gold_mask, np.maximum(ridge_mask, eave_rim))

# C. Classical Architectural Arched Doors & Symmetrical Gold Moldings
# Strictly coaxial 8-bay alignment across all 3 tiers (0, 45, 90, 135, 180, 225, 270, 315 deg)
tiers_arch_config = [
    # Tier 3 (top floor arched doors reaching down to balcony floor 43.0)
    (43.0, 49.5, 1.4, 2.0, [
        (0.0, 15.20), (45.0, 16.16), (90.0, 16.35), (135.0, 16.10),
        (180.0, 15.21), (225.0, 15.73), (270.0, 15.58), (315.0, 15.72)
    ]),
    # Tier 2 (middle floor arched doors reaching down to balcony floor 26.5)
    (26.5, 33.5, 1.8, 2.5, [
        (0.0, 18.90), (45.0, 20.19), (90.0, 20.38), (135.0, 20.18),
        (180.0, 18.93), (225.0, 20.72), (270.0, 20.57), (315.0, 20.57)
    ]),
    # Tier 1 (ground floor arched entrance doors reaching down to terrace floor 10.0)
    (10.0, 17.5, 2.0, 2.8, [
        (0.0, 23.86), (45.0, 24.16), (90.0, 23.42), (135.0, 24.20),
        (180.0, 23.58), (225.0, 25.28), (270.0, 25.40), (315.0, 25.21)
    ])
]

for y_lo, y_arch, w_door, w_frame, bays in tiers_arch_config:
    for c_ang, d_wall in bays:
        rad = np.radians(c_ang)
        u_loc = -dx * np.sin(rad) + dz * np.cos(rad)
        d_norm = dx * np.cos(rad) + dz * np.sin(rad)
        
        # Arch height boundary:
        arch_top = y_arch + np.sqrt(np.maximum(0.0, w_door**2 - u_loc**2)) * 0.85
        frame_arch_top = y_arch + np.sqrt(np.maximum(0.0, w_frame**2 - u_loc**2)) * 0.85 + 0.4
        
        # Isolate flat recessed wall surface around d_wall (exclude distant railing or corner geometry)
        in_wall = (valid > 0.5) & (np.abs(d_norm - d_wall) <= 1.5) & (py >= y_lo)
        
        is_door = in_wall & (py <= arch_top) & (np.abs(u_loc) <= w_door)
        jade_mask = np.maximum(jade_mask, is_door.astype(np.float32))
        
        # Symmetrical golden molding frame:
        is_outer = in_wall & (py <= frame_arch_top) & (np.abs(u_loc) <= w_frame)
        is_frame = is_outer & (~is_door)
        gold_mask = np.maximum(gold_mask, is_frame.astype(np.float32) * 0.95)

# D. Pagoda Balustrades: WHITE MARBLE bodies + GOLD FINIALS on post tops
for y_finial_lo, y_finial_hi, r_bal_lo, r_bal_hi in [
    (44.2, 46.0, 19.5, 25.5),
    (30.2, 32.0, 23.5, 30.8),
    (12.2, 14.0, 28.5, 37.0)
]:
    m_bal = smoothstep(r_bal_lo, r_bal_lo + 1.0, r_xz) * (1.0 - smoothstep(r_bal_hi - 1.0, r_bal_hi, r_xz))
    gold_finial = m_bal * smoothstep(y_finial_lo, y_finial_lo + 0.4, py) * (1.0 - smoothstep(y_finial_hi, y_finial_hi + 0.4, py))
    gold_mask = np.maximum(gold_mask, gold_finial * 0.95)

# E. Lotus Base ribs & Pagoda Entrance Stairs
lotus_band = 1.0 - smoothstep(8.5, 9.8, py)
is_pagoda_stairs = smoothstep(19.0, 22.0, pz) * (1.0 - smoothstep(9.0, 12.5, np.abs(px)))
lotus_gold = lotus_band * smoothstep(0.04, 0.15, detail + slope * 0.2) * (1.0 - is_pagoda_stairs) * 0.85
gold_mask = np.maximum(gold_mask, lotus_gold)

gold_mask = np.clip(gold_mask, 0.0, 1.0)
jade_mask = np.clip(jade_mask, 0.0, 1.0)

zhuti_col = lerp_color(base_marble, base_gold, gold_mask)
zhuti_col = lerp_color(zhuti_col, GOLD_GROOVE, groove_mask)
# Apply jade over gold for door panels:
zhuti_col = lerp_color(zhuti_col, base_jade, jade_mask)

zhuti_metal = np.clip(0.04 + gold_mask * 0.34, 0.0, 1.0)
zhuti_rough = np.clip(0.68 - gold_mask * 0.28 - jade_mask * 0.15 + (1.0 - lum_norm) * 0.10, 0.22, 0.92)

Image.fromarray((np.clip(zhuti_col, 0, 1) * 255).astype(np.uint8)).save(f"{OUT_DIR}/zhuti.jpg", quality=95)
Image.fromarray((np.clip(zhuti_col, 0, 1) * 255).astype(np.uint8)).save(f"{UE_TEX_DIR}/T_Zhuti_Color.png")
Image.fromarray((zhuti_metal * 255).astype(np.uint8), mode="L").save(f"{OUT_DIR}/zhuti_metallic.jpg", quality=90)
Image.fromarray((zhuti_rough * 255).astype(np.uint8), mode="L").save(f"{OUT_DIR}/zhuti_roughness.jpg", quality=90)
print("Zhuti rebaked with 100% symmetric classical arch doors across all 24 bays!")
