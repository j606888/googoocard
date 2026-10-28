#!/usr/bin/env python3
"""產生「遊戲版 D · 奇異鳥小鎮」設計稿（等角視角，全部手寫 SVG）。"""
import os

# 輸出：設計畫布用的 .dc.html 放 OUT，可直接用瀏覽器打開的預覽放 PREV。
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("FINANCE_GAME_OUT", os.path.join(HERE, "out"))
PREV = os.environ.get("FINANCE_GAME_PREVIEW", os.path.join(OUT, "preview"))
os.makedirs(OUT, exist_ok=True)
os.makedirs(PREV, exist_ok=True)

HX, HY = 32, 16
OX, OY = 680, 40
W, H = 1280, 800
INK = "#4D4239"
SUB = "#8C7B6B"


def P(gx, gy, z=0):
    return (OX + (gx - gy) * HX, OY + (gx + gy) * HY - z)


def pts(ps):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in ps)


def poly(ps, fill, extra=""):
    return f'<polygon points="{pts(ps)}" fill="{fill}" {extra}/>'


def box(gx, gy, w, d, h, c, z=0):
    top, left, right = c
    return (poly([P(gx, gy + d, z), P(gx + w, gy + d, z), P(gx + w, gy + d, z + h), P(gx, gy + d, z + h)], left)
            + poly([P(gx + w, gy, z), P(gx + w, gy + d, z), P(gx + w, gy + d, z + h), P(gx + w, gy, z + h)], right)
            + poly([P(gx, gy, z + h), P(gx + w, gy, z + h), P(gx + w, gy + d, z + h), P(gx, gy + d, z + h)], top))


def fl(gx0, gx1, gy, z0, z1, fill, extra=""):
    """矩形貼在左前面（gy 固定）。"""
    return poly([P(gx0, gy, z0), P(gx1, gy, z0), P(gx1, gy, z1), P(gx0, gy, z1)], fill, extra)


def fr(gy0, gy1, gx, z0, z1, fill, extra=""):
    """矩形貼在右前面（gx 固定）。"""
    return poly([P(gx, gy0, z0), P(gx, gy1, z0), P(gx, gy1, z1), P(gx, gy0, z1)], fill, extra)


def arch_l(gxc, hw, gy, z0, zt, hz, fill):
    import math
    ps = [P(gxc - hw, gy, z0), P(gxc - hw, gy, zt)]
    for i in range(1, 12):
        t = math.pi - math.pi * i / 12
        ps.append(P(gxc + hw * math.cos(t), gy, zt + hz * math.sin(t)))
    ps += [P(gxc + hw, gy, zt), P(gxc + hw, gy, z0)]
    return poly(ps, fill)


# ---------- 顏色 ----------
GROUND = "#CDDA9F"
CRATE = ("#F7D88F", "#EBBE6B", "#D5A256")
WALLC = ("#F4CDB3", "#E9B195", "#D5987C")
STONE = ("#F6F1E8", "#EBE3D5", "#D8CDBB")
CREAM = ("#FFF6E6", "#F7E8CE", "#E7D2B0")
MINT = ("#EEF7F3", "#D6ECE4", "#BFDCD2")
WOOD = ("#E5BE90", "#D2A474", "#BC8B5C")


# ---------- 小物件 ----------
def kiwi(x, y, s=1.0, scarf="#4BB38B", flip=False, acc=None):
    f = -1 if flip else 1
    g = ['<ellipse cx="0" cy="1" rx="15" ry="5" fill="#55632E" opacity=".18"/>',
         '<path d="M-5 -4 l-1.8 5.5 M4 -4 l1.8 5.5" stroke="#E39B4A" stroke-width="2.8" stroke-linecap="round"/>']
    if acc == "pack":
        g.append('<rect x="-22" y="-27" width="13" height="16" rx="4.5" fill="#F2B35B"/><rect x="-20" y="-22" width="9" height="5" rx="2" fill="#E59A3E"/>')
    g.append('<ellipse cx="0" cy="-13" rx="15.5" ry="12.5" fill="#BF9064"/>')
    g.append('<path d="M-15.5 -12 a15.5 12.5 0 0 0 31 0 q-15.5 7 -31 0z" fill="#A97C52"/>')
    g.append('<ellipse cx="-4" cy="-18" rx="8" ry="4.5" fill="#D3AC80" opacity=".75"/>')
    g.append('<circle cx="10" cy="-20" r="8.5" fill="#BF9064"/>')
    if acc == "pack":
        g.append('<path d="M-9 -24 q4 6 2 14" stroke="#E59A3E" stroke-width="2.2" fill="none" stroke-linecap="round"/>')
    if acc == "sack":
        g.append('<path d="M-25 -2 q-6 -9 1 -13 l-2 -3.5 h8.5 l-2 3.5 q7 4 1.5 13z" fill="#F2C45A"/><path d="M-23.5 -16 h7" stroke="#D29A2E" stroke-width="1.6"/>')
    g.append('<path d="M16.5 -19.5 q8 3 12.5 12" stroke="#F1D39C" stroke-width="3.4" fill="none" stroke-linecap="round"/>')
    g.append('<circle cx="12.6" cy="-22.5" r="1.9" fill="#3D3029"/><circle cx="13.3" cy="-23.2" r=".7" fill="#fff"/>')
    g.append('<ellipse cx="12.5" cy="-17.6" rx="2.8" ry="1.7" fill="#F4A79E" opacity=".85"/>')
    g.append(f'<path d="M2.5 -15.5 q7 3.2 13.5 -1.2 l.8 4 q-7 4.2 -14.4 1.4z" fill="{scarf}"/><path d="M5 -12 l-2.5 6.5 l4.5 -1.4z" fill="{scarf}"/>')
    if acc == "crown":
        g.append('<path d="M4.5 -27 l1.6 -7 l3.4 4.2 l2.6 -5.6 l2.6 5.6 l3.4 -4.2 l1.4 7z" fill="#F6C344"/><circle cx="12" cy="-33.6" r="1.3" fill="#F08A7E"/>')
    if acc == "cap":
        g.append('<path d="M2.5 -25.5 q8 -10 16.5 -1.2z" fill="#6FA8DC"/><path d="M16 -25.6 l8 1.6 l-8 1z" fill="#4F8FC6"/>')
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({f * s:.2f} {s:.2f})">{"".join(g)}</g>'


def shadow(x, y, rx, ry, op=.16):
    return f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx}" ry="{ry}" fill="#55632E" opacity="{op}"/>'


def pine(gx, gy, h=62, s=1.0, c1="#93BE6E", c2="#729F57"):
    x, y = P(gx, gy)
    r = 16 * s
    out = shadow(x + 4, y + 1, r + 6, (r + 6) / 2.2)
    out += f'<rect x="{x - 2.5:.1f}" y="{y - 12:.1f}" width="5" height="13" rx="2" fill="#9C7A56"/>'
    for bw, by, ty in [(r, y - 9, y - 9 - h * .62), (r * .76, y - 9 - h * .36, y - 9 - h)]:
        out += poly([(x - bw, by), (x, by + bw * .34), (x, ty)], c1) + poly([(x, by + bw * .34), (x + bw, by), (x, ty)], c2)
    return out


def round_tree(gx, gy, s=1.0, c=("#B2D47F", "#93BE66", "#C9E39C"), fruit=False):
    x, y = P(gx, gy)
    out = shadow(x + 3, y + 1, 22 * s, 9 * s)
    out += f'<rect x="{x - 3 * s:.1f}" y="{y - 20 * s:.1f}" width="{6 * s:.1f}" height="{21 * s:.1f}" rx="2.5" fill="#A07B55"/>'
    for cx, cy, r, col in [(-10, -30, 14, c[1]), (10, -30, 14, c[1]), (0, -41, 16, c[0]), (-5, -46, 7, c[2])]:
        out += f'<circle cx="{x + cx * s:.1f}" cy="{y + cy * s:.1f}" r="{r * s:.1f}" fill="{col}"/>'
    if fruit:
        for fx, fy in [(-12, -27), (7, -24), (12, -36), (-4, -36), (2, -50), (-15, -38)]:
            out += f'<circle cx="{x + fx * s:.1f}" cy="{y + fy * s:.1f}" r="{2.8 * s:.1f}" fill="#E8735F"/>'
    return out


def bush(gx, gy, s=1.0, c=("#A9CF79", "#8FBB63")):
    x, y = P(gx, gy)
    return (shadow(x, y + 1, 15 * s, 6 * s)
            + f'<circle cx="{x - 6 * s:.1f}" cy="{y - 6 * s:.1f}" r="{8 * s:.1f}" fill="{c[1]}"/>'
            + f'<circle cx="{x + 6 * s:.1f}" cy="{y - 6 * s:.1f}" r="{8 * s:.1f}" fill="{c[1]}"/>'
            + f'<circle cx="{x:.1f}" cy="{y - 11 * s:.1f}" r="{9 * s:.1f}" fill="{c[0]}"/>')


def rock(gx, gy, s=1.0):
    x, y = P(gx, gy)
    return (f'<ellipse cx="{x:.1f}" cy="{y - 3 * s:.1f}" rx="{11 * s:.1f}" ry="{7 * s:.1f}" fill="#CFC7B5"/>'
            f'<ellipse cx="{x - 2 * s:.1f}" cy="{y - 5 * s:.1f}" rx="{8 * s:.1f}" ry="{4.5 * s:.1f}" fill="#E3DDCF"/>')


def flowers(gx, gy, col="#FFFFFF"):
    x, y = P(gx, gy)
    out = ""
    for dx, dy in [(-6, 0), (0, -3), (6, 1), (2, 4)]:
        out += f'<circle cx="{x + dx:.1f}" cy="{y + dy:.1f}" r="2.3" fill="{col}"/><circle cx="{x + dx:.1f}" cy="{y + dy:.1f}" r=".9" fill="#F3C24E"/>'
    return out


def marker(gx, gy):
    """路標：白色柱子＋藍色圓盤。"""
    x, y = P(gx, gy)
    return (shadow(x, y + 1, 6, 2.5, .2)
            + f'<rect x="{x - 1.6:.1f}" y="{y - 20:.1f}" width="3.2" height="20" rx="1.4" fill="#FFFFFF"/>'
            + f'<ellipse cx="{x:.1f}" cy="{y - 21:.1f}" rx="6" ry="3.4" fill="#8CC0DD"/>'
            + f'<ellipse cx="{x - 1.5:.1f}" cy="{y - 22:.1f}" rx="2.5" ry="1.2" fill="#D6ECF6"/>')


def crate(gx, gy, z, s=.62):
    hz = s * 34
    out = box(gx, gy, s, s, hz, CRATE, z)
    out += fl(gx, gx + s, gy + s, z + hz * .42, z + hz * .58, "#D9A452")
    out += fr(gy, gy + s, gx + s, z + hz * .42, z + hz * .58, "#C48F42")
    return out


# ---------- 平面圖層（格子座標） ----------
def iso_group(inner, lift=0):
    return f'<g transform="translate(0 {-lift}) matrix({HX} {HY} {-HX} {HY} {OX} {OY})">{inner}</g>'


flat = []
# 地面色塊
for cx, cy, r, col in [(4, 2, 3, "#C3D28F"), (16, 18, 3.4, "#C3D28F"), (24, 3, 3, "#D6E1AC"), (6, 22, 2.6, "#D6E1AC"),
                       (26, 16, 2.4, "#C3D28F"), (1, 15, 2.2, "#D6E1AC"), (9, -2, 2.8, "#D6E1AC"), (20, -1, 2, "#C3D28F")]:
    flat.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}"/>')
# 台南花園
flat.append('<rect x="2.2" y="12.9" width="10.6" height="8.6" rx="1.6" fill="#D8E2A8"/>')
# 高雄廣場
flat.append('<rect x="10.2" y="1.2" width="14" height="9.7" rx="1" fill="#E4E1CD"/>')
flat.append('<rect x="10.2" y="1.2" width="14" height="9.7" rx="1" fill="url(#pave)"/>')
flat.append('<rect x="11" y="2" width="7.8" height="6.6" fill="#EADFC6"/>')
# 河
flat.append('<rect x="-12" y="10.95" width="50" height="1.6" rx=".6" fill="#E3F0DA"/>')
flat.append('<circle cx="1.6" cy="10.4" r="2.25" fill="#E3F0DA"/>')
flat.append('<rect x="-12" y="11.15" width="50" height="1.2" rx=".5" fill="#9DD3CB"/>')
flat.append('<circle cx="1.6" cy="10.4" r="2.0" fill="#9DD3CB"/>')
flat.append('<circle cx="1.6" cy="10.4" r="1.1" fill="#8BC8C0"/>')
flat.append('<g opacity=".7"><rect x="-6" y="11.5" width="1.6" height=".08" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;1.2 0;0 0" dur="5s" repeatCount="indefinite"/></rect>'
            '<rect x="6" y="11.9" width="1.2" height=".08" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;1 0;0 0" dur="4s" repeatCount="indefinite"/></rect>'
            '<rect x="17" y="11.45" width="1.4" height=".08" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;1.2 0;0 0" dur="6s" repeatCount="indefinite"/></rect>'
            '<rect x="25" y="11.85" width="1.2" height=".08" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;1 0;0 0" dur="5s" repeatCount="indefinite"/></rect></g>')
for lx, ly in [(0.8, 9.8), (2.3, 11.0), (8.5, 11.75), (24, 11.6)]:
    flat.append(f'<circle cx="{lx}" cy="{ly}" r=".26" fill="#9CC67A"/><circle cx="{lx + .12}" cy="{ly - .05}" r=".07" fill="#F6B6C8"/>')
# 麥田
flat.append('<rect x="16.4" y="13.5" width="4.8" height="3.2" rx=".2" fill="#EECF7A"/>')
flat.append('<rect x="16.4" y="13.5" width="4.8" height="3.2" rx=".2" fill="url(#wheat)"/>')
# 路
for x, y, w, h in [(8.3, 15, 5.7, 1), (13, 8.5, 1, 7.5), (14, 9.7, 7.2, .9)]:
    flat.append(f'<rect x="{x - .08}" y="{y - .08}" width="{w + .16}" height="{h + .16}" rx=".3" fill="#DCC899"/>')
for x, y, w, h in [(8.3, 15, 5.7, 1), (13, 8.5, 1, 7.5), (14, 9.7, 7.2, .9)]:
    flat.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx=".25" fill="#EFE1BB"/>')
for px, py in [(9.4, 15.6), (11.2, 15.3), (12.6, 15.7), (13.6, 13.6), (13.3, 10.2), (16, 10.1), (18.6, 10.3)]:
    flat.append(f'<circle cx="{px}" cy="{py}" r=".07" fill="#CDB989"/>')
FLAT = iso_group("".join(flat))

# ---------- 立體物件（依深度排序） ----------
sprites = []


def add(key, svg):
    sprites.append((key, svg))


# 樹、石頭、花
for gx, gy, h, s in [(3, 5, 64, 1), (4.6, 4.1, 72, 1.05), (5.9, 5.7, 58, .95), (3.6, 7.3, 54, .9), (7.3, 4.3, 66, 1),
                     (6.6, 7.6, 60, .95), (2.2, 8.4, 50, .85), (8.7, 6.3, 56, .9), (24.6, 4.6, 70, 1.05),
                     (25.8, 6.8, 62, 1), (4.2, 1.2, 58, .9), (17.2, 0, 60, .95)]:
    add(gx + gy, pine(gx, gy, h, s))
for gx, gy in [(22.2, 13.6), (23.8, 13.2), (25.4, 13.9), (22.8, 15.2), (24.4, 15.0), (26.0, 15.6)]:
    add(gx + gy, round_tree(gx, gy, .82, fruit=True))
for gx, gy, s in [(7.2, 19.8, 1), (9.2, 21.0, .9), (11.2, 21.6, 1), (13.4, 21.4, .85), (20.6, 18.4, 1)]:
    add(gx + gy, round_tree(gx, gy, s))
add(4.3 + 17.6, round_tree(4.3, 17.6, .95, c=("#F7C6D2", "#EEAABD", "#FCDDE5")))
add(15.4 + 17.4, round_tree(15.4, 17.4, .9, c=("#F7C6D2", "#EEAABD", "#FCDDE5")))
for gx, gy, s in [(3.0, 13.4, .9), (11.9, 17.2, .8), (16.0, 12.9, .7), (21.6, 12.9, .8), (0.2, 12.8, .8),
                  (19.8, 1.6, .8), (23.4, 9.8, .8), (12.2, 13.0, .7)]:
    add(gx + gy, bush(gx, gy, s))
for gx, gy, s in [(-0.4, 9.2, 1), (3.7, 9.0, .8), (3.9, 11.9, .7), (10.5, 12.8, .7), (19.6, 12.8, .9), (26.2, 10.4, 1)]:
    add(gx + gy, rock(gx, gy, s))
for gx, gy, c in [(5.0, 18.6, "#FFFFFF"), (10.4, 18.2, "#F6B6C8"), (3.4, 15.6, "#FFFFFF"), (12, 19.6, "#FFFFFF"),
                  (22.2, 14.8, "#F6B6C8"), (8.8, 13.0, "#FFFFFF")]:
    add(gx + gy - 1, flowers(gx, gy, c))

# 路標
for gx, gy in [(8.35, 14.8), (14.2, 16.15), (14.2, 8.4), (21.3, 9.55), (12.8, 12.9)]:
    add(gx + gy, marker(gx, gy))

# 台南：丁丁家
hx, hy, hw, hd, hh, rh = 5.5, 14, 3, 3, 42, 36
house = box(hx, hy, hw, hd, hh, CREAM)
house += fr(15.0, 15.9, hx + hw, 0, 27, "#C98E5F") + fr(15.08, 15.82, hx + hw, 0, 25, "#D9A274")
house += fr(16.2, 16.8, hx + hw, 15, 30, "#FFFFFF") + fr(16.28, 16.72, hx + hw, 17, 28, "#BFE3E6")
house += fr(14.3, 14.8, hx + hw, 15, 30, "#FFFFFF") + fr(14.36, 14.74, hx + hw, 17, 28, "#BFE3E6")
house += fl(6.0, 6.8, hy + hd, 14, 30, "#FFFFFF") + fl(6.08, 6.72, hy + hd, 16, 28, "#BFE3E6")
house += fl(7.2, 8.0, hy + hd, 14, 30, "#FFFFFF") + fl(7.28, 7.92, hy + hd, 16, 28, "#BFE3E6")
house += fl(6.0, 6.8, hy + hd + .02, 11, 14, "#EE9C7E") + fl(7.2, 8.0, hy + hd + .02, 11, 14, "#EE9C7E")
gxm, ov = hx + hw / 2, .22
house += poly([P(hx - ov, hy, hh), P(hx - ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(gxm, hy, hh + rh)], "#F6B79D")
house += poly([P(hx, hy + hd, hh), P(hx + hw, hy + hd, hh), P(gxm, hy + hd, hh + rh)], CREAM[1])
house += f'<circle cx="{P(gxm, hy + hd, hh + 15)[0]:.1f}" cy="{P(gxm, hy + hd, hh + 15)[1]:.1f}" r="5" fill="#BFE3E6" stroke="#FFFFFF" stroke-width="2"/>'
house += poly([P(hx + hw + ov, hy, hh), P(hx + hw + ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(gxm, hy, hh + rh)], "#EE9C7E")
house += f'<polyline points="{pts([P(hx - ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(hx + hw + ov, hy + hd, hh)])}" fill="none" stroke="#FFF6E6" stroke-width="3" stroke-linejoin="round"/>'
house += box(6.0, 14.4, .45, .45, 18, ("#E7A58B", "#D98E73", "#C67C63"), hh + 14)
add(22.0, house)

# 台南：舞蹈地板＋兩隻跳舞的奇異鳥
fx, fy, fw, fd = 9.2, 12.95, 2.4, 1.85
floor = box(fx, fy, fw, fd, 5, WOOD)
floor += iso_group(f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fd}" fill="#F6D5D2"/><rect x="{fx}" y="{fy}" width="{fw}" height="{fd}" fill="url(#check)"/>', lift=5)
d1 = P(9.95, 13.55, 5)
d2 = P(10.95, 14.25, 5)
floor += f'<g transform="translate({d1[0]:.1f} {d1[1]:.1f})"><g class="hop">{kiwi(0, 0, .62, "#F2A7C3")}</g></g>'
floor += f'<g transform="translate({d2[0]:.1f} {d2[1]:.1f})"><g class="hop2">{kiwi(0, 0, .62, "#F6C344", flip=True)}</g></g>'
add(24.3, floor)

# 台南：丁丁
dx, dy = P(9.25, 16.75)
add(26.0, kiwi(dx, dy, 1.1, "#4BB38B", acc="pack"))

# 橋
bridge = box(12.9, 10.95, 1.2, 1.6, 6, WOOD)
for k in range(1, 8):
    y = 10.95 + k * .2
    bridge += f'<line x1="{P(12.9, y, 6)[0]:.1f}" y1="{P(12.9, y, 6)[1]:.1f}" x2="{P(14.1, y, 6)[0]:.1f}" y2="{P(14.1, y, 6)[1]:.1f}" stroke="#CFA072" stroke-width="1"/>'
bridge += box(12.9, 10.95, .1, 1.6, 8, WOOD, 6)
bridge += box(14.0, 10.95, .1, 1.6, 8, WOOD, 6)
add(25.4, bridge)

# 高雄：主堡圍牆、主堡、箱子
YX0, YX1, YY0, YY1, T, WH = 11, 18.8, 2, 8.6, .26, 14
WALLTOP = ("#F8DCC8", WALLC[1], WALLC[2])
gx = YX0
while gx < YX1 - 1e-6:
    seg = min(1, YX1 - gx)
    add(gx + YY0 + .1, box(gx, YY0, seg, T, WH, WALLTOP))
    gx += seg
gy = YY0
while gy < YY1 - 1e-6:
    seg = min(1, YY1 - gy)
    add(YX0 + gy + .1, box(YX0, gy, T, seg, WH, WALLTOP))
    gy += seg
gx = YX0
while gx < YX1 - 1e-6:
    seg = min(1, YX1 - gx)
    if not (gx + seg > 13.0 and gx < 14.2):
        add(gx + seg + YY1 + .2, box(gx, YY1 - T, seg, T, WH, WALLTOP))
    gx += seg
gy = YY0
while gy < YY1 - 1e-6:
    seg = min(1, YY1 - gy)
    add(YX1 + gy + seg + .2, box(YX1 - T, gy, T, seg, WH, WALLTOP))
    gy += seg
for px, py in [(YX0, YY0), (YX1 - .4, YY0), (YX0, YY1 - .4), (YX1 - .4, YY1 - .4), (12.75, YY1 - .4), (14.15, YY1 - .4)]:
    add(px + py + .9, box(px - .04, py - .04, .48, .48, 22, ("#FBE7D8", "#EDBBA0", "#D9A186")))
# 門口兩盞燈
for px in (12.95, 14.35):
    lx, ly = P(px, YY1 - .16, 24)
    add(px + YY1 + 1, f'<circle cx="{lx:.1f}" cy="{ly - 4:.1f}" r="4.2" fill="#FFE7A3"/><circle cx="{lx:.1f}" cy="{ly - 4:.1f}" r="8" fill="#FFE7A3" opacity=".35"/>')

kx, ky, kw, kd, kh = 11.4, 2.4, 2, 2, 80
keep = box(kx, ky, kw, kd, kh, STONE)
keep += arch_l(kx + 1, .36, ky + kd, 0, 22, 12, "#A57B50") + arch_l(kx + 1, .28, ky + kd, 0, 20, 9, "#B98B5E")
for wx in (11.75, 12.75):
    keep += arch_l(wx, .14, ky + kd, 48, 60, 5, "#6E9C95")
keep += fr(2.75, 3.05, kx + kw, 48, 60, "#6E9C95") + fr(3.6, 3.9, kx + kw, 48, 60, "#6E9C95")
keep += poly([P(kx + kw, 3.05, 40), P(kx + kw, 3.75, 40), P(kx + kw, 3.75, 14), P(kx + kw, 3.4, 20), P(kx + kw, 3.05, 14)], "#4BB38B")
keep += box(kx - .14, ky - .14, kw + .28, kd + .28, 10, ("#FFFFFF", "#F1EADD", "#DED3C1"), kh)
ap = P(kx + kw / 2, ky + kd / 2, kh + 10 + 46)
o = .2
b0, b1, b2, b3 = P(kx - o, ky - o, kh + 10), P(kx + kw + o, ky - o, kh + 10), P(kx + kw + o, ky + kd + o, kh + 10), P(kx - o, ky + kd + o, kh + 10)
keep += poly([b0, b1, ap], "#A6D8CE") + poly([b0, b3, ap], "#A6D8CE")
keep += poly([b3, b2, ap], "#8FCABF") + poly([b1, b2, ap], "#74B3A8")
keep += f'<line x1="{ap[0]:.1f}" y1="{ap[1]:.1f}" x2="{ap[0]:.1f}" y2="{ap[1] - 26:.1f}" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>'
keep += f'<g transform="translate({ap[0]:.1f} {ap[1] - 26:.1f})"><path class="wave" d="M0 0 q9 -3 18 2 q-9 4 -18 8z" fill="#4BB38B"/></g>'
add(15.9, keep)

PILES = [(14.6, 2.5, 4, 2, 2, 16), (14.6, 4.2, 4, 2, 2, 16), (15.3, 5.9, 3, 2, 3, 15)]
for px, py, nx, ny, nz, count in PILES:
    cells = [(i, j, k) for k in range(nz) for j in range(ny) for i in range(nx)]
    cells = cells[:count]
    for i, j, k in cells:
        cgx, cgy = px + i * .7, py + j * .7
        add(cgx + cgy + .62 + k * .01, crate(cgx, cgy, k * .62 * 34))

# 老闆
bx, by = P(12.4, 5.05)
add(17.6, kiwi(bx, by, 1.1, "#E58B7A", acc="crown"))

# 高雄：租的教室
cx0, cy0, cw, cd, ch = 19.5, 7.2, 3, 2.4, 46
cls = box(cx0, cy0, cw, cd, ch, MINT)
cls += fl(20.15, 20.95, cy0 + cd, 0, 30, "#FFFFFF") + fl(20.22, 20.88, cy0 + cd, 0, 28, "#9CC6DA")
cls += fl(21.25, 22.25, cy0 + cd, 10, 32, "#FFFFFF") + fl(21.32, 22.18, cy0 + cd, 12, 30, "#CDE9F1")
cls += fl(21.74, 21.78, cy0 + cd, 12, 30, "#FFFFFF")
cls += fr(7.6, 8.4, cx0 + cw, 12, 34, "#FFFFFF") + fr(7.66, 8.34, cx0 + cw, 14, 32, "#CDE9F1")
cls += fr(8.75, 9.35, cx0 + cw, 12, 34, "#FFFFFF") + fr(8.81, 9.29, cx0 + cw, 14, 32, "#CDE9F1")
n = 8
for i in range(n):
    a = 20.0 + (22.4 - 20.0) * i / n
    b = 20.0 + (22.4 - 20.0) * (i + 1) / n
    col = "#86BBD8" if i % 2 == 0 else "#FFFFFF"
    cls += poly([P(a, cy0 + cd, 38), P(b, cy0 + cd, 38), P(b, cy0 + cd + .55, 31), P(a, cy0 + cd + .55, 31)], col)
cls += box(cx0 - .1, cy0 - .1, cw + .2, cd + .2, 6, ("#FBF8F1", "#ECE6D8", "#DAD2C1"), ch)
cls += poly([P(cx0 + .15, cy0 + .15, ch + 6), P(cx0 + cw - .15, cy0 + .15, ch + 6), P(cx0 + cw - .15, cy0 + cd - .15, ch + 6), P(cx0 + .15, cy0 + cd - .15, ch + 6)], "#E2DCCD")
cls += box(21.6, 7.7, .5, .5, 8, ("#D9E2E6", "#C3CFD5", "#AEBCC3"), ch + 6)
sx, sy = P(20.05, cy0 + cd, 40)
cls += f'<g transform="translate({sx:.1f} {sy:.1f}) skewY(26.565)"><rect x="0" y="-12" width="70" height="12" rx="3" fill="#FFFFFF"/><text x="35" y="-2.4" font-size="9.5" font-weight="700" text-anchor="middle" fill="#4D8FB3" letter-spacing="2">DANCE</text></g>'
add(29.4, cls)

# 老師 B
tx, ty = P(21.55, 10.35)
tb = kiwi(tx, ty, 1.1, "#7FA8E0", flip=True, acc="sack")
tb += f'<g class="puff"><circle cx="{tx - 20:.1f}" cy="{ty - 46:.1f}" r="5" fill="#C9C5BE"/><circle cx="{tx - 27:.1f}" cy="{ty - 53:.1f}" r="3.5" fill="#C9C5BE"/></g>'
add(32.0, tb)

# 轉交中：郵差奇異鳥＋推車
cart = ""
cart += box(13.18, 9.25, .64, 1.05, 11, WOOD, 6)
for wy in (9.5, 10.05):
    wx_, wy_ = P(13.82, wy, 6)
    cart += f'<ellipse cx="{wx_:.1f}" cy="{wy_:.1f}" rx="4.6" ry="6.6" transform="rotate(-27 {wx_:.1f} {wy_:.1f})" fill="#8A6A4A"/><circle cx="{wx_:.1f}" cy="{wy_:.1f}" r="1.6" fill="#F1E3C8"/>'
for sgx, sgy in [(13.5, 10.0), (13.5, 9.55)]:
    sx_, sy_ = P(sgx, sgy, 17)
    cart += f'<path d="M{sx_ - 9:.1f} {sy_ + 2:.1f} q-2 -12 6 -14 l-2 -3 h10 l-2 3 q8 2 6 14z" fill="#F2C45A"/><path d="M{sx_ - 4:.1f} {sy_ - 12:.1f} h9" stroke="#D29A2E" stroke-width="1.6"/>'
fp = P(13.25, 10.25, 17)
cart += f'<line x1="{fp[0]:.1f}" y1="{fp[1]:.1f}" x2="{fp[0]:.1f}" y2="{fp[1] - 30:.1f}" stroke="{INK}" stroke-width="1.8"/>'
cart += f'<g transform="translate({fp[0]:.1f} {fp[1] - 30:.1f})"><path class="wave" d="M0 0 q8 -3 16 2 q-8 4 -16 8z" fill="#4BB38B"/></g>'
ck = P(13.55, 8.95)
cart += kiwi(ck[0], ck[1], .95, "#6FA8DC", acc="cap")
add(22.9, cart)

sprites.sort(key=lambda s: s[0])
SPRITES = "".join(s for _, s in sprites)


# ---------- 世界裡的泡泡、名牌 ----------
def bubble(cx, bottom, w, h, inner):
    x0, y0 = cx - w / 2, bottom - 8 - h
    return (f'<g filter="url(#soft)"><rect x="{x0:.1f}" y="{y0:.1f}" width="{w}" height="{h}" rx="{min(h / 2, 16)}" fill="#FFFDF7"/>'
            f'<path d="M{cx - 7:.1f} {y0 + h - .5:.1f} L{cx:.1f} {bottom:.1f} L{cx + 7:.1f} {y0 + h - .5:.1f}z" fill="#FFFDF7"/></g>'
            f'<g transform="translate({x0:.1f} {y0:.1f})">{inner}</g>')


def coin(x, y, r=9):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#F6C344"/><circle cx="{x}" cy="{y}" r="{r * .7:.1f}" fill="none" stroke="#E2A62C" stroke-width="1.5"/>'
            f'<text x="{x}" y="{y + r * .42:.1f}" font-size="{r * 1.15:.1f}" font-weight="700" text-anchor="middle" fill="#B9801C">$</text>')


def nametag(x, y, label, fill="#FFFDF7", color=INK):
    w = 12 + len(label) * 13
    return (f'<rect x="{x - w / 2:.1f}" y="{y:.1f}" width="{w}" height="20" rx="10" fill="{fill}" opacity=".95"/>'
            f'<text x="{x:.1f}" y="{y + 14.2:.1f}" font-size="12" font-weight="700" text-anchor="middle" fill="{color}">{label}</text>')


over = []
# 丁丁
over.append(nametag(dx, dy + 8, "丁丁"))
over.append(bubble(dx + 2, dy - 46, 112, 34, coin(20, 17) + f'<text x="36" y="23.5" font-size="18" font-weight="600" fill="{INK}">$2,000</text>'))
# 推車
cb = P(13.5, 9.75, 44)
inner = (f'<circle cx="20" cy="18" r="11" fill="#E3F7F0"/>' + kiwi(17, 27, .5, "#4BB38B").replace('<g transform', '<g transform', 1)
         + f'<text x="38" y="23" font-size="13" font-weight="700" fill="{INK}">丁丁</text>'
         + f'<text x="70" y="24" font-size="18" font-weight="600" fill="{INK}">$5,800</text>'
         + '<path d="M14 36 h8 l-4 5 l4 5 h-8 l4 -5z" fill="#6B5D50"/>'
         + '<rect x="28" y="37" width="90" height="8" rx="4" fill="#F6E5C6"/><rect x="28" y="37" width="30" height="8" rx="4" fill="url(#stripe)"/>'
         + f'<text x="124" y="45" font-size="11" font-weight="700" fill="#B86A12">1 天</text>')
over.append(bubble(cb[0], cb[1], 152, 54, inner))
over.append(f'<g transform="translate({cb[0] + 70:.1f} {cb[1] - 62:.1f})"><g class="bob"><circle r="13" fill="#F4A23C" stroke="#FFFDF7" stroke-width="3"/><text y="6.5" font-size="18" font-weight="700" text-anchor="middle" fill="#FFFFFF">!</text></g></g>')
over.append(nametag(ck[0] + 4, ck[1] + 8, "轉交中", "#FFF3E2", "#B86A12"))
# 老闆
over.append(nametag(bx, by + 8, "老闆"))
bell = ('<path d="M22 11 a6 6 0 0 1 6 6 v4 l2 3 h-16 l2 -3 v-4 a6 6 0 0 1 6 -6z" fill="#F6C344"/><circle cx="22" cy="26.5" r="2" fill="#E2A62C"/>'
        '<circle cx="29" cy="11" r="5" fill="#E8735F"/><text x="29" y="14" font-size="8" font-weight="700" text-anchor="middle" fill="#FFFFFF">1</text>'
        f'<text x="38" y="23" font-size="13" font-weight="700" fill="{INK}">等你確認</text>')
over.append(bubble(bx + 4, by - 50, 104, 34, bell))
# 主堡名牌
kp = P(12.4, 3.4, kh + 10 + 46 + 30)
plate = (f'<circle cx="22" cy="21" r="14" fill="#E3F7F0"/>'
         '<path d="M15 21h14v9H15z" fill="#F6F1E8"/><path d="M13 21 22 13l9 8z" fill="#74B3A8"/><path d="M20 30v-4a2 2 0 0 1 4 0v4z" fill="#A57B50"/>'
         f'<text x="44" y="18" font-size="11" font-weight="700" fill="{SUB}">主堡財庫</text>'
         f'<text x="44" y="35" font-size="18" font-weight="600" fill="{INK}">$46,700</text>'
         f'<text x="160" y="27" font-size="12" font-weight="700" text-anchor="end" fill="#2B8E6E">點開 ›</text>')
over.append(bubble(kp[0], kp[1], 172, 42, plate))
# 老師 B
over.append(nametag(tx, ty + 8, "老師 B"))
tbi = ('<path d="M18 9 q7 9 7 13 a7 7 0 0 1 -14 0 q0 -4 7 -13z" fill="#9CCBEB"/>'
       f'<text x="32" y="23.5" font-size="18" font-weight="600" fill="{INK}">$3,800</text>'
       '<rect x="96" y="8" width="74" height="20" rx="10" fill="#FBE1DC"/>'
       '<text x="133" y="22" font-size="11.5" font-weight="700" text-anchor="middle" fill="#C4473A">32 天沒繳</text>')
over.append(bubble(tx, ty - 46, 180, 34, tbi))
# 跳舞音符
nx_, ny_ = P(10.4, 13.8, 60)
over.append(f'<g class="bob"><text x="{nx_:.1f}" y="{ny_:.1f}" font-size="18" fill="#E58BAE">♪</text><text x="{nx_ + 16:.1f}" y="{ny_ - 10:.1f}" font-size="14" fill="#E58BAE">♫</text></g>')


# 區域看板
def banner(x, y, title, sub, icon_col):
    w = 22 + len(title) * 15 + 12
    w2 = 16 + len(sub) * 11.5
    ww = max(w, w2) + 20
    return (f'<g filter="url(#soft)"><rect x="{x}" y="{y}" width="{ww:.0f}" height="48" rx="14" fill="#FFFDF7"/></g>'
            f'<circle cx="{x + 18}" cy="{y + 17}" r="6" fill="{icon_col}"/><circle cx="{x + 18}" cy="{y + 17}" r="2.4" fill="#FFFDF7"/>'
            f'<text x="{x + 30}" y="{y + 22}" font-size="15" font-weight="700" fill="{INK}">{title}</text>'
            f'<text x="{x + 12}" y="{y + 40}" font-size="11.5" fill="{SUB}">{sub}</text>')


over.append(banner(214, 248, "台南 · 丁丁家", "場地費 $500／天 · 助教 $250", "#EE9C7E"))
over.append(banner(1076, 186, "高雄 · 主堡", "租的教室 · 場租另計", "#74B3A8"))
OVER = "".join(over)

DEFS = """<defs>
<filter id="soft" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#4D4239" flood-opacity=".18"/></filter>
<pattern id="check" width=".5" height=".5" patternUnits="userSpaceOnUse"><rect width=".25" height=".25" fill="#FFFFFF" opacity=".75"/><rect x=".25" y=".25" width=".25" height=".25" fill="#FFFFFF" opacity=".75"/></pattern>
<pattern id="pave" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M0 0H1M0 0V1" stroke="#D6D2BC" stroke-width=".035" fill="none"/></pattern>
<pattern id="wheat" width="1" height=".4" patternUnits="userSpaceOnUse"><rect y=".25" width="1" height=".1" fill="#E0BB5C"/></pattern>
<pattern id="stripe" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#F4A23C"/><path d="M0 8 6 0h4l-6 8z" fill="#F7BD6A"/><animateTransform attributeName="patternTransform" type="translate" values="0 0;12 0" dur="1s" repeatCount="indefinite"/></pattern>
</defs>"""

SCENE = (f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="奇異鳥小鎮：左邊台南丁丁家，右邊高雄主堡，丁丁的錢正用推車送往主堡，等老闆確認" style="display:block">'
         f'{DEFS}<rect width="{W}" height="{H}" fill="{GROUND}"/>{FLAT}{SPRITES}{OVER}</svg>')


# ---------- HUD（HTML） ----------
def ic_coin(s=26):
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#F6C344"/><circle cx="12" cy="12" r="7.8" fill="none" stroke="#E2A62C" stroke-width="1.6"/>'
            '<text x="12" y="16.6" font-size="12.5" font-weight="700" text-anchor="middle" fill="#B9801C" font-family="Fredoka">$</text></svg>')


def ic_keep(s=26):
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v10H6z" fill="#F1EADF"/><path d="M4 11.5 12 4l8 7.5z" fill="#74B3A8"/>'
            '<path d="M10 21v-4a2 2 0 0 1 4 0v4z" fill="#A57B50"/><path d="M12 4V1.2" stroke="#4D4239" stroke-width="1.2"/><path d="M12 1.3l4 1.3-4 1.3z" fill="#4BB38B"/></svg>')


def ic_cart(s=26):
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="14" height="7" rx="2" fill="#D9A86C"/><ellipse cx="10" cy="8" rx="4.4" ry="3.2" fill="#F2C45A"/>'
            '<circle cx="7" cy="18" r="2.4" fill="#6B5D50"/><circle cx="14" cy="18" r="2.4" fill="#6B5D50"/><path d="M17 12h3l1.6 3" stroke="#6B5D50" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>')


def ic_crate(top, left, right, s=22):
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 4.5-9 4.5-9-4.5z" fill="{top}"/><path d="M3 7.5l9 4.5v9l-9-4.5z" fill="{left}"/>'
            f'<path d="M21 7.5l-9 4.5v9l9-4.5z" fill="{right}"/></svg>')


def ic_hammer(s=24):
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.5 9.5l2 2-8 8a1.4 1.4 0 0 1-2 0 1.4 1.4 0 0 1 0-2z" fill="#C9935A"/>'
            '<path d="M10.5 5.5 14 2.5l7.5 7.5-3 3.5z" fill="#9AA7B4"/><path d="M10.5 5.5 14 2.5l2 2-3.5 3z" fill="#B8C3CD"/></svg>')


LINE = 'fill="none" stroke="#5A4E44" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'


def ic_line(d, s=24):
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" aria-hidden="true"><path d="{d}" {LINE}/></svg>'


IC_CLIP = ic_line("M9 4h6v3H9zM8 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H16M8.5 14l2.5 2.5 4.5-5")
IC_MAIL = ic_line("M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6")
IC_HELP = ic_line("M9.2 9.2a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.1-1.5 2.1M12 17.6v.1M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4z")
IC_LIST = ic_line("M9 7h11M9 12h11M9 17h11M4.5 7h.1M4.5 12h.1M4.5 17h.1", 30)
IC_PEN = ic_line("M5 19l1-4L16 5l3 3L9 18zM14 7l3 3", 30)


def kiwi_avatar(scarf, acc=None, bg="#E3F7F0", s=38):
    return (f'<svg width="{s}" height="{s}" viewBox="-21 -37 50 50" aria-hidden="true" style="flex:none"><circle cx="4" cy="-12" r="24" fill="{bg}"/>'
            f'{kiwi(0, 0, 1.0, scarf, acc=acc)}</svg>')


IC_KIWI = kiwi_avatar("#4BB38B", bg="#FFFFFF", s=34)
IC_CART_BIG = ic_cart(32)

CSS = """
body{margin:0;background:#EFE9DC}
.stage{position:relative;width:1280px;height:800px;overflow:hidden;font-family:'Noto Sans TC',system-ui,sans-serif;color:#4D4239}
.stage svg text{font-family:Fredoka,'Noto Sans TC',sans-serif}
.f{font-family:Fredoka,'Noto Sans TC',sans-serif;font-variant-numeric:tabular-nums}
.pill{display:flex;align-items:center;gap:8px;height:40px;padding:0 16px 0 5px;border-radius:999px;background:#FFFDF7;box-shadow:0 2px 0 rgba(77,66,57,.10),0 6px 18px rgba(77,66,57,.10)}
.pill .ic{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:#FFF3D9;flex:none}
.pill .n{font-family:Fredoka,'Noto Sans TC',sans-serif;font-weight:600;font-size:21px;line-height:1}
.pill .l{font-size:12px;color:#8C7B6B;font-weight:500}
.mini{display:flex;align-items:center;gap:6px;height:30px;padding:0 12px 0 6px;border-radius:999px;background:rgba(255,253,247,.92);box-shadow:0 2px 0 rgba(77,66,57,.08)}
.mini .n{font-family:Fredoka,'Noto Sans TC',sans-serif;font-weight:600;font-size:16px}
.mini .l{font-size:12px;color:#8C7B6B}
.sq{width:46px;height:46px;border-radius:15px;background:#FFFDF7;border:0;display:grid;place-items:center;box-shadow:0 2px 0 rgba(77,66,57,.10),0 6px 18px rgba(77,66,57,.10);position:relative;cursor:pointer}
.dot{position:absolute;top:7px;right:7px;width:9px;height:9px;border-radius:50%;background:#E8735F;border:2px solid #FFFDF7}
.round{width:68px;height:68px;border-radius:50%;background:#FFFDF7;border:4px solid #F1E4C9;display:grid;place-items:center;box-shadow:0 3px 0 rgba(77,66,57,.12),0 8px 20px rgba(77,66,57,.12);cursor:pointer;padding:0}
.rlabel{margin-top:6px;font-size:12px;font-weight:700;background:rgba(255,253,247,.92);border-radius:999px;padding:2px 10px}
.slot{display:flex;align-items:center;gap:8px;background:#FFF8EC;border-radius:14px;padding:7px 8px}
.slot .nm{font-size:12.5px;font-weight:700;line-height:1.2}
.slot .am{font-family:Fredoka,'Noto Sans TC',sans-serif;font-weight:600;font-size:17px;line-height:1.1}
.tag{display:inline-block;font-size:10.5px;font-weight:700;border-radius:999px;padding:1px 7px;margin-top:2px}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes wave{0%,100%{transform:skewY(0)}50%{transform:skewY(-9deg)}}
@keyframes rise{0%{opacity:0;transform:translateY(8px)}15%{opacity:1}75%{opacity:1}100%{opacity:0;transform:translateY(-16px)}}
@keyframes puff{0%{opacity:0;transform:translateY(4px)}40%{opacity:.9}100%{opacity:0;transform:translateY(-12px)}}
.bob{animation:bob 1.6s ease-in-out infinite}
.hop{animation:hop .9s ease-in-out infinite}
.hop2{animation:hop .9s ease-in-out .45s infinite}
.wave{animation:wave 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:left center}
.rise{animation:rise 3.4s ease-out infinite}
.puff{animation:puff 2.6s ease-out infinite}
@media (prefers-reduced-motion: reduce){.bob,.hop,.hop2,.wave,.rise,.puff{animation:none}}
"""

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&amp;family=Noto+Sans+TC:wght@400;500;700;900&amp;display=swap" rel="stylesheet">')

BADGE = ('<div style="position:absolute;left:16px;top:12px;width:82px;height:82px;border-radius:50%;background:linear-gradient(#BFE6E3,#E7F4E6);border:4px solid #FFFDF7;box-shadow:0 4px 14px rgba(77,66,57,.16);display:grid;place-items:center">'
         + ic_keep(50) +
         '<span class="f" style="position:absolute;left:-6px;bottom:-4px;background:#F4A23C;color:#FFFFFF;font-weight:700;font-size:12px;border-radius:999px;padding:3px 8px;border:3px solid #FFFDF7">10月</span></div>')

ROW1 = f'''<div style="position:absolute;left:110px;top:16px;display:flex;gap:10px;align-items:center">
<div class="pill" style="position:relative"><span class="ic">{ic_coin()}</span><span class="n">58,300</span><span class="l">公司的錢</span>
<span class="f rise" style="position:absolute;left:44px;top:-14px;font-weight:700;font-size:14px;color:#5FAE3E;text-shadow:0 0 3px #FFFDF7,0 0 3px #FFFDF7">+2,000</span></div>
<div class="pill"><span class="ic" style="background:#E3F7F0">{ic_keep()}</span><span class="n">46,700</span><span class="l">主堡財庫</span></div>
<div class="pill"><span class="ic" style="background:#FFF0DD">{ic_cart()}</span><span class="n" style="color:#C2700F">11,600</span><span class="l">還在路上</span></div>
<div class="pill" style="width:290px;padding-right:14px"><span class="ic" style="background:#EEF3F7">{ic_hammer()}</span>
<div style="flex:1;display:flex;flex-direction:column;gap:3px"><div style="display:flex;justify-content:space-between;font-size:11.5px;color:#8C7B6B"><span>建城貸款 $120,000</span><span class="f" style="font-weight:700;color:#4E9A2F">回本 8%</span></div>
<div style="height:10px;border-radius:999px;background:#E7EFD8;overflow:hidden"><div style="width:8%;height:100%;background:#86C64F;border-radius:999px"></div></div></div></div>
</div>'''

ROW2 = f'''<div style="position:absolute;left:114px;top:64px;display:flex;gap:8px;align-items:center">
<div class="mini">{ic_crate("#EEE9DF", "#DAD3C6", "#C5BDAF")}<span class="l">預收</span><span class="n">31,000</span></div>
<div class="mini">{ic_crate("#FAD2B4", "#EDB38C", "#D99A70")}<span class="l">待發</span><span class="n">17,800</span></div>
<div class="mini" style="background:#EAF7EF">{ic_crate("#A9E0C6", "#7CC9A6", "#5DB48D")}<span class="l" style="color:#2B8E6E;font-weight:700">基金・真正能用</span><span class="n" style="color:#1B5E4A">9,500</span></div>
</div>'''

TOPRIGHT = f'''<div style="position:absolute;right:16px;top:16px;display:flex;gap:8px">
<button class="sq" aria-label="帳本">{IC_CLIP}</button>
<button class="sq" aria-label="通知">{IC_MAIL}<span class="dot"></span></button>
<button class="sq" aria-label="說明">{IC_HELP}</button>
</div>'''

LEFTCARD = f'''<div style="position:absolute;left:14px;top:128px;width:178px;background:#FFFDF7;border-radius:20px;box-shadow:0 4px 0 rgba(77,66,57,.08),0 10px 24px rgba(77,66,57,.12);padding:12px 10px 0;display:flex;flex-direction:column;gap:8px;overflow:hidden">
<div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px"><span style="font-size:14px;font-weight:900">代收人背包</span><span style="font-size:11px;color:#8C7B6B">還沒入庫</span></div>
<div class="slot">{kiwi_avatar("#4BB38B", "pack")}<div><div class="nm">丁丁</div><div class="am">$2,000</div><span class="tag" style="background:#E3F7F0;color:#1B5E4A">手上</span></div></div>
<div class="slot" style="background:#FFF1DE">{kiwi_avatar("#6FA8DC", "cap", bg="#FFFFFF")}<div><div class="nm">丁丁 → 主堡</div><div class="am">$5,800</div><span class="tag" style="background:#F4A23C;color:#FFFFFF">! 等確認</span></div></div>
<div class="slot">{kiwi_avatar("#7FA8E0", "sack", bg="#EAF1FB")}<div><div class="nm">老師 B</div><div class="am">$3,800</div><span class="tag" style="background:#FBE1DC;color:#C4473A">32 天沒繳</span></div></div>
<div class="slot" style="background:#F3F7EC">{kiwi_avatar("#E58B7A", "crown", bg="#FFF6D8")}<div><div class="nm">老闆自己收</div><div class="am">$21,400</div><span class="tag" style="background:#FFFFFF;color:#8C7B6B">本月直接入庫</span></div></div>
<svg width="100%" height="30" viewBox="0 0 178 30" preserveAspectRatio="none" aria-hidden="true" style="display:block;margin:0 -10px;width:calc(100% + 20px)"><defs><pattern id="sg" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 12a12 12 0 0 1 24 0M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0" fill="none" stroke="#F2B39A" stroke-width="1.6"/></pattern></defs><rect width="178" height="30" fill="#FCE9DF"/><rect width="178" height="30" fill="url(#sg)"/></svg>
</div>'''

BOTTOM = f'''<div style="position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:26px">
<div style="display:flex;flex-direction:column;align-items:center"><button class="round" aria-label="帳本模式">{IC_LIST}</button><span class="rlabel">帳本模式</span></div>
<div style="display:flex;flex-direction:column;align-items:center"><button class="round" aria-label="我的代收">{IC_KIWI}</button><span class="rlabel">我的背包</span></div>
<div style="display:flex;flex-direction:column;align-items:center"><button class="round" aria-label="繳回主堡" style="border-color:#FCD9B0">{IC_CART_BIG}</button><span class="rlabel">送回主堡</span></div>
<div style="display:flex;flex-direction:column;align-items:center"><button class="round" aria-label="記一筆">{IC_PEN}</button><span class="rlabel">記一筆</span></div>
</div>'''

HUD = BADGE + ROW1 + ROW2 + TOPRIGHT + LEFTCARD + BOTTOM


def seg(label, color, w):
    return f'<div style="width:{w}%;background:{color}"></div>'


POPUP = f'''<div style="position:absolute;inset:0;background:radial-gradient(circle at 968px 250px,rgba(64,54,46,0) 0 130px,rgba(64,54,46,.42) 190px)"></div>
<div role="dialog" aria-label="主堡" style="position:absolute;left:214px;top:96px;width:452px;background:#FFFDF7;border-radius:28px;box-shadow:0 6px 0 rgba(77,66,57,.10),0 20px 50px rgba(64,54,46,.28);padding:22px 24px;display:flex;flex-direction:column;gap:16px">
<div style="display:flex;align-items:center;gap:14px">
<div style="width:58px;height:58px;border-radius:18px;background:linear-gradient(#BFE6E3,#E7F4E6);display:grid;place-items:center;flex:none">{ic_keep(40)}</div>
<div style="flex:1"><div style="font-size:21px;font-weight:900">主堡 · 高雄</div><div style="font-size:13px;color:#8C7B6B">老闆保管 · 公司的錢，不是老闆的薪水</div></div>
<button class="sq" aria-label="關閉" style="width:40px;height:40px;border-radius:50%;box-shadow:none;background:#F4EEE3"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13" stroke="#5A4E44" stroke-width="2.2" stroke-linecap="round"/></svg></button>
</div>
<div style="background:#F6F1E6;border-radius:20px;padding:14px 16px;display:flex;align-items:center;gap:14px">
{ic_coin(44)}
<div style="flex:1"><div style="font-size:12.5px;color:#8C7B6B">財庫裡</div><div class="f" style="font-size:36px;font-weight:600;line-height:1.05">$46,700</div></div>
<div style="text-align:right;font-size:12.5px;color:#8C7B6B;line-height:1.6">還在路上 <b class="f" style="color:#C2700F;font-size:14px">+11,600</b><br>公司的錢 <b class="f" style="color:#4D4239;font-size:14px">58,300</b></div>
</div>
<div style="display:flex;flex-direction:column;gap:10px">
<div style="font-size:15px;font-weight:900">這 $58,300 是誰的？</div>
<div style="display:flex;height:14px;border-radius:999px;overflow:hidden;gap:3px">{seg("預收", "#D9D2C4", 53.2)}{seg("待發", "#F0B48A", 30.5)}{seg("基金", "#5DB48D", 16.3)}</div>
<div style="display:flex;align-items:center;gap:10px">{ic_crate("#EEE9DF", "#DAD3C6", "#C5BDAF", 28)}<div style="flex:1"><div style="font-size:14px;font-weight:700">預收</div><div style="font-size:12px;color:#8C7B6B">學生付了、還沒上的 93 堂</div></div><span class="f" style="font-size:19px;font-weight:600">$31,000</span></div>
<div style="display:flex;align-items:center;gap:10px">{ic_crate("#FAD2B4", "#EDB38C", "#D99A70", 28)}<div style="flex:1"><div style="font-size:14px;font-weight:700">待發</div><div style="font-size:12px;color:#8C7B6B">10 月上過課、還沒付的薪水和場地費</div></div><span class="f" style="font-size:19px;font-weight:600">$17,800</span></div>
<div style="display:flex;align-items:center;gap:10px;background:#EAF7EF;border-radius:14px;padding:8px 10px;margin:0 -10px">{ic_crate("#A9E0C6", "#7CC9A6", "#5DB48D", 28)}<div style="flex:1"><div style="font-size:14px;font-weight:900;color:#1B5E4A">水庫基金・真正能用的</div><div style="font-size:12px;color:#2B8E6E">Party、公共支出從這裡出</div></div><span class="f" style="font-size:21px;font-weight:700;color:#1B5E4A">$9,500</span></div>
</div>
<div style="border-top:2px dashed #EADFCB;padding-top:14px;display:flex;flex-direction:column;gap:8px">
<div style="display:flex;align-items:center;gap:10px">{ic_hammer(28)}<div style="flex:1;font-size:14px;font-weight:700">建城貸款（欠老闆的）</div><span class="f" style="font-size:17px;font-weight:600">$120,000</span></div>
<div style="height:14px;border-radius:999px;background:#E7EFD8;overflow:hidden"><div style="width:8%;height:100%;background:#86C64F;border-radius:999px"></div></div>
<div style="display:flex;justify-content:space-between;font-size:12px;color:#8C7B6B"><span>回本 8%（示意）</span><span>公司淨值 <b class="f" style="color:#C4473A">−$110,500</b></span></div>
</div>
<div style="background:#FFF4E4;border-radius:20px;padding:12px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
<div style="position:relative;flex:none">{kiwi_avatar("#6FA8DC", "cap", bg="#FFFFFF", s=44)}<span style="position:absolute;right:-4px;top:-4px;width:20px;height:20px;border-radius:50%;background:#F4A23C;color:#FFF;font:700 13px/20px Fredoka;text-align:center;border:2px solid #FFF4E4">!</span></div>
<div style="flex:1 1 150px"><div style="font-size:14px;font-weight:700">丁丁送來 <span class="f" style="font-size:17px">$5,800</span></div><div style="font-size:12px;color:#B86A12">10/27 · 現金 · 等你確認 1 天</div></div>
<button style="height:44px;padding:0 16px;border-radius:14px;border:0;background:#4BB38B;color:#FFFFFF;font:inherit;font-size:14px;font-weight:700;box-shadow:0 3px 0 #2B8E6E;cursor:pointer">收到了</button>
<button style="height:44px;padding:0 14px;border-radius:14px;border:2px solid #EADFCB;background:#FFFDF7;color:#4D4239;font:inherit;font-size:14px;font-weight:700;cursor:pointer">金額不對</button>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#8C7B6B"><span>10 月 入庫 <b class="f" style="color:#4E9A2F">+29,600</b> · 出庫 <b class="f" style="color:#C4473A">−30,900</b></span><span style="color:#2B8E6E;font-weight:700">看帳本 ›</span></div>
</div>'''

CAPTION_MAP = "風格 D：奇異鳥小鎮。參考療癒經營遊戲的配色（鼠尾草綠地、奶油色建築、白色圓角 HUD），和殖民經營遊戲的「物流看得見」：錢裝箱堆在主堡倉庫裡（1 箱 ≈ $1,000，共 47 箱），在路上的錢真的在路上走。角色用 Googoocard 自己的奇異鳥。"
CAPTION_POP = "點開主堡：其他地方變暗、只留主堡亮著。財庫、這些錢是誰的、建城貸款、等老闆確認的推車都在這張卡上；「收到了」只有老闆按得到，其他人看到的是同一張卡、沒有按鈕。"


def page(title, hud, caption):
    body = (f'<div class="stage">{SCENE}{hud}</div>'
            f'<p style="margin:0;padding:14px 22px 18px;font-family:\'Noto Sans TC\',sans-serif;font-size:13px;line-height:1.6;color:#8C7B6B;max-width:1180px">{caption}</p>')
    return title, body


def write(fname, title, body, height):
    dc = f'''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>{CSS}</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1280,"height":{height}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''
    with open(os.path.join(OUT, fname), "w") as f:
        f.write(dc)
    prev = f'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>{title}</title>{FONTS}<style>{CSS}</style></head><body>{body}</body></html>'
    with open(os.path.join(PREV, fname.replace(".dc.html", ".html")), "w") as f:
        f.write(prev)


t, b = page("遊戲版 D 奇異鳥小鎮", HUD, CAPTION_MAP)
write("GameKiwi.dc.html", t, b, 860)
t, b = page("遊戲版 D 點開主堡", BADGE + ROW1 + ROW2 + TOPRIGHT + POPUP, CAPTION_POP)
write("GameKiwiKeep.dc.html", t, b, 860)
print("ok", len(sprites), "sprites")
