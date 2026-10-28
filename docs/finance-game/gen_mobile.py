#!/usr/bin/env python3
"""手機版「奇異鳥小鎮」：直式地圖＋縮放評估。沿用 gen_game.py 的等角工具。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_game as g  # noqa: E402  （匯入時會順便重產桌機版）
from gen_game import (P, pts, poly, box, fl, fr, arch_l, kiwi, pine, round_tree, bush, rock, flowers, marker,  # noqa: E402
                      crate, iso_group, bubble, coin, nametag, ic_coin, ic_keep, ic_cart, ic_crate, ic_hammer,
                      kiwi_avatar, IC_MAIL, IC_LIST, IC_PEN, CSS, FONTS, DEFS, INK, SUB, GROUND, WALLC, STONE,
                      CREAM, MINT, WOOD, OUT, PREV)

DESKTOP_SCENE = g.SCENE
g.OX, g.OY = 150, 310
VW, VH = 520, 1125          # 設計座標；畫面上 ×0.75 → 390×844
K = 1.25                    # 泡泡、名牌放大，讓手機上的字維持 11px 以上


def ks(svg, ax, ay, k=K):
    return f'<g transform="translate({ax:.1f} {ay:.1f}) scale({k}) translate({-ax:.1f} {-ay:.1f})">{svg}</g>'


# ---------- 平面 ----------
flat = []
for cx, cy, r, col in [(0, 1, 2.4, "#C3D28F"), (12, -1, 2, "#D6E1AC"), (6, 12.5, 2, "#C3D28F"), (20, 9, 2.2, "#D6E1AC"),
                       (14, 18.5, 2.4, "#C3D28F"), (-1, 6, 2, "#D6E1AC"), (22, 15, 2, "#C3D28F")]:
    flat.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{col}"/>')
flat.append('<rect x="2.2" y="-1" width="11" height="7" rx="1" fill="#E4E1CD"/><rect x="2.2" y="-1" width="11" height="7" rx="1" fill="url(#pave)"/>')
flat.append('<rect x="3" y="0" width="6" height="5.2" fill="#EADFC6"/>')
flat.append('<rect x="12.6" y="10.15" width="9" height="7.6" rx="1.4" fill="#D8E2A8"/>')
flat.append('<rect x="-20" y="8.45" width="60" height="1.5" rx=".6" fill="#E3F0DA"/><rect x="-20" y="8.6" width="60" height="1.2" rx=".5" fill="#9DD3CB"/>')
flat.append('<g opacity=".7"><rect x="4" y="8.95" width="1.4" height=".08" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;1.2 0;0 0" dur="5s" repeatCount="indefinite"/></rect>'
            '<rect x="14" y="9.35" width="1.2" height=".08" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;1 0;0 0" dur="4s" repeatCount="indefinite"/></rect></g>')
for lx, ly in [(6.2, 9.1), (14.6, 9.4), (17.4, 9.0)]:
    flat.append(f'<circle cx="{lx}" cy="{ly}" r=".26" fill="#9CC67A"/><circle cx="{lx + .12}" cy="{ly - .05}" r=".07" fill="#F6B6C8"/>')
flat.append('<rect x="9.3" y="11.5" width="2.2" height="1.4" rx=".2" fill="#EECF7A"/><rect x="9.3" y="11.5" width="2.2" height="1.4" rx=".2" fill="url(#wheat)"/>')
ROAD = [(7.6, 5.0), (7.7, 5.5), (9.2, 6.6), (10.6, 7.6), (11.2, 8.3), (11.2, 10.1), (12.2, 10.9), (14.0, 11.7),
        (16.0, 12.4), (18.0, 12.6), (18.5, 13.4), (18.5, 14.45)]
rp = " ".join(f"{x},{y}" for x, y in ROAD)
flat.append(f'<polyline points="{rp}" fill="none" stroke="#DCC899" stroke-width="1.02" stroke-linejoin="round" stroke-linecap="round"/>')
flat.append(f'<polyline points="{rp}" fill="none" stroke="#EFE1BB" stroke-width=".84" stroke-linejoin="round" stroke-linecap="round"/>')
FLAT_M = iso_group("".join(flat))

# ---------- 立體 ----------
ms = []


def add(key, svg):
    ms.append((key, svg))


for gx, gy, h, s in [(1.2, 4.2, 56, .9), (0.2, 2.6, 60, .95), (2.4, 6.2, 50, .85), (3.6, 7.4, 48, .8), (5.2, 7.6, 46, .8),
                     (11.4, 0.4, 58, .9), (10.4, -1, 62, .95), (8.6, -1.6, 54, .85), (17.5, 7.2, 60, .95),
                     (18.8, 8.1, 50, .85), (1.5, -1.5, 56, .9), (-0.8, 0.6, 52, .85)]:
    add(gx + gy, pine(gx, gy, h, s))
for gx, gy in [(20, 11.4), (21.6, 11.0), (20.8, 12.6), (22.4, 12.4)]:
    add(gx + gy, round_tree(gx, gy, .75, fruit=True))
for gx, gy, s in [(13.8, 18.0, .9), (16.2, 18.8, .85), (22.6, 14.6, .85)]:
    add(gx + gy, round_tree(gx, gy, s))
add(12.2 + 15.2, round_tree(12.2, 15.2, .85, c=("#F7C6D2", "#EEAABD", "#FCDDE5")))
for gx, gy, s in [(12.4, 12.6, .7), (19.4, 10.4, .7), (6.6, 7.9, .7), (13.4, 7.6, .7), (2.6, -0.6, .7)]:
    add(gx + gy, bush(gx, gy, s))
for gx, gy, s in [(9.4, 8.2, .8), (15.6, 8.2, .8), (8.0, 10.2, .7)]:
    add(gx + gy, rock(gx, gy, s))
for gx, gy, c in [(14.2, 12.6, "#FFFFFF"), (19.6, 16.4, "#F6B6C8"), (13.4, 15.0, "#FFFFFF"), (17.8, 17.2, "#FFFFFF")]:
    add(gx + gy - 1, flowers(gx, gy, c))
for gx, gy in [(11.75, 8.15), (11.75, 10.25), (19.0, 13.4)]:
    add(gx + gy, marker(gx, gy))

# 主堡圍牆
YX0, YX1, YY0, YY1, T, WH = 3, 9, 0, 5.2, .26, 14
WALLTOP = ("#F8DCC8", WALLC[1], WALLC[2])
gx = YX0
while gx < YX1 - 1e-6:
    seg = min(1, YX1 - gx)
    add(gx + YY0 + .1, box(gx, YY0, seg, T, WH, WALLTOP))
    if not (gx + seg > 7.0 and gx < 8.2):
        add(gx + seg + YY1 + .2, box(gx, YY1 - T, seg, T, WH, WALLTOP))
    gx += seg
gy = YY0
while gy < YY1 - 1e-6:
    seg = min(1, YY1 - gy)
    add(YX0 + gy + .1, box(YX0, gy, T, seg, WH, WALLTOP))
    add(YX1 + gy + seg + .2, box(YX1 - T, gy, T, seg, WH, WALLTOP))
    gy += seg
for px, py in [(YX0, YY0), (YX1 - .4, YY0), (YX0, YY1 - .4), (YX1 - .4, YY1 - .4), (6.75, YY1 - .4), (8.15, YY1 - .4)]:
    add(px + py + .9, box(px - .04, py - .04, .48, .48, 22, ("#FBE7D8", "#EDBBA0", "#D9A186")))
for px in (6.95, 8.35):
    lx, ly = P(px, YY1 - .16, 24)
    add(px + YY1 + 1, f'<circle cx="{lx:.1f}" cy="{ly - 4:.1f}" r="4.2" fill="#FFE7A3"/><circle cx="{lx:.1f}" cy="{ly - 4:.1f}" r="8" fill="#FFE7A3" opacity=".35"/>')

kx, ky, kw, kd, kh = 3.2, 0.2, 1.8, 1.8, 70
keep = box(kx, ky, kw, kd, kh, STONE)
keep += arch_l(kx + .9, .32, ky + kd, 0, 20, 10, "#A57B50") + arch_l(kx + .9, .25, ky + kd, 0, 18, 8, "#B98B5E")
for wx in (3.5, 4.4):
    keep += arch_l(wx + .1, .13, ky + kd, 42, 53, 5, "#6E9C95")
keep += fr(.5, .8, kx + kw, 42, 53, "#6E9C95") + fr(1.3, 1.6, kx + kw, 42, 53, "#6E9C95")
keep += box(kx - .14, ky - .14, kw + .28, kd + .28, 10, ("#FFFFFF", "#F1EADD", "#DED3C1"), kh)
ap = P(kx + kw / 2, ky + kd / 2, kh + 10 + 42)
o = .2
b0, b1, b2, b3 = P(kx - o, ky - o, kh + 10), P(kx + kw + o, ky - o, kh + 10), P(kx + kw + o, ky + kd + o, kh + 10), P(kx - o, ky + kd + o, kh + 10)
keep += poly([b0, b1, ap], "#A6D8CE") + poly([b0, b3, ap], "#A6D8CE") + poly([b3, b2, ap], "#8FCABF") + poly([b1, b2, ap], "#74B3A8")
keep += f'<line x1="{ap[0]:.1f}" y1="{ap[1]:.1f}" x2="{ap[0]:.1f}" y2="{ap[1] - 24:.1f}" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>'
keep += f'<g transform="translate({ap[0]:.1f} {ap[1] - 24:.1f})"><path class="wave" d="M0 0 q9 -3 18 2 q-9 4 -18 8z" fill="#4BB38B"/></g>'
add(kx + ky + kw, keep)

for px, py, nx, ny, nz, count in [(5.4, .3, 4, 2, 2, 16), (5.4, 1.8, 4, 2, 2, 16), (6.1, 3.3, 3, 2, 3, 15)]:
    cells = [(i, j, k) for k in range(nz) for j in range(ny) for i in range(nx)][:count]
    for i, j, k in cells:
        cgx, cgy = px + i * .7, py + j * .7
        add(cgx + cgy + .62 + k * .01, crate(cgx, cgy, k * .62 * 34))

bx, by = P(3.9, 2.8)
add(6.75, kiwi(bx, by, 1.1, "#E58B7A", acc="crown"))

cx0, cy0, cw, cd, ch = 9.8, 3.0, 2.4, 2.0, 40
cls = box(cx0, cy0, cw, cd, ch, MINT)
cls += fl(10.3, 11.0, cy0 + cd, 0, 27, "#FFFFFF") + fl(10.36, 10.94, cy0 + cd, 0, 25, "#9CC6DA")
cls += fl(11.25, 12.0, cy0 + cd, 9, 28, "#FFFFFF") + fl(11.31, 11.94, cy0 + cd, 11, 26, "#CDE9F1")
cls += fr(3.3, 3.9, cx0 + cw, 10, 29, "#FFFFFF") + fr(3.36, 3.84, cx0 + cw, 12, 27, "#CDE9F1")
cls += fr(4.2, 4.75, cx0 + cw, 10, 29, "#FFFFFF") + fr(4.26, 4.69, cx0 + cw, 12, 27, "#CDE9F1")
for i in range(7):
    a = 10.15 + (12.1 - 10.15) * i / 7
    b = 10.15 + (12.1 - 10.15) * (i + 1) / 7
    cls += poly([P(a, cy0 + cd, 33), P(b, cy0 + cd, 33), P(b, cy0 + cd + .5, 27), P(a, cy0 + cd + .5, 27)], "#86BBD8" if i % 2 == 0 else "#FFFFFF")
cls += box(cx0 - .1, cy0 - .1, cw + .2, cd + .2, 6, ("#FBF8F1", "#ECE6D8", "#DAD2C1"), ch)
cls += poly([P(cx0 + .15, cy0 + .15, ch + 6), P(cx0 + cw - .15, cy0 + .15, ch + 6), P(cx0 + cw - .15, cy0 + cd - .15, ch + 6), P(cx0 + .15, cy0 + cd - .15, ch + 6)], "#E2DCCD")
add(cx0 + cy0 + 2.2, cls)

tx, ty = P(12.9, 4.6)
tb = kiwi(tx, ty, 1.1, "#7FA8E0", flip=True, acc="sack")
tb += f'<g class="puff"><circle cx="{tx - 20:.1f}" cy="{ty - 46:.1f}" r="5" fill="#C9C5BE"/><circle cx="{tx - 27:.1f}" cy="{ty - 53:.1f}" r="3.5" fill="#C9C5BE"/></g>'
add(17.6, tb)

cart = box(8.08, 5.45, .64, 1.05, 11, WOOD, 6)
for wy in (5.7, 6.25):
    wx_, wy_ = P(8.72, wy, 6)
    cart += f'<ellipse cx="{wx_:.1f}" cy="{wy_:.1f}" rx="4.6" ry="6.6" transform="rotate(-27 {wx_:.1f} {wy_:.1f})" fill="#8A6A4A"/><circle cx="{wx_:.1f}" cy="{wy_:.1f}" r="1.6" fill="#F1E3C8"/>'
for sgx, sgy in [(8.4, 6.2), (8.4, 5.75)]:
    sx_, sy_ = P(sgx, sgy, 17)
    cart += f'<path d="M{sx_ - 9:.1f} {sy_ + 2:.1f} q-2 -12 6 -14 l-2 -3 h10 l-2 3 q8 2 6 14z" fill="#F2C45A"/>'
fp = P(8.15, 6.45, 17)
cart += f'<line x1="{fp[0]:.1f}" y1="{fp[1]:.1f}" x2="{fp[0]:.1f}" y2="{fp[1] - 30:.1f}" stroke="{INK}" stroke-width="1.8"/>'
cart += f'<g transform="translate({fp[0]:.1f} {fp[1] - 30:.1f})"><path class="wave" d="M0 0 q8 -3 16 2 q-8 4 -16 8z" fill="#4BB38B"/></g>'
ck = P(7.9, 5.35)
cart += kiwi(ck[0], ck[1], .95, "#6FA8DC", acc="cap")
add(13.6, cart)

br = box(10.7, 8.4, 1.0, 1.6, 6, WOOD)
for k in range(1, 8):
    y = 8.4 + k * .2
    br += f'<line x1="{P(10.7, y, 6)[0]:.1f}" y1="{P(10.7, y, 6)[1]:.1f}" x2="{P(11.7, y, 6)[0]:.1f}" y2="{P(11.7, y, 6)[1]:.1f}" stroke="#CFA072" stroke-width="1"/>'
br += box(10.7, 8.4, .1, 1.6, 8, WOOD, 6) + box(11.6, 8.4, .1, 1.6, 8, WOOD, 6)
add(20.3, br)

hx, hy, hw, hd, hh, rh = 14.5, 13, 3, 3, 42, 36
house = box(hx, hy, hw, hd, hh, CREAM)
house += fr(14.0, 14.9, hx + hw, 0, 27, "#C98E5F") + fr(14.08, 14.82, hx + hw, 0, 25, "#D9A274")
house += fr(15.2, 15.8, hx + hw, 15, 30, "#FFFFFF") + fr(15.28, 15.72, hx + hw, 17, 28, "#BFE3E6")
house += fr(13.3, 13.8, hx + hw, 15, 30, "#FFFFFF") + fr(13.36, 13.74, hx + hw, 17, 28, "#BFE3E6")
house += fl(15.0, 15.8, hy + hd, 14, 30, "#FFFFFF") + fl(15.08, 15.72, hy + hd, 16, 28, "#BFE3E6")
house += fl(16.2, 17.0, hy + hd, 14, 30, "#FFFFFF") + fl(16.28, 16.92, hy + hd, 16, 28, "#BFE3E6")
gxm, ov = hx + hw / 2, .22
house += poly([P(hx - ov, hy, hh), P(hx - ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(gxm, hy, hh + rh)], "#F6B79D")
house += poly([P(hx, hy + hd, hh), P(hx + hw, hy + hd, hh), P(gxm, hy + hd, hh + rh)], CREAM[1])
cc = P(gxm, hy + hd, hh + 15)
house += f'<circle cx="{cc[0]:.1f}" cy="{cc[1]:.1f}" r="5" fill="#BFE3E6" stroke="#FFFFFF" stroke-width="2"/>'
house += poly([P(hx + hw + ov, hy, hh), P(hx + hw + ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(gxm, hy, hh + rh)], "#EE9C7E")
house += f'<polyline points="{pts([P(hx - ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(hx + hw + ov, hy + hd, hh)])}" fill="none" stroke="#FFF6E6" stroke-width="3" stroke-linejoin="round"/>'
house += box(15.0, 13.4, .45, .45, 18, ("#E7A58B", "#D98E73", "#C67C63"), hh + 14)
add(hx + hy + 3, house)

fx, fy, fw, fd = 15.4, 10.0, 2.0, 1.4
floor = box(fx, fy, fw, fd, 5, WOOD)
floor += iso_group(f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fd}" fill="#F6D5D2"/><rect x="{fx}" y="{fy}" width="{fw}" height="{fd}" fill="url(#check)"/>', lift=5)
d1, d2 = P(16.0, 10.5, 5), P(16.9, 11.0, 5)
floor += f'<g transform="translate({d1[0]:.1f} {d1[1]:.1f})"><g class="hop">{kiwi(0, 0, .6, "#F2A7C3")}</g></g>'
floor += f'<g transform="translate({d2[0]:.1f} {d2[1]:.1f})"><g class="hop2">{kiwi(0, 0, .6, "#F6C344", flip=True)}</g></g>'
add(fx + fy + 2, floor)

dx, dy = P(18.9, 15.2)
add(34.1, kiwi(dx, dy, 1.1, "#4BB38B", acc="pack"))

ms.sort(key=lambda s: s[0])
SPR_M = "".join(s for _, s in ms)


# ---------- 泡泡、名牌（放大 K 倍） ----------
def sign(x, y, text):
    return (f'<rect x="{x - 2.5:.1f}" y="{y - 6:.1f}" width="5" height="12" rx="2" fill="#B98858"/>'
            f'<g filter="url(#soft)"><rect x="{x - 34:.1f}" y="{y - 32:.1f}" width="68" height="28" rx="8" fill="#EBC593"/></g>'
            f'<rect x="{x - 30:.1f}" y="{y - 28:.1f}" width="60" height="20" rx="6" fill="none" stroke="#D9A86C" stroke-width="1.5"/>'
            f'<text x="{x:.1f}" y="{y - 12.5:.1f}" font-size="15" font-weight="700" text-anchor="middle" fill="#6B4A2E">{text}</text>')


ov_ = []
ov_.append(ks(nametag(dx, dy + 8, "丁丁") + bubble(dx + 2, dy - 46, 112, 34, coin(20, 17) + f'<text x="36" y="23.5" font-size="18" font-weight="600" fill="{INK}">$2,000</text>'), dx, dy))
cb = P(8.4, 5.95, 44)
inner = ('<circle cx="20" cy="18" r="11" fill="#E3F7F0"/>' + kiwi(17, 27, .5, "#4BB38B")
         + f'<text x="38" y="23" font-size="13" font-weight="700" fill="{INK}">丁丁</text>'
         + f'<text x="70" y="24" font-size="18" font-weight="600" fill="{INK}">$5,800</text>'
         + '<path d="M14 36 h8 l-4 5 l4 5 h-8 l4 -5z" fill="#6B5D50"/>'
         + '<rect x="28" y="37" width="90" height="8" rx="4" fill="#F6E5C6"/><rect x="28" y="37" width="30" height="8" rx="4" fill="url(#stripe)"/>'
         + '<text x="124" y="45" font-size="11" font-weight="700" fill="#B86A12">1 天</text>')
cart_ov = bubble(cb[0], cb[1], 152, 54, inner)
cart_ov += f'<g transform="translate({cb[0] + 70:.1f} {cb[1] - 62:.1f})"><g class="bob"><circle r="13" fill="#F4A23C" stroke="#FFFDF7" stroke-width="3"/><text y="6.5" font-size="18" font-weight="700" text-anchor="middle" fill="#FFFFFF">!</text></g></g>'
ov_.append(ks(cart_ov, cb[0], cb[1]))
bell = ('<path d="M22 11 a6 6 0 0 1 6 6 v4 l2 3 h-16 l2 -3 v-4 a6 6 0 0 1 6 -6z" fill="#F6C344"/><circle cx="22" cy="26.5" r="2" fill="#E2A62C"/>'
        '<circle cx="29" cy="11" r="5" fill="#E8735F"/><text x="29" y="14" font-size="8" font-weight="700" text-anchor="middle" fill="#FFFFFF">1</text>'
        f'<text x="38" y="23" font-size="13" font-weight="700" fill="{INK}">老闆 · 等你確認</text>')
ov_.append(ks(bubble(bx + 6, by - 50, 140, 34, bell), bx, by))
kp = P(4.1, 1.1, kh + 10 + 42 + 28)
plate = ('<circle cx="20" cy="19" r="13" fill="#E3F7F0"/>'
         '<path d="M13.5 19h13v8.5h-13z" fill="#F6F1E8"/><path d="M11.5 19.5 20 12l8.5 7.5z" fill="#74B3A8"/><path d="M18.2 27.5v-3.5a1.8 1.8 0 0 1 3.6 0v3.5z" fill="#A57B50"/>'
         f'<text x="40" y="24.5" font-size="15" font-weight="700" fill="{INK}">主堡</text>'
         '<text x="104" y="24.5" font-size="12" font-weight="700" text-anchor="end" fill="#2B8E6E">點開 ›</text>')
ov_.append(ks(bubble(kp[0], kp[1], 114, 38, plate), kp[0], kp[1]))
tbi = ('<path d="M18 9 q7 9 7 13 a7 7 0 0 1 -14 0 q0 -4 7 -13z" fill="#9CCBEB"/>'
       f'<text x="32" y="23.5" font-size="18" font-weight="600" fill="{INK}">$3,800</text>'
       '<rect x="96" y="8" width="74" height="20" rx="10" fill="#FBE1DC"/>'
       '<text x="133" y="22" font-size="11.5" font-weight="700" text-anchor="middle" fill="#C4473A">32 天沒繳</text>')
ov_.append(ks(nametag(tx, ty + 8, "老師 B") + bubble(tx - 40, ty - 40, 180, 34, tbi), tx, ty))
nx_, ny_ = P(16.5, 10.6, 56)
ov_.append(f'<g class="bob"><text x="{nx_:.1f}" y="{ny_:.1f}" font-size="18" fill="#E58BAE">♪</text><text x="{nx_ + 16:.1f}" y="{ny_ - 10:.1f}" font-size="14" fill="#E58BAE">♫</text></g>')
s1 = P(12.9, 13.6)
ov_.append(ks(sign(s1[0], s1[1], "台南"), s1[0], s1[1]))
s2 = P(10.9, 1.3)
ov_.append(ks(sign(s2[0], s2[1], "高雄"), s2[0], s2[1]))
OV_M = "".join(ov_)

SCENE_M = (f'<svg viewBox="0 0 {VW} {VH}" width="390" height="844" role="img" aria-label="手機直式地圖：上方高雄主堡，中間一條河，下方台南丁丁家" style="display:block;position:absolute;inset:0">'
           f'{DEFS}<rect width="{VW}" height="{VH}" fill="{GROUND}"/>{FLAT_M}{SPR_M}{OV_M}</svg>')

# ---------- 手機 HTML ----------
MCSS = """
.board{font-family:'Noto Sans TC',system-ui,sans-serif;color:#4D4239;background:#EFE9DC;padding:34px 0 40px}
.board h1{margin:0;font-size:26px;font-weight:900}
.board .lead{margin:6px 0 0;font-size:14px;color:#8C7B6B;line-height:1.6}
.row{display:flex;justify-content:center;gap:36px;margin-top:26px}
.col{width:390px;display:flex;flex-direction:column;gap:14px}
.vh{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:900}
.verdict{font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px}
.phone{position:relative;width:390px;height:844px;border-radius:46px;overflow:hidden;background:#CDDA9F;box-shadow:0 0 0 9px #2F2A26,0 24px 50px rgba(47,42,38,.28);font-family:'Noto Sans TC',system-ui,sans-serif;color:#4D4239}
.phone svg text{font-family:Fredoka,'Noto Sans TC',sans-serif}
.status{position:absolute;left:0;right:0;top:0;height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 30px 0 34px;font:600 15px/1 Fredoka,sans-serif;color:#2F2A26;z-index:5}
.island{position:absolute;left:50%;top:11px;width:118px;height:34px;margin-left:-59px;border-radius:20px;background:#111}
.home{position:absolute;left:50%;bottom:8px;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:#2F2A26;z-index:5}
.cap{font-size:13px;line-height:1.65;color:#6F6155;margin:0}
.chip{display:flex;align-items:center;gap:7px;background:#FFFDF7;border-radius:16px;padding:5px 12px 5px 5px;box-shadow:0 2px 0 rgba(77,66,57,.10),0 6px 16px rgba(77,66,57,.12);flex:none}
.chip .nm{font-size:11.5px;font-weight:700;line-height:1.15}
.chip .am{font-family:Fredoka,'Noto Sans TC',sans-serif;font-weight:600;font-size:16px;line-height:1.1}
.mround{width:54px;height:54px;border-radius:50%;background:#FFFDF7;border:3px solid #F1E4C9;display:grid;place-items:center;box-shadow:0 3px 0 rgba(77,66,57,.12),0 8px 18px rgba(77,66,57,.14);padding:0}
.mlabel{margin-top:4px;font-size:11px;font-weight:700;background:rgba(255,253,247,.92);border-radius:999px;padding:1px 8px}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#FFFDF7;border-radius:28px 28px 0 0;box-shadow:0 -8px 30px rgba(64,54,46,.25);padding:8px 18px 28px;display:flex;flex-direction:column;gap:12px;overflow:hidden;z-index:4}
.handle{width:40px;height:5px;border-radius:3px;background:#E4D9C6;margin:0 auto 2px}
.fld{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:700}
.inp{height:44px;border-radius:14px;border:2px solid #EADFCB;background:#FFFFFF;display:flex;align-items:center;padding:0 12px;font-size:15px;font-weight:500;color:#4D4239}
.seg{flex:1;height:44px;border-radius:14px;border:2px solid #EADFCB;background:#FFFFFF;display:grid;place-items:center;font-size:14px;font-weight:700}
.seg.on{border-color:#4BB38B;background:#E3F7F0;color:#1B5E4A}
"""

STATUS = ('<div class="status"><span>9:41</span><span class="island"></span>'
          '<span style="display:flex;gap:6px;align-items:center"><svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" fill="#2F2A26"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#2F2A26"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#2F2A26"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#2F2A26"/></svg>'
          '<svg width="25" height="12" viewBox="0 0 25 12" aria-hidden="true"><rect x=".5" y=".5" width="21" height="11" rx="3.5" fill="none" stroke="#2F2A26" opacity=".5"/><rect x="2" y="2" width="16" height="8" rx="2" fill="#2F2A26"/><rect x="22.5" y="4" width="2" height="4" rx="1" fill="#2F2A26" opacity=".5"/></svg></span></div>')


def mini(icon, label, num, color=INK, bg="rgba(255,253,247,.94)"):
    return (f'<div style="display:flex;align-items:center;gap:5px;height:30px;padding:0 10px 0 5px;border-radius:999px;background:{bg};box-shadow:0 2px 0 rgba(77,66,57,.08)">'
            f'{icon}<span style="font-size:11.5px;color:{SUB}">{label}</span><span style="font:600 15px Fredoka,sans-serif;color:{color}">{num}</span></div>')


HUD_M = f'''<div style="position:absolute;left:12px;right:12px;top:50px;display:flex;align-items:center;gap:8px;z-index:3">
<div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(#BFE6E3,#E7F4E6);border:3px solid #FFFDF7;box-shadow:0 3px 10px rgba(77,66,57,.16);display:grid;place-items:center;flex:none;position:relative">{ic_keep(28)}<span style="position:absolute;left:-6px;bottom:-5px;background:#F4A23C;color:#FFF;font:700 10px/1 Fredoka,sans-serif;border-radius:999px;padding:3px 5px;border:2px solid #FFFDF7">10月</span></div>
<div class="pill" style="flex:1;height:44px"><span class="ic">{ic_coin()}</span><span class="n">58,300</span><span class="l">公司的錢</span></div>
<button class="sq" aria-label="通知" style="width:44px;height:44px;flex:none">{IC_MAIL}<span class="dot"></span></button>
</div>
<div style="position:absolute;left:12px;right:12px;top:102px;display:flex;gap:6px;z-index:3">
{mini(ic_keep(20), "財庫", "46,700")}{mini(ic_cart(20), "路上", "11,600", "#C2700F")}{mini(ic_hammer(18), "回本", "8%", "#4E9A2F")}
</div>'''


def chip(avatar, name, amount, tag, tag_bg, tag_fg, bg="#FFFDF7"):
    return (f'<div class="chip" style="background:{bg}">{avatar}<div><div class="nm">{name}</div><div style="display:flex;align-items:center;gap:6px"><span class="am">{amount}</span>'
            f'<span style="font-size:10px;font-weight:700;border-radius:999px;padding:1px 6px;background:{tag_bg};color:{tag_fg};white-space:nowrap">{tag}</span></div></div></div>')


CHIPS = f'''<div style="position:absolute;left:0;right:0;top:670px;z-index:3">
<div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px 6px;font-size:12px;font-weight:900;text-shadow:0 0 4px #FFFDF7,0 0 4px #FFFDF7">代收人背包<span style="font-weight:500;color:#6F6155">左右滑 ›</span></div>
<div style="display:flex;gap:8px;padding:0 12px;overflow:hidden">
{chip(kiwi_avatar("#4BB38B", "pack", s=32), "丁丁", "$2,000", "手上", "#E3F7F0", "#1B5E4A")}
{chip(kiwi_avatar("#6FA8DC", "cap", bg="#FFFFFF", s=32), "丁丁 → 主堡", "$5,800", "! 等確認", "#F4A23C", "#FFFFFF", "#FFF1DE")}
{chip(kiwi_avatar("#7FA8E0", "sack", bg="#EAF1FB", s=32), "老師 B", "$3,800", "32 天", "#FBE1DC", "#C4473A")}
</div></div>'''


def bottom_m(active=None):
    items = [("帳本模式", IC_LIST, ""), ("我的背包", kiwi_avatar("#4BB38B", bg="#FFFFFF", s=30), ""),
             ("送回主堡", ic_cart(28), "border-color:#FCD9B0"), ("記一筆", IC_PEN, "")]
    out = '<div style="position:absolute;left:0;right:0;top:744px;display:flex;justify-content:center;gap:22px;z-index:3">'
    for label, icon, extra in items:
        ring = "box-shadow:0 0 0 4px #F4A23C,0 8px 18px rgba(77,66,57,.14);" if label == active else ""
        out += f'<div style="display:flex;flex-direction:column;align-items:center"><button class="mround" aria-label="{label}" style="{extra};{ring}">{icon}</button><span class="mlabel">{label}</span></div>'
    return out + '</div>'


def phone(inner):
    return f'<div class="phone">{inner}{STATUS}<div class="home"></div></div>'


PHONE_MAP = phone(SCENE_M + HUD_M + CHIPS + bottom_m())

SHEET_KEEP = f'''<div style="position:absolute;inset:0;background:radial-gradient(circle at 184px 235px,rgba(64,54,46,0) 0 92px,rgba(64,54,46,.42) 140px);z-index:3"></div>
<div class="sheet" style="top:318px">
<div class="handle"></div>
<div style="display:flex;align-items:center;gap:12px">
<div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(#BFE6E3,#E7F4E6);display:grid;place-items:center;flex:none">{ic_keep(30)}</div>
<div style="flex:1"><div style="font-size:18px;font-weight:900">主堡 · 高雄</div><div style="font-size:12px;color:{SUB}">老闆保管 · 公司的錢，不是老闆的薪水</div></div>
<button class="sq" aria-label="關閉" style="width:44px;height:44px;border-radius:50%;box-shadow:none;background:#F4EEE3"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13" stroke="#5A4E44" stroke-width="2.2" stroke-linecap="round"/></svg></button>
</div>
<div style="background:#FFF4E4;border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:10px">
<div style="display:flex;align-items:center;gap:10px"><div style="position:relative;flex:none">{kiwi_avatar("#6FA8DC", "cap", bg="#FFFFFF", s=40)}<span style="position:absolute;right:-4px;top:-4px;width:18px;height:18px;border-radius:50%;background:#F4A23C;color:#FFF;font:700 12px/18px Fredoka;text-align:center;border:2px solid #FFF4E4">!</span></div>
<div style="flex:1"><div style="font-size:14px;font-weight:700">丁丁送來 <span class="f" style="font-size:17px">$5,800</span></div><div style="font-size:12px;color:#B86A12">10/27 · 現金 · 等你確認 1 天</div></div></div>
<div style="display:flex;gap:8px"><button style="flex:1;height:44px;border-radius:14px;border:0;background:#4BB38B;color:#FFF;font:inherit;font-size:15px;font-weight:700;box-shadow:0 3px 0 #2B8E6E">收到了</button>
<button style="flex:1;height:44px;border-radius:14px;border:2px solid #EADFCB;background:#FFFDF7;color:#4D4239;font:inherit;font-size:15px;font-weight:700">金額不對</button></div>
</div>
<div style="background:#F6F1E6;border-radius:18px;padding:12px 14px;display:flex;align-items:center;gap:12px">{ic_coin(36)}
<div style="flex:1"><div style="font-size:12px;color:{SUB}">財庫裡</div><div class="f" style="font-size:28px;font-weight:600;line-height:1.05">$46,700</div></div>
<div style="text-align:right;font-size:11.5px;color:{SUB};line-height:1.6">路上 <b class="f" style="color:#C2700F;font-size:13px">+11,600</b><br>公司的錢 <b class="f" style="color:#4D4239;font-size:13px">58,300</b></div></div>
<div style="display:flex;flex-direction:column;gap:9px">
<div style="font-size:14px;font-weight:900">這 $58,300 是誰的？</div>
<div style="display:flex;height:12px;border-radius:999px;overflow:hidden;gap:3px"><div style="width:53.2%;background:#D9D2C4"></div><div style="width:30.5%;background:#F0B48A"></div><div style="width:16.3%;background:#5DB48D"></div></div>
<div style="display:flex;align-items:center;gap:9px">{ic_crate("#EEE9DF", "#DAD3C6", "#C5BDAF", 24)}<div style="flex:1;font-size:13.5px;font-weight:700">預收 <span style="font-weight:400;font-size:11.5px;color:{SUB}">還沒上的 93 堂</span></div><span class="f" style="font-size:17px;font-weight:600">$31,000</span></div>
<div style="display:flex;align-items:center;gap:9px">{ic_crate("#FAD2B4", "#EDB38C", "#D99A70", 24)}<div style="flex:1;font-size:13.5px;font-weight:700">待發 <span style="font-weight:400;font-size:11.5px;color:{SUB}">薪水、場地費</span></div><span class="f" style="font-size:17px;font-weight:600">$17,800</span></div>
<div style="display:flex;align-items:center;gap:9px;background:#EAF7EF;border-radius:12px;padding:7px 9px;margin:0 -9px">{ic_crate("#A9E0C6", "#7CC9A6", "#5DB48D", 24)}<div style="flex:1;font-size:13.5px;font-weight:900;color:#1B5E4A">水庫基金・真正能用</div><span class="f" style="font-size:18px;font-weight:700;color:#1B5E4A">$9,500</span></div>
</div>
<div style="display:flex;align-items:center;gap:9px;border-top:2px dashed #EADFCB;padding-top:12px">{ic_hammer(24)}<div style="flex:1;font-size:13.5px;font-weight:700">建城貸款（欠老闆的）</div><span class="f" style="font-size:16px;font-weight:600">$120,000</span></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:70px;background:linear-gradient(rgba(255,253,247,0),#FFFDF7 70%)"></div>
</div>'''

PHONE_KEEP = phone(SCENE_M + HUD_M + SHEET_KEEP)

SHEET_REMIT = f'''<div style="position:absolute;inset:0;background:rgba(64,54,46,.36);z-index:3"></div>
<div class="sheet" style="top:206px;gap:11px">
<div class="handle"></div>
<div style="display:flex;align-items:center;gap:12px">
{kiwi_avatar("#4BB38B", "pack", s=44)}
<div style="flex:1"><div style="font-size:18px;font-weight:900">送回主堡</div><div style="font-size:12px;color:{SUB}">背包裡有 <b class="f" style="color:#4D4239;font-size:13px">$2,000</b>（10/26 吳小姐的卡）</div></div>
<button class="sq" aria-label="關閉" style="width:44px;height:44px;border-radius:50%;box-shadow:none;background:#F4EEE3"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13" stroke="#5A4E44" stroke-width="2.2" stroke-linecap="round"/></svg></button>
</div>
<div style="background:#F3F7EC;border-radius:18px;padding:10px 14px;display:flex;align-items:center;gap:8px">
<div style="display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:{SUB}">{kiwi_avatar("#4BB38B", s=30)}丁丁家</div>
<svg width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none" aria-hidden="true" style="flex:1"><path d="M4 22 C 60 4, 140 34, 196 14" fill="none" stroke="#DCC899" stroke-width="8" stroke-linecap="round"/><path d="M4 22 C 60 4, 140 34, 196 14" fill="none" stroke="#EFE1BB" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/></svg>
<div style="display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:{SUB}"><div style="width:30px;height:30px;border-radius:50%;background:#E3F7F0;display:grid;place-items:center">{ic_keep(22)}</div>主堡</div>
</div>
<div class="fld">送多少
<div style="display:flex;gap:8px;align-items:center"><div class="inp" style="flex:1;font:600 24px Fredoka,sans-serif;height:52px">$2,000</div>
<span style="height:36px;padding:0 12px;border-radius:999px;background:#E3F7F0;color:#1B5E4A;font-size:13px;display:grid;place-items:center">全部 ✓</span></div>
</div>
<div class="fld">怎麼給老闆
<div style="display:flex;gap:8px"><div class="seg">現金</div><div class="seg on">轉帳</div></div>
</div>
<div style="display:flex;gap:10px">
<div class="fld" style="flex:1">末五碼<div class="inp">38211</div></div>
<div class="fld" style="flex:1">日期<div class="inp">10/28（今天）</div></div>
</div>
<div class="fld">備註<div class="inp" style="color:#B3A694;font-weight:400">選填，例如：連同上次的零錢</div></div>
<button style="height:52px;border-radius:16px;border:0;background:#4BB38B;color:#FFF;font:inherit;font-size:16px;font-weight:900;box-shadow:0 4px 0 #2B8E6E;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:2px">{ic_cart(26)}出發！送 <span class="f" style="font-size:18px">$2,000</span> 到主堡</button>
<p style="margin:0;font-size:11.5px;line-height:1.55;color:{SUB};text-align:center">老闆按「收到了」才算入庫，送出後他會收到通知。<br>確認前你都可以撤回或修改。</p>
</div>'''

PHONE_REMIT = phone(SCENE_M + HUD_M + bottom_m("送回主堡") + SHEET_REMIT)

# 評估用：A 直接縮小、B 拖曳縮放
SHRINK = 390 / 1280
PHONE_A = phone(f'<div style="position:absolute;inset:0;background:#EFE9DC"></div>'
                f'<div style="position:absolute;left:0;top:300px;width:1280px;height:800px;transform:scale({SHRINK:.4f});transform-origin:0 0;pointer-events:none"><div class="stage">{DESKTOP_SCENE}{g.HUD}</div></div>'
                '<div style="position:absolute;left:16px;right:16px;top:560px;text-align:center;font-size:13px;color:#8C7B6B;line-height:1.6">整張電腦版地圖縮到 30%<br>泡泡裡的字約 4px、按鈕約 20px</div>')

MINIMAP = ('<div style="position:absolute;right:12px;top:574px;width:112px;height:72px;border-radius:14px;background:rgba(255,253,247,.94);box-shadow:0 4px 12px rgba(77,66,57,.16);z-index:3;overflow:hidden">'
           '<svg width="112" height="72" viewBox="0 0 112 72" aria-hidden="true"><rect width="112" height="72" fill="#DCE6B4"/><path d="M0 18 L112 66" stroke="#9DD3CB" stroke-width="7"/>'
           '<circle cx="34" cy="46" r="6" fill="#EE9C7E"/><rect x="74" y="16" width="14" height="12" rx="3" fill="#74B3A8"/><circle cx="90" cy="46" r="4" fill="#7FA8E0"/>'
           '<rect x="62" y="6" width="36" height="58" rx="4" fill="none" stroke="#F4A23C" stroke-width="2.5"/></svg></div>')
GESTURE = ('<div style="position:absolute;left:50%;top:430px;transform:translateX(-50%);background:rgba(47,42,38,.78);color:#FFF;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;z-index:3;white-space:nowrap">'
           '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1V4.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.5-1.6L9 15" fill="none" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>兩指縮放、拖曳移動</div>'
           '<div style="position:absolute;left:0;top:300px;display:flex;align-items:center;gap:4px;background:rgba(255,253,247,.94);border-radius:0 999px 999px 0;padding:8px 12px 8px 8px;font-size:12px;font-weight:700;z-index:3;box-shadow:0 4px 12px rgba(77,66,57,.16)">‹ 台南在這邊</div>')
PHONE_B = phone(f'<div style="position:absolute;left:-700px;top:96px;width:1280px;height:800px">{DESKTOP_SCENE}</div>' + HUD_M + MINIMAP + GESTURE + bottom_m())


def col(verdict, vbg, vfg, title, ph, cap):
    return (f'<div class="col"><div class="vh"><span class="verdict" style="background:{vbg};color:{vfg}">{verdict}</span>{title}</div>'
            f'{ph}<p class="cap" style="margin-top:12px">{cap}</p></div>')


EVAL = f'''<div class="board">
<div style="max-width:1206px;margin:0 auto;padding:0 6px">
<h1>手機上要不要做「縮放」？</h1>
<p class="lead">同一個奇異鳥小鎮，三種放進手機的做法。手機是 390×844（iPhone 15），最窄要照顧到 360 寬的 Android。</p>
</div>
<div class="row">
{col("✗ 不行", "#FBE1DC", "#C4473A", "A　直接縮小電腦版", PHONE_A, "1280 寬縮到 390，什麼都變 30%：泡泡裡的字約 4px、按鈕約 20px，看不到也點不到。")}
{col("△ 可以但累", "#FFF1DE", "#B86A12", "B　像遊戲一樣拖曳＋縮放", PHONE_B, "字看得清楚，但一次只看到約 1/3 張地圖。要看台南的丁丁得先拖過去；拖曳和點擊容易誤觸；地圖外還得加小地圖才不會迷路。")}
{col("✓ 建議", "#E3F7F0", "#1B5E4A", "C　直式重新排版", PHONE_MAP, "主堡在上、河在中間、台南在下，一個畫面放下全部，不用縮放。數字都在上方，代收人在下方背包列。")}
</div>
<div style="max-width:1206px;margin:30px auto 0;padding:0 6px;display:flex;gap:18px;flex-wrap:wrap">
<div style="flex:1 1 560px;background:#FFFDF7;border-radius:22px;padding:22px 24px;display:flex;flex-direction:column;gap:10px">
<div style="font-size:17px;font-weight:900">結論：第一版不做自由縮放</div>
<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8">
<li><b>手機用直式地圖</b>，一個畫面放下全部；電腦（1024px 以上）用橫式地圖。平板直向用手機版，置中放大。</li>
<li><b>「點了才放大」取代縮放</b>：點主堡、推車或角色，下方抽屜拉起來，鏡頭自動對準它。</li>
<li><b>數字不用找</b>：公司的錢、財庫、路上永遠在上方；帳本模式一鍵切回明細表。</li>
</ul></div>
<div style="flex:1 1 420px;background:#FFFDF7;border-radius:22px;padding:22px 24px;display:flex;flex-direction:column;gap:10px">
<div style="font-size:17px;font-weight:900">什麼時候才需要縮放</div>
<ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8">
<li>代收人超過 6 位、或分部超過 3 個，地圖會擠。先把手上 $0 的人收進背包列，真的放不下再加縮放。</li>
<li>規格：點擊範圍至少 44px；地圖上的字至少 11px；同時最多 5 個泡泡，其餘收成小圓點。</li>
</ul></div>
</div>
</div>'''

FLOW = f'''<div class="board">
<div style="max-width:1206px;margin:0 auto;padding:0 6px">
<h1>手機版：奇異鳥小鎮</h1>
<p class="lead">直式地圖。上方是公司的錢，下方是代收人背包和四個按鈕；點東西就從下面拉出抽屜。</p>
</div>
<div class="row">
{col("1", "#FFFDF7", "#4D4239", "總覽", PHONE_MAP, "主堡（高雄）在上，河在中間，台南丁丁家在下。推車過了橋、停在主堡門口等確認；老師 B 頭上冒煙。下方背包列可以左右滑。")}
{col("2", "#FFFDF7", "#4D4239", "點主堡（老闆看到的）", PHONE_KEEP, "抽屜從下面拉起，主堡留在上方亮著。老闆第一眼就是「等你確認」，往下滑才是財庫、這些錢是誰的、建城貸款。其他人看到同一張，但沒有按鈕。")}
{col("3", "#FFFDF7", "#4D4239", "送回主堡（丁丁看到的）", PHONE_REMIT, "金額預設帶入背包全部，選現金或轉帳、填末五碼。按「出發！」推車就上路，老闆收到通知；確認前可以撤回或修改。")}
</div>
</div>'''


def write(fname, title, body, height):
    css = CSS + MCSS
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
<style>{css}</style>
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
    with open(os.path.join(PREV, fname.replace(".dc.html", ".html")), "w") as f:
        f.write(f'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>{title}</title>{FONTS}<style>{css}</style></head><body>{body}</body></html>')


write("MobileZoom.dc.html", "手機要不要縮放", EVAL, 1320)
write("MobileKiwi.dc.html", "手機版奇異鳥小鎮", FLOW, 1150)
print("mobile ok", len(ms))
