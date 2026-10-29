#!/usr/bin/env python3
"""水庫建城（第一次設定）互動設計稿：左邊一題一題問，右邊等角小鎮一塊一塊蓋起來。

每個物件標上「第幾步出現」（class v{a}_{b}），畫面靠外層的 .s0～.s14 切換：
答完一題（按下一步）那一塊才落下來；正在問的那題，地上先畫出橘色施工線。
沿用 gen_game.py 的等角工具和奇異鳥。輸出到 $FINANCE_SETUP_OUT（預設 out/setup/project/）。
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_game as g  # noqa: E402  （匯入時會順便重產桌機版小鎮）
from gen_game import (box, fl, fr, arch_l, kiwi, crate, pine, round_tree, bush, rock, flowers, coin,  # noqa: E402
                      poly, pts, kiwi_avatar, ic_keep, ic_hammer, ic_crate, INK, GROUND, STONE, WOOD, CREAM,
                      MINT, CRATE, WALLC)

OUT = os.environ.get("FINANCE_SETUP_OUT", os.path.join(HERE, "out", "setup", "project"))
os.makedirs(OUT, exist_ok=True)

SUB = "#76675A"  # 次要字：比 gen_game 的 #8C7B6B 深，11px 也過 4.5:1
SEAN, DD, TB, TC = "#E58B7A", "#4BB38B", "#7FA8E0", "#B79CE3"
LAST = 13        # 開城
ORANGE = "#F4A23C"

g.OX, g.OY = 410, 262
P = g.P
iso = g.iso_group

USED = set()


def piece(svg, a, b=LAST, kind="drop", dl=0):
    """第 a～b 步看得到；kind：drop 從上面落下、pop 原地長大、fade 淡入。"""
    USED.add((a, b))
    cls = f"pc v{a}_{b} {kind}" + (f" dl{dl}" if dl else "")
    return f'<g class="{cls}">{svg}</g>'


def ghost(svg, n):
    """正在問第 n 步時，地上的施工線。"""
    return piece(f'<g class="ghp">{svg}</g>', n, n, "fade")


GH = f'fill="{ORANGE}" fill-opacity=".14" stroke="{ORANGE}" stroke-width=".07" stroke-dasharray=".28 .18"'

# ---------- 位置（格子座標） ----------
KX, KY, KW, KD, ZB = 1.6, 1.4, 2.2, 2.2, 8          # 主堡
YX0, YX1, YY0, YY1, T, WH = .8, 6.2, .8, 4.8, .26, 14  # 圍牆
GATE = (2.2, 3.2)
BOSS = (2.7, 5.45)
HX, HY, HW, HD = 8.8, 1.2, 2.6, 2.4                  # 台南・丁丁家
CX, CY, CW, CD = 8.6, 7.2, 2.6, 2.2                  # 高雄・24steps
DDP, TBP, TCP = (1.8, 8.3), (3.6, 8.1), (4.9, 9.0)  # 居民
FLOOR = (2.2, 9.5, 1.8, 1.4)
POND = (1.1, 3.85, 1.15, .65)
ROADS = [(2.4, 4.8, .6, 1.1), (2.4, 5.9, 9.2, .7), (9.6, 3.6, .6, 2.3), (2.4, 6.6, .6, .7)]

spr = []


def add(key, svg, a=0, b=LAST, kind="drop", dl=0):
    spr.append((key, svg if (a, b) == (0, LAST) else piece(svg, a, b, kind, dl)))


# ---------- 島 ----------
ISLAND = box(0, 0, 12, 12, 18, (GROUND, "#CDB58C", "#B59B74"), -18)

flat = []
for cx_, cy_, r, col in [(10.6, 10.9, 1.0, "#C3D28F"), (11.0, 5.0, .8, "#D6E1AC"), (5.0, 1.0, .0, "#C3D28F"),
                         (0.9, 6.9, .7, "#D6E1AC"), (8.2, 4.6, .8, "#C3D28F"), (5.4, 11.0, .8, "#D6E1AC")]:
    if r:
        flat.append(f'<circle cx="{cx_}" cy="{cy_}" r="{r}" fill="{col}"/>')
flat.append('<rect x=".9" y="7.3" width="4.9" height="3.9" rx=".5" fill="#D8E2A8"/>')
flat.append('<rect x="6.85" y="0" width="1.2" height="12" fill="#E3F0DA"/>')
flat.append('<rect x="7.0" y="0" width=".9" height="12" fill="#9DD3CB"/>')
flat.append('<g opacity=".7">'
            '<rect x="7.4" y="1.5" width=".08" height="1.4" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;0 1.1;0 0" dur="5s" repeatCount="indefinite"/></rect>'
            '<rect x="7.2" y="8.0" width=".08" height="1.2" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;0 1;0 0" dur="4s" repeatCount="indefinite"/></rect>'
            '<rect x="7.6" y="10.2" width=".08" height="1.0" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="0 0;0 .9;0 0" dur="6s" repeatCount="indefinite"/></rect></g>')
FLAT = iso("".join(flat))

FLATP = ""
FLATP += piece(iso(f'<rect x="{YX0}" y="{YY0}" width="{YX1 - YX0}" height="{YY1 - YY0}" rx=".3" fill="#D6E1AC" stroke="#B98858" stroke-width=".07" stroke-dasharray=".35 .25"/>'), 0, 2, "fade")
FLATP += piece(iso(f'<rect x="{YX0}" y="{YY0}" width="{YX1 - YX0}" height="{YY1 - YY0}" rx=".2" fill="#E4E1CD"/>'
                   f'<rect x="{YX0}" y="{YY0}" width="{YX1 - YX0}" height="{YY1 - YY0}" rx=".2" fill="url(#pave)"/>'
                   '<rect x="3.8" y=".95" width="2.15" height="2.75" fill="#EADFC6"/>'), 3, LAST, "fade")
road = "".join(f'<rect x="{x - .08}" y="{y - .08}" width="{w + .16}" height="{h + .16}" rx=".3" fill="#DCC899"/>' for x, y, w, h in ROADS)
road += "".join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx=".25" fill="#EFE1BB"/>' for x, y, w, h in ROADS)
FLATP += piece(iso(road), 11, LAST, "fade")

# 施工線
FLATP += ghost(iso(f'<circle cx="{BOSS[0]}" cy="{BOSS[1]}" r=".55" {GH}/>'), 1)
FLATP += ghost(iso(f'<rect x="3.8" y=".95" width="2.15" height="2.75" rx=".2" {GH}/>'), 3)
FLATP += ghost(iso(f'<rect x=".6" y="5.55" width="1.5" height=".55" rx=".2" {GH}/>'), 4)
FLATP += ghost(iso(f'<circle cx="{DDP[0]}" cy="{DDP[1]}" r=".55" {GH}/>'), 5)
FLATP += ghost(iso(f'<circle cx="{TBP[0]}" cy="{TBP[1]}" r=".55" {GH}/><circle cx="{TCP[0]}" cy="{TCP[1]}" r=".55" {GH}/>'), 7)
FLATP += ghost(iso(f'<rect x="{HX}" y="{HY}" width="{HW}" height="{HD}" rx=".2" {GH}/><rect x="{CX}" y="{CY}" width="{CW}" height="{CD}" rx=".2" {GH}/>'), 8)
FLATP += ghost(iso("".join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx=".25" {GH}/>' for x, y, w, h in ROADS)), 10)
FLATP += ghost(iso(f'<rect x="{POND[0]}" y="{POND[1]}" width="{POND[2]}" height="{POND[3]}" rx=".2" {GH}/>'), 11)

# ---------- 裝飾 ----------
for gx, gy, h, s in [(0.35, 6.4, 58, .95), (0.5, 11.4, 54, .9), (5.9, 11.5, 60, 1), (6.3, 9.4, 56, .9), (11.6, 0.5, 64, 1),
                     (11.5, 4.6, 58, .95), (11.6, 11.2, 60, 1), (8.2, 11.4, 54, .9), (6.4, 0.4, 60, .95)]:
    add(gx + gy, pine(gx, gy, h, s))
for gx, gy, s in [(6.5, 3.2, .8), (6.2, 7.7, .75)]:
    add(gx + gy, round_tree(gx, gy, s))
add(11.9 + 8.0, round_tree(11.7, 8.2, .8, c=("#F7C6D2", "#EEAABD", "#FCDDE5")))
for gx, gy, s in [(0.4, 4.2, .8), (2.0, 6.95, .65), (11.7, 6.6, .8), (8.4, 4.6, .7), (4.6, 11.6, .8), (10.6, 11.3, .8)]:
    add(gx + gy, bush(gx, gy, s))
for gx, gy, s in [(6.6, 5.2, .8), (8.3, 10.4, .7), (11.8, 2.6, .8)]:
    add(gx + gy, rock(gx, gy, s))
for gx, gy, c in [(1.2, 10.9, "#FFFFFF"), (5.3, 10.6, "#F6B6C8"), (8.6, 5.3, "#FFFFFF"), (10.9, 10.8, "#F6B6C8"), (0.9, 6.9, "#FFFFFF")]:
    add(gx + gy - 1, flowers(gx, gy, c))

# 廣場上的舞池（一直都在，開城時有人跳舞）
fx, fy, fw, fd = FLOOR
fl_ = box(fx, fy, fw, fd, 5, WOOD)
fl_ += iso(f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fd}" fill="#F6D5D2"/><rect x="{fx}" y="{fy}" width="{fw}" height="{fd}" fill="url(#check)"/>', lift=5)
add(fx + fy + fw + fd - .5, fl_)
d1, d2 = P(fx + .6, fy + .5, 5), P(fx + 1.3, fy + 1.0, 5)
add(fx + fy + fw + fd - .4,
    f'<g transform="translate({d1[0]:.1f} {d1[1]:.1f})"><g class="hop">{kiwi(0, 0, .62, "#F2A7C3")}</g></g>'
    f'<g transform="translate({d2[0]:.1f} {d2[1]:.1f})"><g class="hop2">{kiwi(0, 0, .62, "#F6C344", flip=True)}</g></g>', LAST, LAST, "pop")

# ---------- 主堡 ----------
add(3.9, box(KX - .12, KY - .12, KW + .24, KD + .24, ZB, STONE))

# 施工架：完工前一直在
POLE = ("#E5BE90", "#D2A474", "#BC8B5C")
back = ""
for px, py in [(KX - .32, KY - .32), (KX + KW + .14, KY - .32), (KX - .32, KY + KD + .14)]:
    back += box(px, py, .16, .16, 112, POLE, ZB)
add(3.95, back, 0, LAST - 1, "fade")
front = box(KX + KW + .14, KY + KD + .14, .16, .16, 112, POLE, ZB)
for z in (ZB + 50, ZB + 96):
    front += fl(KX - .32, KX + KW + .3, KY + KD + .3, z, z + 6, WOOD[1]) + fr(KY - .32, KY + KD + .3, KX + KW + .3, z, z + 6, WOOD[2])
add(4.05, front, 0, LAST - 1, "fade")
add(9.0, box(4.4, 3.95, 1.0, .4, 5, WOOD) + box(4.45, 4.0, .9, .35, 5, WOOD, 5), 0, 3, "fade")  # 木板堆

lower = box(KX, KY, KW, KD, 40, STONE, ZB)
lower += arch_l(KX + 1.1, .38, KY + KD, ZB, ZB + 22, 12, "#A57B50") + arch_l(KX + 1.1, .29, KY + KD, ZB, ZB + 20, 9, "#B98B5E")
add(4.0, lower, 2)

upper = box(KX, KY, KW, KD, 40, STONE, ZB + 40)
for wx in (KX + .5, KX + 1.7):
    upper += arch_l(wx, .14, KY + KD, ZB + 52, ZB + 64, 5, "#6E9C95")
upper += fr(KY + .4, KY + .7, KX + KW, ZB + 52, ZB + 64, "#6E9C95") + fr(KY + 1.4, KY + 1.7, KX + KW, ZB + 52, ZB + 64, "#6E9C95")
upper += poly([P(KX + KW, KY + .8, ZB + 46), P(KX + KW, KY + 1.3, ZB + 46), P(KX + KW, KY + 1.3, ZB + 24), P(KX + KW, KY + 1.05, ZB + 29), P(KX + KW, KY + .8, ZB + 24)], "#4BB38B")
upper += box(KX - .14, KY - .14, KW + .28, KD + .28, 10, ("#FFFFFF", "#F1EADD", "#DED3C1"), ZB + 80)
add(4.01, upper, 3)

ZR = ZB + 90
o = .2
b0, b1, b2, b3 = P(KX - o, KY - o, ZR), P(KX + KW + o, KY - o, ZR), P(KX + KW + o, KY + KD + o, ZR), P(KX - o, KY + KD + o, ZR)
ap = P(KX + KW / 2, KY + KD / 2, ZR + 48)
roof = poly([b0, b1, ap], "#A6D8CE") + poly([b0, b3, ap], "#A6D8CE") + poly([b3, b2, ap], "#8FCABF") + poly([b1, b2, ap], "#74B3A8")
roof += f'<line x1="{ap[0]:.1f}" y1="{ap[1]:.1f}" x2="{ap[0]:.1f}" y2="{ap[1] - 28:.1f}" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>'
roof += f'<g transform="translate({ap[0]:.1f} {ap[1] - 28:.1f})"><path class="wave" d="M0 0 q10 -3 20 2 q-10 4 -20 8z" fill="#4BB38B"/></g>'
add(4.02, roof, LAST)

# 屋頂的施工線（最後一題）
gr = (f'<polygon points="{pts([b3, b2, ap])}" fill="{ORANGE}" fill-opacity=".14" stroke="{ORANGE}" stroke-width="2" stroke-dasharray="6 5"/>'
      f'<polygon points="{pts([b1, b2, ap])}" fill="{ORANGE}" fill-opacity=".1" stroke="{ORANGE}" stroke-width="2" stroke-dasharray="6 5"/>')
add(4.03, f'<g class="ghp">{gr}</g>', 12, 12, "fade")
# 上半部的施工線（第 2 題）
gu = "".join(f'<polygon points="{pts(f)}" fill="none" stroke="{ORANGE}" stroke-width="2" stroke-dasharray="6 5"/>' for f in [
    [P(KX, KY + KD, ZB + 40), P(KX + KW, KY + KD, ZB + 40), P(KX + KW, KY + KD, ZB + 80), P(KX, KY + KD, ZB + 80)],
    [P(KX + KW, KY, ZB + 40), P(KX + KW, KY + KD, ZB + 40), P(KX + KW, KY + KD, ZB + 80), P(KX + KW, KY, ZB + 80)],
    [P(KX, KY, ZB + 80), P(KX + KW, KY, ZB + 80), P(KX + KW, KY + KD, ZB + 80), P(KX, KY + KD, ZB + 80)]])
add(4.04, f'<g class="ghp">{gu}</g>', 2, 2, "fade")

# 圍牆（第 2 題答完）
WT = ("#F8DCC8", WALLC[1], WALLC[2])
gx = YX0
while gx < YX1 - 1e-6:
    seg = min(1, YX1 - gx)
    add(3.5 + gx * .01 if gx < KX + KW else 5.0 + gx * .01, box(gx, YY0, seg, T, WH, WT), 3, LAST, "drop", 1)
    gx += seg
gy = YY0
while gy < YY1 - 1e-6:
    seg = min(1, YY1 - gy)
    add(3.4 + gy * .01, box(YX0, gy, T, seg, WH, WT), 3, LAST, "drop", 1)
    gy += seg
for a, b in [(YX0, 1.5), (1.5, GATE[0]), (GATE[1], 4.2), (4.2, 5.2), (5.2, YX1)]:
    add(b + YY1, box(a, YY1 - T, b - a, T, WH, WT), 3, LAST, "drop", 2)
gy = YY0
while gy < YY1 - 1e-6:
    seg = min(1, YY1 - gy)
    add(YX1 + gy + seg + .2, box(YX1 - T, gy, T, seg, WH, WT), 3, LAST, "drop", 2)
    gy += seg
TOWER = ("#FBE7D8", "#EDBBA0", "#D9A186")
for px, py in [(YX0, YY0), (YX1 - .4, YY0), (YX0, YY1 - .4), (YX1 - .4, YY1 - .4), (GATE[0] - .4, YY1 - .4), (GATE[1], YY1 - .4)]:
    add(px + py + .9 if py > YY0 else 3.45, box(px - .04, py - .04, .48, .48, 22, TOWER), 3, LAST, "drop", 3)
for px in (GATE[0] - .2, GATE[1] + .2):
    lx, ly = P(px, YY1 - .16, 24)
    add(px + YY1 + 1, f'<circle cx="{lx:.1f}" cy="{ly - 4:.1f}" r="4.2" fill="#FFE7A3"/><circle cx="{lx:.1f}" cy="{ly - 4:.1f}" r="8" fill="#FFE7A3" opacity=".35"/>', LAST, LAST, "fade")

# 開張旗（第 2 題）
fxp = P(3.7, 5.25)
flag = (f'<ellipse cx="{fxp[0]:.1f}" cy="{fxp[1] + 1:.1f}" rx="6" ry="2.5" fill="#55632E" opacity=".2"/>'
        f'<line x1="{fxp[0]:.1f}" y1="{fxp[1]:.1f}" x2="{fxp[0]:.1f}" y2="{fxp[1] - 52:.1f}" stroke="#9C7A56" stroke-width="3" stroke-linecap="round"/>'
        f'<g transform="translate({fxp[0] + 1:.1f} {fxp[1] - 50:.1f})"><path class="wave" d="M0 0 q12 -3 24 3 q-12 5 -24 10z" fill="{ORANGE}"/></g>')
add(8.95, flag, 3)

# 倉庫的箱子（第 3 題）：38 箱 ≈ $38,000
CRATES = 38
cells = [(i, j, k) for k in range(4) for j in range(4) for i in range(3)][:CRATES]
for n, (i, j, k) in enumerate(cells):
    cgx, cgy = 3.9 + i * .66, 1.0 + j * .66
    add(cgx + cgy + .62 + k * .01, crate(cgx, cgy, k * .62 * 34), 4, LAST, "drop", min(20, 1 + n // 2))

# 皇冠奇異鳥（第 1 題）
bx, by = P(*BOSS)
add(BOSS[0] + BOSS[1], kiwi(bx, by, 1.1, SEAN, acc="crown"), 2)

# 建城貸款看板（第 4 題）
lb = box(.7, 5.75, .1, .1, 44, WOOD) + box(1.8, 5.75, .1, .1, 44, WOOD)
lb += fl(.6, 2.0, 5.86, 20, 44, "#F3E3C6") + fl(.6, 2.0, 5.87, 20, 22, "#D9BE90")
lb += fl(.75, 1.85, 5.88, 27, 33, "#E7EFD8") + fl(.75, .82, 5.89, 27, 33, "#86C64F")
lb += fl(.75, 1.4, 5.88, 36, 40, "#D9BE90")
add(7.7, lb, 5)

# 水庫基金池（第 10 題）
px_, py_, pw_, pd_ = POND
pond = box(px_, py_, pw_, pd_, 7, STONE)
pond += iso(f'<rect x="{px_ + .1}" y="{py_ + .1}" width="{pw_ - .2}" height="{pd_ - .2}" rx=".12" fill="#5FBF98"/>'
            f'<rect x="{px_ + .25}" y="{py_ + .22}" width=".35" height=".06" fill="#FFFFFF" opacity=".7"/>'
            f'<rect x="{px_ + .55}" y="{py_ + .42}" width=".25" height=".05" fill="#FFFFFF" opacity=".6"/>', lift=7)
add(px_ + py_ + pw_ + pd_, pond, 12)

# 居民
for (gx_, gy_), scarf, acc, a, flip in [(DDP, DD, "pack", 6, False), (TBP, TB, None, 8, True), (TCP, TC, None, 8, False)]:
    x_, y_ = P(gx_, gy_)
    add(gx_ + gy_, kiwi(x_, y_, 1.0, scarf, flip=flip, acc=acc), a, LAST, "drop", 0 if a == 6 else (1 if scarf == TB else 3))


# ---------- 場地（第 7 題） ----------
def house(hx, hy, hw, hd, hh=40, rh=34):
    s = box(hx, hy, hw, hd, hh, CREAM)
    s += fl(hx + .8, hx + 1.4, hy + hd, 0, 26, "#C98E5F") + fl(hx + .86, hx + 1.34, hy + hd, 0, 24, "#D9A274")
    for a in (.12, 1.75):
        s += fl(hx + a, hx + a + .6, hy + hd, 13, 29, "#FFFFFF") + fl(hx + a + .07, hx + a + .53, hy + hd, 15, 27, "#BFE3E6")
        s += fl(hx + a, hx + a + .6, hy + hd + .02, 10, 13, "#EE9C7E")
    for a in (.35, 1.45):
        s += fr(hy + a, hy + a + .5, hx + hw, 14, 30, "#FFFFFF") + fr(hy + a + .06, hy + a + .44, hx + hw, 16, 28, "#BFE3E6")
    gxm, ov = hx + hw / 2, .2
    s += poly([P(hx - ov, hy, hh), P(hx - ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(gxm, hy, hh + rh)], "#F6B79D")
    s += poly([P(hx, hy + hd, hh), P(hx + hw, hy + hd, hh), P(gxm, hy + hd, hh + rh)], CREAM[1])
    c = P(gxm, hy + hd, hh + 14)
    s += f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="5" fill="#BFE3E6" stroke="#FFFFFF" stroke-width="2"/>'
    s += poly([P(hx + hw + ov, hy, hh), P(hx + hw + ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(gxm, hy, hh + rh)], "#EE9C7E")
    s += f'<polyline points="{pts([P(hx - ov, hy + hd, hh), P(gxm, hy + hd, hh + rh), P(hx + hw + ov, hy + hd, hh)])}" fill="none" stroke="#FFF6E6" stroke-width="3" stroke-linejoin="round"/>'
    s += box(hx + .4, hy + .35, .4, .4, 16, ("#E7A58B", "#D98E73", "#C67C63"), hh + 12)
    return s


def studio(cx0, cy0, cw, cd, ch=44):
    s = box(cx0, cy0, cw, cd, ch, MINT)
    s += fl(cx0 + .5, cx0 + 1.2, cy0 + cd, 0, 30, "#FFFFFF") + fl(cx0 + .56, cx0 + 1.14, cy0 + cd, 0, 28, "#9CC6DA")
    s += fl(cx0 + 1.5, cx0 + 2.35, cy0 + cd, 10, 32, "#FFFFFF") + fl(cx0 + 1.56, cx0 + 2.29, cy0 + cd, 12, 30, "#CDE9F1")
    s += fr(cy0 + .3, cy0 + 1.0, cx0 + cw, 12, 34, "#FFFFFF") + fr(cy0 + .36, cy0 + .94, cx0 + cw, 14, 32, "#CDE9F1")
    s += fr(cy0 + 1.3, cy0 + 1.9, cx0 + cw, 12, 34, "#FFFFFF") + fr(cy0 + 1.36, cy0 + 1.84, cx0 + cw, 14, 32, "#CDE9F1")
    n = 8
    for i in range(n):
        a = cx0 + .35 + (cw - .6) * i / n
        b = cx0 + .35 + (cw - .6) * (i + 1) / n
        s += poly([P(a, cy0 + cd, 37), P(b, cy0 + cd, 37), P(b, cy0 + cd + .5, 30), P(a, cy0 + cd + .5, 30)], "#86BBD8" if i % 2 == 0 else "#FFFFFF")
    s += box(cx0 - .1, cy0 - .1, cw + .2, cd + .2, 6, ("#FBF8F1", "#ECE6D8", "#DAD2C1"), ch)
    s += poly([P(cx0 + .15, cy0 + .15, ch + 6), P(cx0 + cw - .15, cy0 + .15, ch + 6), P(cx0 + cw - .15, cy0 + cd - .15, ch + 6), P(cx0 + .15, cy0 + cd - .15, ch + 6)], "#E2DCCD")
    sx, sy = P(cx0 + .45, cy0 + cd, 40)
    s += f'<g transform="translate({sx:.1f} {sy:.1f}) skewY(26.565)"><rect x="0" y="-12" width="64" height="12" rx="3" fill="#FFFFFF"/><text x="32" y="-2.4" font-size="9.5" font-weight="700" text-anchor="middle" fill="#3F7FA3" letter-spacing="2">DANCE</text></g>'
    return s


add(HX + HY + HW + HD, house(HX, HY, HW, HD), 9, LAST, "drop", 0)
add(CX + CY + CW + CD, studio(CX, CY, CW, CD), 9, LAST, "drop", 3)

# 橋＋路標（第 9 題）
br = box(6.85, 5.85, 1.2, .8, 6, WOOD)
for k in range(1, 6):
    xk = 6.85 + k * .2
    a_, b_ = P(xk, 5.85, 6), P(xk, 6.65, 6)
    br += f'<line x1="{a_[0]:.1f}" y1="{a_[1]:.1f}" x2="{b_[0]:.1f}" y2="{b_[1]:.1f}" stroke="#CFA072" stroke-width="1"/>'
br += box(6.85, 5.85, 1.2, .1, 8, WOOD, 6) + box(6.85, 6.55, 1.2, .1, 8, WOOD, 6)
add(14.6, br, 11, LAST, "drop", 2)
add(8.5 + 5.55, g.marker(8.5, 5.55), 11, LAST, "drop", 4)

spr.sort(key=lambda s: s[0])
SPRITES = "".join(s for _, s in spr)


# ---------- 世界裡的字（手機版放大 K 倍） ----------
def nametag(x, y, label, fill="#FFFDF7", color=INK):
    return g.nametag(x, y, label, fill, color)


def labels(K, mobile):
    out = []

    def lab(svg, ax, ay, a, b=LAST, kind="pop", mob=True):
        if mobile and not mob:
            return
        if K != 1:
            svg = f'<g transform="translate({ax:.1f} {ay:.1f}) scale({K}) translate({-ax:.1f} {-ay:.1f})">{svg}</g>'
        out.append(piece(svg, a, b, kind))

    role_t = ("#EAF1FB", "#34609C")
    role_a = ("#F1EAFB", "#6A4C9C")
    lab(nametag(bx, by + 8, "Sean"), bx, by + 8, 2)
    lab(nametag(bx, by + 30, "老師", *role_t), bx, by + 30, 8, mob=False)
    lab(nametag(fxp[0], fxp[1] + 6, "11/1 開張", "#FFF1DE", "#9A5208"), fxp[0], fxp[1] + 6, 3, mob=False)

    lp = P(1.3, 5.86, 50)
    loan = (f'<g transform="translate(9 8)">{ic_hammer(24)}</g>'
            f'<text x="40" y="17" font-size="11" font-weight="700" fill="{SUB}">建城貸款</text>'
            f'<text x="40" y="33" font-size="16" font-weight="600" fill="{INK}">$60,000</text>')
    lab(g.bubble(lp[0], lp[1], 118, 42, loan), lp[0], lp[1], 5, 7, mob=False)

    for (gx_, gy_), name, a, role, rc in [(DDP, "丁丁", 6, "老師・助教", role_t), (TBP, "老師 B", 8, "老師", role_t), (TCP, "助教 C", 8, "助教", role_a)]:
        x_, y_ = P(gx_, gy_)
        lab(nametag(x_, y_ + 6, name), x_, y_ + 6, a, mob=(name == "丁丁"))
        lab(nametag(x_, y_ + 28, role, *rc), x_, y_ + 28, 8, mob=False)
    dx, dy = P(*DDP)
    lab(g.bubble(dx + 2, dy - 44, 112, 34, coin(20, 17) + f'<text x="36" y="23.5" font-size="18" font-weight="600" fill="{INK}">$2,000</text>'), dx, dy - 44, 6, 7, mob=False)
    tx, ty = P(*TCP)
    lab(nametag(tx, ty + 50, "助教費 $250／天", "#FFF1DE", "#9A5208"), tx, ty + 50, 12, 12, mob=False)

    hp = P(HX + HW / 2, HY + HD / 2, 88)
    lab(nametag(hp[0], hp[1] - 24, "台南 · 丁丁家"), hp[0], hp[1] - 24, 9)
    cp = P(CX + CW / 2, CY + CD / 2, 56)
    lab(nametag(cp[0], cp[1] - 22, "高雄 · 24steps"), cp[0], cp[1] - 22, 9)
    fee1 = coin(18, 17) + f'<text x="34" y="23" font-size="16" font-weight="600" fill="{INK}">$500／天</text><text x="112" y="22" font-size="11.5" font-weight="700" fill="{SUB}">給丁丁</text>'
    lab(g.bubble(hp[0], hp[1] - 30, 156, 34, fee1), hp[0], hp[1] - 30, 10, 12, mob=False)
    fee2 = coin(18, 17) + f'<text x="34" y="23" font-size="16" font-weight="600" fill="{INK}">$405／堂</text><text x="112" y="22" font-size="11.5" font-weight="700" fill="{SUB}">外面的場地</text>'
    lab(g.bubble(cp[0], cp[1] - 28, 180, 34, fee2), cp[0], cp[1] - 28, 10, 12, mob=False)

    pp = P(POND[0] + POND[2] / 2, POND[1] + POND[3] / 2, 14)
    drop = '<path d="M20 9 q7 9 7 13 a7 7 0 0 1 -14 0 q0 -4 7 -13z" fill="#5FBF98"/>'
    fund = (drop + f'<text x="34" y="17" font-size="11" font-weight="700" fill="{SUB}">水庫基金</text>'
            f'<text x="34" y="33" font-size="16" font-weight="600" fill="{INK}">抽 10%</text>')
    lab(g.bubble(pp[0], pp[1], 104, 42, fund), pp[0], pp[1], 12)

    kp = P(KX + KW / 2, KY + KD / 2, ZR + 48 + 34)
    plate = (f'<circle cx="22" cy="21" r="14" fill="#E3F7F0"/>'
             '<path d="M15 21h14v9H15z" fill="#F6F1E8"/><path d="M13 21 22 13l9 8z" fill="#74B3A8"/><path d="M20 30v-4a2 2 0 0 1 4 0v4z" fill="#A57B50"/>'
             f'<text x="44" y="18" font-size="11" font-weight="700" fill="{SUB}">主堡財庫</text>'
             f'<text x="44" y="35" font-size="18" font-weight="600" fill="{INK}">$38,000</text>')
    lab(g.bubble(kp[0], kp[1], 132, 42, plate), kp[0], kp[1], LAST)

    # 開城：錢沿著路流回主堡
    if not mobile:
        path1 = "M" + " L".join(f"{P(*q, 10)[0]:.1f} {P(*q, 10)[1]:.1f}" for q in [(9.9, 3.8), (9.9, 6.25), (2.7, 6.25), (2.7, 4.9)])
        path2 = "M" + " L".join(f"{P(*q, 10)[0]:.1f} {P(*q, 10)[1]:.1f}" for q in [(9.6, 7.1), (9.6, 6.25), (2.7, 6.25), (2.7, 4.9)])
        flow = ""
        for pth, begin in [(path1, "0s"), (path2, "1.4s"), (path1, "2.8s")]:
            flow += (f'<g>{coin(0, 0, 7)}<animateMotion dur="4.2s" begin="{begin}" repeatCount="indefinite" path="{pth}"/>'
                     '<animate attributeName="opacity" dur="4.2s" begin="' + begin + '" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;.1;.85;1"/></g>')
        out.append(piece(f'<g class="flow">{flow}</g>', LAST, LAST, "fade"))
    return "".join(out)


def scene_svg(K=1, mobile=False, vb="0 0 820 800", w=820, h=800):
    return (f'<svg viewBox="{vb}" width="{w}" height="{h}" role="img" aria-label="建城中的奇異鳥小鎮：答一題，主堡和小鎮就多蓋一塊" style="display:block">'
            f'{g.DEFS}{ISLAND}{FLAT}{FLATP}{SPRITES}{labels(K, mobile)}</svg>')


# ---------- CSS ----------
STAGES = 15


def css_pieces():
    rules = []
    for a, b in sorted(USED):
        sel = ",".join(f".s{k} .v{a}_{b}" for k in range(a, min(b, LAST) + 1))
        rules.append(sel + "{opacity:1;transform:none}")
    return "\n".join(rules)


CHAPTERS = [(1, 5), (7, 7), (8, 9), (10, 12)]


def css_track():
    rules = []
    for i, (a, b) in enumerate(CHAPTERS, 1):
        cur = ",".join(f".s{k} .cs{i} .bar" for k in range(a, b + 1))
        rules.append(cur + "{background:" + ORANGE + "}")
        rules.append(",".join(f".s{k} .cs{i} .lb" for k in range(a, b + 1)) + "{color:#4D4239;font-weight:900}")
        done = range(b + 1 if i > 1 else 6, LAST + 1)
        rules.append(",".join(f".s{k} .cs{i} .bar" for k in done) + "{background:#4BB38B}")
        rules.append(",".join(f".s{k} .cs{i} .lb" for k in done) + "{color:#1B5E4A}")
        rules.append(",".join(f".s{k} .cs{i} .ck" for k in done) + "{display:block}")
    return "\n".join(rules)


DELAYS = "\n".join(f".dl{i}{{transition-delay:{i * 40}ms}}" for i in range(1, 21))
CONFETTI_COLORS = ["#F4A23C", "#4BB38B", "#E58B7A", "#7FA8E0", "#F6C344", "#B79CE3"]

CSS = """
body{margin:0;background:#F1EEDF}
.root{position:relative;display:flex;overflow:hidden;font-family:'Noto Sans TC',system-ui,sans-serif;color:#4D4239;background:#F1EEDF}
.f{font-family:Fredoka,'Noto Sans TC',sans-serif;font-variant-numeric:tabular-nums}
.scn{position:relative;overflow:hidden}
.scn svg text{font-family:Fredoka,'Noto Sans TC',sans-serif}
.pc{opacity:0;transition:opacity 260ms cubic-bezier(0.23,1,0.32,1),transform 560ms cubic-bezier(0.23,1,0.32,1);transform-box:fill-box;transform-origin:50% 100%}
.pc.drop{transform:translateY(-28px) scale(.96)}
.pc.pop{transform:scale(.92)}
""" + DELAYS + """
@keyframes ghost{0%,100%{opacity:.5}50%{opacity:1}}
.ghp{animation:ghost 1.6s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes wave{0%,100%{transform:skewY(0)}50%{transform:skewY(-9deg)}}
.hop{animation:hop .9s ease-in-out infinite}
.hop2{animation:hop .9s ease-in-out .45s infinite}
.wave{animation:wave 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:left center}
@keyframes fall{0%{opacity:1;transform:translateY(-40px) rotate(0deg)}100%{opacity:0;transform:translateY(300px) rotate(540deg)}}
.cf{position:absolute;top:0;width:8px;height:12px;border-radius:2px;opacity:0}
.s13 .cf{animation:fall 1.9s cubic-bezier(0.23,1,0.32,1) forwards}
.hud{position:absolute;display:flex;align-items:center;gap:8px;z-index:2}
.badge{position:relative;border-radius:50%;background:#E3F1EC;border:4px solid #FFFDF7;box-shadow:0 4px 14px rgba(77,66,57,.16);display:grid;place-items:center;flex:none}
.badge .bl{position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);white-space:nowrap;background:#F4A23C;color:#4D2A00;font-weight:700;font-size:12px;border-radius:999px;padding:2px 9px;border:3px solid #FFFDF7}
.s13 .badge .bl{background:#4BB38B;color:#0F3B2E}
.pill{display:flex;align-items:center;gap:8px;height:40px;padding:0 14px 0 5px;border-radius:999px;background:#FFFDF7;box-shadow:0 2px 0 rgba(77,66,57,.10),0 6px 18px rgba(77,66,57,.10);transform-origin:left center}
.pill .ic{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;background:#FFF3D9;flex:none}
.pill .n{font-family:Fredoka,'Noto Sans TC',sans-serif;font-weight:600;font-size:20px;line-height:1}
.pill .l{font-size:12px;color:#76675A;font-weight:500}
.chip{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;white-space:nowrap;background:#FFFDF7;border-radius:999px;padding:8px 18px 8px 10px;box-shadow:0 2px 0 rgba(77,66,57,.10),0 8px 22px rgba(77,66,57,.14);font-size:14px;font-weight:700;z-index:2}
.pnl{position:relative;z-index:3;flex:none;background:#FFFDF7;display:flex;flex-direction:column}
.ph{display:flex;flex-direction:column;gap:14px}
.brand{display:flex;align-items:center;gap:8px;font-weight:900;font-size:15px}
.trk{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.cs{display:flex;flex-direction:column;gap:6px}
.bar{height:6px;border-radius:999px;background:#EADFCB;transition:background-color 300ms ease}
.lb{display:flex;align-items:center;gap:3px;font-size:12.5px;color:#76675A;font-weight:500}
.ck{display:none;flex:none}
.qs{flex:1;min-height:0;display:flex;flex-direction:column}
.qb{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:16px}
.eb{margin:0;font-size:13px;font-weight:700;color:#76675A}
.qh{display:flex;align-items:flex-start;gap:4px}
.qt{margin:0;flex:1;line-height:1.3;font-weight:900}
.qd{margin:-6px 0 0;font-size:15px;line-height:1.65;color:#5E5145}
.tip{position:relative;flex:none}
.tip summary{list-style:none;width:44px;height:44px;margin:-6px -10px 0 0;border-radius:999px;display:grid;place-items:center;color:#76675A;cursor:pointer}
.tip summary::-webkit-details-marker{display:none}
.tip[open] summary{background:#F4ECDD;color:#4D4239}
.tipc{position:absolute;right:0;top:42px;z-index:5;width:272px;background:#FFFFFF;border:1px solid #EADFCB;border-radius:16px;box-shadow:0 10px 30px rgba(77,66,57,.16);padding:12px 14px;font-size:13.5px;line-height:1.7;color:#4D4239;font-weight:400}
.ft{display:flex;gap:10px}
.bp{flex:1;height:52px;border:0;border-radius:16px;background:#1B5E4A;color:#FFFFFF;font:inherit;font-size:16px;font-weight:700;box-shadow:0 4px 0 #123F32;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform 120ms cubic-bezier(0.23,1,0.32,1),box-shadow 120ms cubic-bezier(0.23,1,0.32,1)}
.bp:active{transform:translateY(3px);box-shadow:0 1px 0 #123F32}
.bs{height:52px;padding:0 18px;border:1.5px solid #D9CBB2;border-radius:16px;background:#FFFFFF;color:#4D4239;font:inherit;font-size:15px;font-weight:700;box-shadow:0 3px 0 #E9DDC7;cursor:pointer;flex:none}
.bs.grow{flex:1}
.bg{height:52px;padding:0 10px;border:0;background:transparent;color:#5E5145;font:inherit;font-size:15px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer;flex:none}
.lk{border:0;background:transparent;padding:0 2px;min-height:44px;font:inherit;font-weight:700;color:#1B5E4A;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.opts{display:flex;flex-direction:column;gap:10px}
.opt{display:flex;align-items:center;gap:12px;min-height:60px;box-sizing:border-box;padding:8px 14px;border:1.5px solid #D9CBB2;border-radius:16px;background:#FFFFFF;cursor:pointer}
.opt.on{border:2px solid #1B5E4A;background:#EEF8F3;padding:7.5px 13.5px}
.opt input{width:20px;height:20px;margin:0;accent-color:#1B5E4A;flex:none}
.ot{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.ot b{font-size:16px;font-weight:700}
.ot small{font-size:13px;color:#76675A;line-height:1.5}
.fld{display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:700;color:#5E5145;min-width:0}
.money{display:flex;align-items:center;gap:6px;height:60px;box-sizing:border-box;padding:0 16px;border:1.5px solid #A8957A;border-radius:16px;background:#FFFFFF}
.money .cur{font-family:Fredoka,'Noto Sans TC',sans-serif;font-size:22px;font-weight:600;color:#76675A}
.money input{flex:1;min-width:0;width:100%;border:0;outline:0;background:transparent;font-family:Fredoka,'Noto Sans TC',sans-serif;font-size:26px;font-weight:600;color:#4D4239;padding:0}
.money.sm{height:48px;padding:0 12px;border-radius:14px}
.money.sm .cur{font-size:17px}
.money.sm input{font-size:19px}
.money .unit{font-size:14px;font-weight:700;color:#5E5145;flex:none}
.sel{height:48px;box-sizing:border-box;border:1.5px solid #A8957A;border-radius:14px;padding:0 10px;font:inherit;font-size:15px;font-weight:500;color:#4D4239;background:#FFFFFF;min-width:0;width:100%}
.hint{display:flex;align-items:center;gap:8px;font-size:14px;color:#5E5145}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chp{min-height:44px;padding:0 16px;border:1.5px solid #D9CBB2;border-radius:999px;background:#FFFFFF;font:inherit;font-size:14px;font-weight:700;color:#4D4239;cursor:pointer}
.chp.on{border:2px solid #1B5E4A;background:#EEF8F3;color:#1B5E4A}
.seg{display:flex;padding:3px;gap:3px;border:1.5px solid #D9CBB2;border-radius:14px;background:#FFFFFF}
.seg button{flex:1 1 0;min-height:40px;border:0;border-radius:11px;background:transparent;font:inherit;font-size:14px;font-weight:500;color:#4D4239;cursor:pointer;padding:0 8px;white-space:nowrap}
.seg button.on{background:#1B5E4A;color:#FFFFFF;font-weight:700}
.prow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #EFE5D4}
.prow:first-child{border-top:0}
.prow .ot b{font-size:15px}
.prow .seg{flex:none}
.add{display:flex;align-items:center;gap:8px;min-height:48px;border:1.5px dashed #C9B89C;border-radius:14px;background:transparent;font:inherit;font-size:14px;font-weight:700;color:#5E5145;padding:0 14px;cursor:pointer}
.vf{margin:0;border:1.5px solid #E6DAC4;border-radius:16px;padding:12px 14px 14px;display:flex;flex-direction:column;gap:10px;background:#FFFFFF}
.vf legend{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;padding:0 4px}
.row2{display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px}
.card{background:#FFF8EC;border-radius:18px;padding:14px 16px;display:flex;flex-direction:column}
.card .ct{font-size:15px;font-weight:700}
.card .cst{font-size:13px;color:#76675A;margin:2px 0 6px}
.ln{display:flex;justify-content:space-between;gap:12px;padding:7px 0;font-size:14.5px;border-top:1px solid #EFE2CC}
.ln:first-of-type{border-top:0}
.ln .neg{color:#8A4510}
.ln.tot{font-weight:700;border-top:2px solid #4D4239}
.ln.tot .v{color:#1B5E4A}
.chap{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.chap li{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px dashed #E3D6C0}
.chap li:first-child{border-top:0}
.num{width:32px;height:32px;border-radius:50%;background:#FFF3D9;display:grid;place-items:center;font-family:Fredoka,'Noto Sans TC',sans-serif;font-weight:700;font-size:15px;color:#7A4A00;flex:none}
.cnt{font-size:13px;color:#76675A;flex:none}
.note{margin:0;font-size:13.5px;line-height:1.65;color:#5E5145;background:#F7F1E5;border-radius:14px;padding:10px 14px}
.sum{margin:0;display:flex;flex-direction:column;border:1.5px solid #EADFCB;border-radius:16px;background:#FFFFFF}
.sum div{display:flex;gap:12px;padding:11px 14px;border-top:1px solid #EFE5D4;font-size:14.5px}
.sum div:first-child{border-top:0}
.sum dt{width:44px;flex:none;color:#76675A;font-weight:700}
.sum dd{margin:0;font-weight:700}
.nx{display:flex;align-items:center;gap:10px;min-height:52px;border:1.5px solid #D9CBB2;border-radius:16px;background:#FFFFFF;padding:0 14px;font:inherit;font-size:15px;font-weight:700;color:#4D4239;text-align:left;cursor:pointer;width:100%}
.nx span{flex:1}
@media (prefers-reduced-motion: reduce){
.pc{transform:none!important;transition:opacity 200ms ease}
.ghp,.hop,.hop2,.wave{animation:none}
.s13 .cf{animation:none}
.flow{display:none}
.bar{transition:none}
}
/* 電腦 */
.d .pnl{width:460px;height:800px;box-shadow:4px 0 0 rgba(77,66,57,.05),12px 0 32px rgba(77,66,57,.10)}
.d .ph{padding:24px 28px 0}
.d .qb{padding:26px 28px 8px}
.d .qt{font-size:26px}
.d .ft{padding:14px 28px 28px}
.d .scn{width:820px;height:800px}
.d .hud{left:22px;top:20px}
.d .chip{bottom:24px}
/* 手機 */
.m .pnl{position:absolute;left:0;right:0;top:318px;bottom:0;border-radius:28px 28px 0 0;box-shadow:0 -6px 24px rgba(77,66,57,.14)}
.m .ph{padding:16px 20px 0;gap:10px}
.m .brand{display:none}
.m .qb{padding:16px 20px 6px;gap:14px}
.m .qt{font-size:22px}
.m .qd{font-size:14.5px}
.m .ft{padding:10px 20px 24px}
.m .scn{position:absolute;left:0;top:0;width:390px;height:340px}
.m .hud{left:12px;top:12px;gap:6px}
.m .pill{height:32px;gap:6px;padding:0 10px 0 4px}
.m .pill .ic{width:24px;height:24px}
.m .pill .n{font-size:15px}
.m .pill .l{font-size:11px}
.m .chip{top:276px;font-size:13px;padding:6px 14px 6px 8px}
.m .tipc{width:250px}
.m .row2{grid-template-columns:104px minmax(0,1fr)}
.m .money{height:56px}
.m .money input{font-size:24px}
.m .prow .seg button{padding:0 6px;font-size:13.5px}
.m .opt{min-height:56px}
"""

# ---------- 圖示 ----------
S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
I_INFO = f'<svg width="20" height="20" viewBox="0 0 24 24" {S}><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>'
I_CAL = f'<svg width="22" height="22" viewBox="0 0 24 24" {S}><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>'
I_PLUS = f'<svg width="18" height="18" viewBox="0 0 24 24" {S}><path d="M12 5v14M5 12h14"/></svg>'
I_CHECK = '<svg class="ck" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
I_FLAG = f'<svg width="20" height="20" viewBox="0 0 24 24" {S}><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>'
I_CHEV = f'<svg width="18" height="18" viewBox="0 0 24 24" {S}><path d="M9 6l6 6-6 6"/></svg>'
I_HOME = ('<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><circle cx="12" cy="12" r="12" fill="#FDEEE6"/>'
          '<path d="M6.5 12h11v6.5h-11z" fill="#FFF6E6"/><path d="M5 12.5 12 6l7 6.5z" fill="#EE9C7E"/><path d="M10.6 18.5v-3.2h2.8v3.2z" fill="#C98E5F"/></svg>')
I_STUDIO = ('<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><circle cx="12" cy="12" r="12" fill="#E5F2F7"/>'
            '<path d="M6 9h12v9.5H6z" fill="#EEF7F3"/><path d="M5.5 8h13v1.6h-13z" fill="#DAD2C1"/>'
            '<path d="M6 10h2v1.6H6zM10 10h2v1.6h-2zM14 10h2v1.6h-2z" fill="#86BBD8"/><path d="M8 13h3v5.5H8z" fill="#9CC6DA"/></svg>')
CRATE_IC = ic_crate(*CRATE, 22)


def av(scarf, acc=None, s=40, bg="#FFF3D9"):
    return kiwi_avatar(scarf, acc, bg, s)


def tip(text):
    return (f'<details class="tip"><summary aria-label="說明">{I_INFO}</summary>'
            f'<div class="tipc">{text}</div></details>')


def head(eb, title, desc=None, tiptext=None):
    s = f'<p class="eb">{eb}</p>' if eb else ""
    s += f'<div class="qh"><h2 class="qt">{title}</h2>{tip(tiptext) if tiptext else ""}</div>'
    if desc:
        s += f'<p class="qd">{desc}</p>'
    return s


def foot(primary="下一步", prev=True, skip=False, handler="next", icon="", prev_label="上一步", prev_handler="prev"):
    s = '<div class="ft">'
    if prev:
        s += f'<button type="button" class="bs" onClick="@@{prev_handler}@@">{prev_label}</button>'
    if skip:
        s += '<button type="button" class="bg" onClick="@@next@@">略過</button>'
    s += f'<button type="button" class="bp" onClick="@@{handler}@@">{icon}{primary}</button></div>'
    return s


def money(value, label, sm=False, unit=None, placeholder=None):
    val = f'value="{value}"' if value else f'placeholder="{placeholder or "0"}"'
    return (f'<span class="money{" sm" if sm else ""}"><span class="cur">$</span>'
            f'<input {val} inputmode="numeric" aria-label="{label}"/>'
            + (f'<span class="unit">{unit}</span>' if unit else "") + '</span>')


def seg(label, items, on):
    return (f'<div class="seg" role="group" aria-label="{label}">'
            + "".join((f'<button type="button" aria-pressed="true" class="on">{t}</button>' if i == on
                       else f'<button type="button" aria-pressed="false">{t}</button>') for i, t in enumerate(items))
            + '</div>')


def opt(inner_icon, title, sub, on, kind="radio", name="o"):
    return (f'<label class="opt{" on" if on else ""}"><input type="{kind}" name="{name}"{" checked" if on else ""}/>'
            f'{inner_icon}<span class="ot"><b>{title}</b>' + (f'<small>{sub}</small>' if sub else "") + '</span></label>')


def body(n, inner, foot_html):
    return (f'<sc-if value="@@v.s{n}@@" hint-placeholder-val="@@{"true" if n == 0 else "false"}@@">'
            f'<div class="qs"><div class="qb">{inner}</div>{foot_html}</div></sc-if>')


Q = []

Q.append(body(0,
    head(None, "蓋一座主堡", "回答幾個問題，右邊的小鎮就會一塊一塊蓋起來。蓋好，水庫就開始記帳。",
         "先準備：Excel「大水庫結餘」最後的數字、存摺餘額、手上的現金。")
    + '<ol class="chap">'
    + "".join(f'<li><span class="num">{i}</span><span class="ot"><b>{t}</b><small>{d}</small></span><span class="cnt">{c} 題</span></li>'
              for i, t, d, c in [(1, "主堡", "錢放在哪、現在有多少", 5), (2, "居民", "誰是老師、誰是助教", 1),
                                 (3, "場地", "在哪上課、場地費", 2), (4, "分帳", "老師怎麼拿錢", 3)])
    + '</ol><p class="note">蓋好主堡就能開始收錢，後面三塊可以之後再蓋。</p>',
    foot("開始建城", prev=False)))

Q.append(body(1,
    head("主堡 · 1 / 11", "誰保管公司的錢？", "他會戴上皇冠，負責確認大家送回來的錢。",
         "只有他看得到「收到了」、能記大水庫的支出，有人送錢來也通知他。之後可以在水庫設定換人。")
    + '<div class="opts" role="radiogroup" aria-label="營收負責人">'
    + opt(av(SEAN), "Sean", "管理員", True, name="own")
    + opt(av(DD), "丁丁（我）", "擁有者", False, name="own")
    + opt(av(TB), "老師 B", "老師", False, name="own")
    + '</div><p class="qd" style="margin:0;font-size:14px">Sean 不在旁邊？<button type="button" class="lk">交給他填後面的題目</button></p>',
    foot()))

Q.append(body(2,
    head("主堡 · 2 / 11", "從哪天開始記帳？", "這天之後的收款記在這裡，之前的留在 Excel。",
         "選月初最好對帳：月結剛好從這天算。這天之前付款的課卡不算代收。")
    + '<div class="chips"><button type="button" class="chp" aria-pressed="false">今天 10/29</button>'
    + '<button type="button" class="chp on" aria-pressed="true">11/1 下個月 1 號</button></div>'
    + '<label class="fld">啟用日<span class="money"><span style="display:grid;color:#76675A">' + I_CAL + '</span>'
    + '<input value="2026/11/1（日）" aria-label="啟用日" style="font-size:22px"/></span></label>',
    foot()))

Q.append(body(3,
    head("主堡 · 3 / 11", "大水庫現在有多少錢？", "現金加銀行，一個數就好。",
         "可以先抄 Excel「大水庫結餘」最後的累計數，再跟存摺、手上的現金對一下。學生付了、還沒上的課不用填，系統從課卡算。")
    + '<label class="fld">現金＋銀行' + money("38,000", "大水庫現在有多少錢") + '</label>'
    + f'<p class="hint" style="margin:0">{CRATE_IC}<span>倉庫會堆 <b class="f">38</b> 箱，一箱大約 $1,000</span></p>',
    foot()))

Q.append(body(4,
    head("主堡 · 4 / 11 · 可以略過", "你自己放了多少錢進來？", "前期投入、自己掏錢補的。只記帳，不排還款。",
         "填了會立一塊建城貸款看板，大家看得到回本進度（水庫基金 ÷ 建城貸款）。略過的話之後在水庫設定補。")
    + '<label class="fld">建城貸款' + money("60,000", "你自己放了多少錢進來") + '</label>',
    foot(skip=True)))

Q.append(body(5,
    head("主堡 · 5 / 11", "誰手上還有沒交的錢？", "收了學生的錢、還沒交給 Sean 的。沒有就空著。",
         "每人一個數，會變成他背包裡的錢，之後用推車送回主堡。")
    + '<div style="display:flex;flex-direction:column">'
    + f'<div class="prow">{av(DD, "pack")}<span class="ot"><b>丁丁</b></span><span style="width:150px">{money("2,000", "丁丁手上的錢", sm=True)}</span></div>'
    + f'<div class="prow">{av(TB)}<span class="ot"><b>老師 B</b></span><span style="width:150px">{money("", "老師 B 手上的錢", sm=True)}</span></div>'
    + '</div>',
    foot()))

Q.append(body(6,
    head("第一塊蓋好了", "主堡可以收錢了！", "代收、繳回、大水庫的帳，從 11/1 開始記。")
    + '<div class="card"><span class="ct">下一步：老師怎麼分錢</span><span class="cst">大約 5 分鐘</span>'
    + '<ol class="chap">'
    + "".join(f'<li><span class="num">{i}</span><span class="ot"><b>{t}</b><small>{d}</small></span></li>'
              for i, t, d in [(2, "居民", "誰是老師、誰是助教"), (3, "場地", "在哪上課、場地費"), (4, "分帳", "老師怎麼拿錢")])
    + '</ol></div><p class="note">先到這裡也可以：分帳先「不用算」，收入全部留在教室，之後再接著蓋。</p>',
    foot("繼續蓋", prev_label="先到這裡", prev_handler="stop")))

TEACHERS = [(SEAN, "Sean", "有帳號", 0), (DD, "丁丁", "有帳號", 2), (TB, "老師 B", "有帳號", 0), (TC, "助教 C", "沒帳號", 1)]
Q.append(body(7,
    head("居民 · 6 / 11", "誰是老師、誰是助教？", "點名時用得到。沒帳號的人也可以加。",
         "從老師頁帶進來。只當助教的人，排課選老師時不會出現；點名選助教時排最前面。")
    + '<div style="display:flex;flex-direction:column">'
    + "".join(f'<div class="prow">{av(c, s=36)}<span class="ot"><b>{n}</b><small>{sub}</small></span>{seg(n + " 的身分", ["老師", "助教", "都是"], on)}</div>'
              for c, n, sub, on in TEACHERS)
    + f'</div><button type="button" class="add">{I_PLUS}再加一位</button>',
    foot()))

Q.append(body(8,
    head("場地 · 7 / 11", "你們在哪裡上課？", "每個地方會蓋一間教室。",
         "從分部設定帶進來，只有一個地方也可以。課卡每個地方都能用，錢一樣回到主堡。")
    + '<div class="opts">'
    + opt(I_HOME, "台南 · 丁丁家", "分部", True, "checkbox", "loc")
    + opt(I_STUDIO, "高雄 · 24steps", "分部", True, "checkbox", "loc")
    + f'</div><button type="button" class="add">{I_PLUS}加一個地方</button>',
    foot()))


def venue(icon, name, on, amount, unit, payee):
    opts_ = ["丁丁（成員）", "外面的場地"]
    if payee:
        opts_.reverse()
    return (f'<fieldset class="vf"><legend>{icon}{name}</legend>'
            + seg(name + " 場地費怎麼算", ["不用", "每堂固定", "每天固定"], on)
            + f'<div class="row2"><label class="fld">{unit}{money(amount, name + unit + "場地費", sm=True)}</label>'
            + '<label class="fld">付給<select class="sel">' + "".join(f"<option>{o}</option>" for o in opts_) + '</select></label></div></fieldset>')


Q.append(body(9,
    head("場地 · 8 / 11", "場地要付錢嗎？", "每個地方各自設。",
         "每天固定：當天的課平攤，早的堂多 1 元。付給成員會算進他的薪水；付給外面的場地，付場租時在大水庫記一筆。")
    + venue(I_HOME, "台南 · 丁丁家", 2, "500", "每天", False)
    + venue(I_STUDIO, "高雄 · 24steps", 1, "405", "每堂", True),
    foot()))

Q.append(body(10,
    head("分帳 · 9 / 11", "老師怎麼拿錢？", "選最接近的。例外之後在分帳規則設。",
         "一堂有兩位老師：預設平分，之後可以在每門課設比例。")
    + '<div class="opts" role="radiogroup" aria-label="老師怎麼拿錢">'
    + opt("", "不用算", "收入全部留在教室", False, name="pay")
    + opt("", "每堂固定鐘點費", "老師每堂拿固定的錢", False, name="pay")
    + opt("", "拆帳", "扣掉場地費、助教費和抽成，剩下的給老師", True, name="pay")
    + '</div>',
    foot()))

Q.append(body(11,
    head("分帳 · 10 / 11", "助教費和教室抽成", "都在分給老師之前扣。",
         "抽成 ＝（收入 − 場地費 − 助教費）× %，四捨五入到元，進水庫基金。不抽就填 0。")
    + '<div class="fld">助教費' + seg("助教費怎麼算", ["不用", "每堂固定", "每天固定"], 2) + '</div>'
    + '<label class="fld">每天' + money("250", "每天助教費", sm=True) + '</label>'
    + '<label class="fld">教室抽成<span class="money sm" style="width:150px"><input value="10" inputmode="numeric" aria-label="教室抽成百分比"/><span class="unit">%</span></span></label>'
    + '<p class="hint" style="margin:-4px 0 0">抽到的錢進水庫基金</p>',
    foot()))

Q.append(body(12,
    head("分帳 · 11 / 11", "用一堂真的課算算看", None,
         "用最近點過名的一堂課，照剛剛的答案算。不對就回上一步改，之後也能在分帳規則改。")
    + '<div class="card f"><span class="ct" style="font-family:\'Noto Sans TC\',sans-serif">10/25（日）Bachata lv2 · 台南</span>'
    + '<span class="cst" style="font-family:\'Noto Sans TC\',sans-serif">Sean · 9 人次 · 這天 3 堂</span>'
    + "".join(f'<div class="ln{" tot" if t else ""}"><span style="font-family:\'Noto Sans TC\',sans-serif">{k}</span><span class="{"neg" if v.startswith("−") else "v"}">{v}</span></div>'
              for k, v, t in [("點名收入", "$3,050", False), ("場地費 $500 ÷ 3 堂", "−$167", False), ("助教費 $250 ÷ 3 堂", "−$84", False),
                              ("教室抽成 10%", "−$280", False), ("分給老師", "$2,519", True)])
    + '</div><div class="row2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">'
    + '<label class="fld">老師實拿取整<select class="sel"><option>捨去到十位</option><option>捨去到百位</option><option>不取整</option></select></label>'
    + '<label class="fld">零頭歸<select class="sel"><option>水庫基金</option><option>營收負責人 Sean</option></select></label></div>'
    + '<p class="hint" style="margin:0">→ Sean 實拿 <b class="f">$2,510</b>，零頭 <b class="f">$9</b> 進水庫基金</p>',
    foot("開城！", icon=I_FLAG)))

Q.append(body(13,
    head("建城完成", "主堡完工！", "水庫從 11/1 開始記帳。")
    + '<dl class="sum">'
    + "".join(f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in [("主堡", "Sean 保管 · $38,000"), ("居民", "4 位"), ("場地", "台南、高雄"), ("分帳", "拆帳 · 抽 10%")])
    + '</dl><p class="eb" style="margin-top:4px">接下來</p>'
    + f'<button type="button" class="nx"><span>加入主畫面、打開通知</span>{I_CHEV}</button>'
    + f'<button type="button" class="nx"><span>試玩一次推車</span>{I_CHEV}</button>',
    foot("去小鎮")))

Q.append(body(14,
    head("先開張", "主堡先開張了", "分帳先「不用算」，收入全部留在教室。")
    + '<div class="card"><span class="ct">還沒蓋</span><span class="cst">之後在新手任務點「繼續蓋」</span><ol class="chap">'
    + "".join(f'<li><span class="num">{i}</span><span class="ot"><b>{t}</b><small>{d}</small></span></li>'
              for i, t, d in [(2, "居民", "誰是老師、誰是助教"), (3, "場地", "在哪上課、場地費"), (4, "分帳", "老師怎麼拿錢")])
    + '</ol></div>',
    foot("繼續蓋", prev=False, handler="resume")))

PANEL_HEAD = ('<div class="ph"><div class="brand">' + ic_keep(26) + '<span>水庫建城</span></div><ol class="trk">'
              + "".join(f'<li class="cs cs{i}"><span class="bar"></span><span class="lb">{I_CHECK}{t}</span></li>'
                        for i, t in enumerate(["主堡", "居民", "場地", "分帳"], 1))
              + '</ol></div>')
PANEL = '<section class="pnl @@pcls@@" aria-label="建城問題">' + PANEL_HEAD + "".join(Q) + '</section>'


def hud(mobile):
    from gen_game import ic_coin
    bs = 44 if mobile else 64
    s = (f'<div class="hud"><div class="badge" style="width:{bs}px;height:{bs}px">{ic_keep(28 if mobile else 40)}'
         + ('' if mobile else '<span class="bl">@@badge@@</span>') + '</div>')
    pills = [(4, ic_coin(22 if mobile else 26), "#FFF3D9", "38,000", "財庫", True),
             (5, ic_hammer(20 if mobile else 24), "#EEF3F7", "60,000", "建城貸款", False),
             (8, kiwi_avatar(TB, None, "#EAF1FB", 24 if mobile else 30), "#EAF1FB", "4", "居民", True),
             (9, '<span style="display:grid;transform:scale(.8)">' + I_HOME + '</span>', "#FDEEE6", "2", "場地", True)]
    for a, ic, bg, n, l, mob in pills:
        if mobile and not mob:
            continue
        USED.add((a, LAST))
        s += f'<div class="pill pc pop v{a}_{LAST}"><span class="ic" style="background:{bg}">{ic}</span><span class="n">{n}</span><span class="l">{l}</span></div>'
    return s + '</div>'


def confetti():
    s = '<div aria-hidden="true">'
    for i in range(18):
        left = 5 + (i * 37) % 90
        c = CONFETTI_COLORS[i % len(CONFETTI_COLORS)]
        s += f'<span class="cf" style="left:{left}%;background:{c};animation-delay:{(i * 53) % 600}ms"></span>'
    return s + '</div>'


CHIP_TEXT = ["主堡預定地", "這題會蓋：主堡地基＋皇冠奇異鳥", "這題會蓋：主堡的牆＋開張旗", "這題會蓋：倉庫的箱子",
             "這題會蓋：建城貸款看板", "這題會蓋：代收人的背包", "第一塊蓋好了：主堡能收錢", "這題會蓋：小鎮居民",
             "這題會蓋：上課的地方", "這題會蓋：場地費招牌", "這題會蓋：通往主堡的路", "這題會蓋：水庫基金池",
             "最後一步：屋頂和旗子", "主堡完工！", "先開張：居民、場地、分帳之後再蓋"]

SCRIPT = """
class Component extends DCLogic {
constructor(props) {
super(props);
this.state = { stage: 0 };
}
renderVals() {
const s = this.state.stage ?? 0;
const go = (n) => () => this.setState({ stage: n });
const sc = s === 14 ? 6 : s;
const v = {};
for (let i = 0; i <= 14; i++) v['s' + i] = s === i;
const chips = CHIPS;
return {
v,
scls: 's' + sc,
pcls: 's' + sc,
chip: chips[s],
badge: s >= 13 && s !== 14 ? '完工' : '建城中',
next: go(s === 6 ? 7 : Math.min(s + 1, 13)),
prev: go(Math.max(s - 1, 0)),
stop: go(14),
resume: go(7)
};
}
}
""".replace("CHIPS", "[" + ",".join(f"'{t}'" for t in CHIP_TEXT) + "]")


def holes(s):
    import re
    return re.sub(r"@@([\w.]+)@@", r"{{ \1 }}", s)


def page(title, root_cls, inner, w, h):
    return holes(f'''<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{g.FONTS}
<style>
{CSS}
{css_pieces()}
{css_track()}
</style>
</helmet>
<div class="root {root_cls}" style="width: {w}px; height: {h}px">
{inner}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
{SCRIPT}
</script>
</body>
</html>
''')


CHIP = f'<div class="chip"><span style="display:grid">{ic_hammer(22)}</span><span>@@chip@@</span></div>'

desk_hud = hud(False)
desk = page("水庫建城（電腦）", "d",
            PANEL + f'<div class="scn @@scls@@">{scene_svg()}{desk_hud}{CHIP}{confetti()}</div>', 1280, 800)
mob_hud = hud(True)
mob_scene = scene_svg(2.2, True, "10 96 800 580", 390, 283)
mob = page("水庫建城（手機）", "m",
           f'<div class="scn @@scls@@"><div style="position:absolute;left:0;top:40px">{mob_scene}</div>{mob_hud}{CHIP}{confetti()}</div>' + PANEL,
           390, 844)

# css_pieces() 要在所有 piece() 之後才完整：重產一次
desk = page("水庫建城（電腦）", "d",
            PANEL + f'<div class="scn @@scls@@">{scene_svg()}{desk_hud}{CHIP}{confetti()}</div>', 1280, 800)
mob = page("水庫建城（手機）", "m",
           f'<div class="scn @@scls@@"><div style="position:absolute;left:0;top:40px">{mob_scene}</div>{mob_hud}{CHIP}{confetti()}</div>' + PANEL,
           390, 844)

with open(os.path.join(OUT, "Main.dc.html"), "w") as f:
    f.write(desk)
with open(os.path.join(OUT, "Mobile.dc.html"), "w") as f:
    f.write(mob)
print("wrote", OUT, len(desk), len(mob))
