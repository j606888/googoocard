#!/usr/bin/env python3
"""建城流程（水庫第一次使用）設計稿。沿用 gen_game.py／gen_mobile.py 的場景，依建城進度拿掉或加上物件。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_game as g  # noqa: E402
import gen_mobile as gm  # noqa: E402  （匯入時會順便重產桌機版和手機版）
from gen_game import (P, box, fl, fr, kiwi, crate, iso_group, bubble, coin, nametag, ic_coin, ic_keep, ic_cart,  # noqa: E402
                      ic_hammer, kiwi_avatar, IC_HELP, IC_MAIL, CSS, FONTS, DEFS, INK, SUB, GROUND, STONE, WOOD, OUT, PREV)

SEAN = "#E58B7A"
DD = "#4BB38B"


# ---------- 把原本的場景拆成類別 ----------
def classify(svg):
    if "M4.5 -27" in svg:
        return "boss"
    if "#A6D8CE" in svg:
        return "keep"
    if "#F8DCC8" in svg or "#FBE7D8" in svg or "#FFE7A3" in svg:
        return "wall"
    if "#D9A452" in svg:
        return "crate"
    if 'class="puff"' in svg:
        return "teacherB"
    if "#6FA8DC" in svg:
        return "cart"
    if "#F2B35B" in svg:
        return "dd"
    return "base"


def split(sprites):
    out = {}
    for key, svg in sprites:
        out.setdefault(classify(svg), []).append((key, svg))
    return out


DESK = dict(parts=split(g.sprites), O=(680, 40), keep=(11.4, 2.4, 2, 2), yard=(11, 18.8, 2, 8.6), gate=13.55,
            boss=(12.4, 5.05), dd=(9.25, 16.75), cls=(20.9, 9.9), flat=g.FLAT, W=1280, H=800, k=1.0)
MOB = dict(parts=split(gm.ms), O=(150, 310), keep=(3.2, 0.2, 1.8, 1.8), yard=(3, 9, 0, 5.2), gate=7.55,
           boss=(3.9, 2.8), dd=(18.9, 15.2), cls=(11.0, 5.3), flat=gm.FLAT_M, W=gm.VW, H=gm.VH, k=gm.K)


def at(L):
    g.OX, g.OY = L["O"]


def scaffold(L):
    """主堡預定地：地基、木架、一疊木板、圍牆虛線。"""
    at(L)
    kx, ky, kw, kd = L["keep"]
    x0, x1, y0, y1 = L["yard"]
    s = iso_group(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" rx=".3" fill="none" stroke="#B98858" stroke-width=".07" stroke-dasharray=".35 .25"/>')
    s += box(kx - .1, ky - .1, kw + .2, kd + .2, 8, STONE)
    t = .16
    posts = [(kx, ky), (kx, ky + kd - t), (kx + kw - t, ky), (kx + kw - t, ky + kd - t)]
    for px, py in posts[:3]:
        s += box(px, py, t, t, 60, WOOD, 8)
    s += fl(kx, kx + kw, ky + kd - t, 36, 42, WOOD[1]) + fr(ky, ky + kd, kx + kw - t, 36, 42, WOOD[2])
    s += fl(kx, kx + kw, ky + kd - t, 62, 68, WOOD[1]) + fr(ky, ky + kd, kx + kw - t, 62, 68, WOOD[2])
    s += box(*posts[3], t, t, 60, WOOD, 8)
    s += box(kx + kw + .5, ky + kd + .4, 1.1, .45, 5, WOOD) + box(kx + kw + .55, ky + kd + .45, 1.0, .4, 5, WOOD, 5)
    return [(kx + ky + kw, s)]


def scene(L, stage, extra_over="", label="", practice_cart=False, crates=38):
    """stage 0＝空地；1 主堡＋Sean；2 開張旗；3 箱子；4 建城貸款牌；5 丁丁背包；6 預付場租（目前不用）。"""
    at(L)
    p = L["parts"]
    spr = list(p["base"])
    over = []
    k = L["k"]

    def ks(svg, ax, ay):
        return gm.ks(svg, ax, ay, k) if k != 1 else svg

    if stage == 0:
        spr += scaffold(L)
        kx, ky, kw, kd = L["keep"]
        sp = P(kx + kw / 2, ky + kd / 2, 96)
        inner = (f'<g transform="translate(10 8)">{ic_hammer(22)}</g>'
                 f'<text x="40" y="24" font-size="14" font-weight="700" fill="{INK}">主堡預定地</text>')
        over.append(ks(bubble(sp[0], sp[1], 128, 36, inner), sp[0], sp[1]))
    else:
        spr += p["wall"] + p["keep"] + p["boss"]
        bx, by = P(*L["boss"])
        over.append(ks(nametag(bx, by + 8, "Sean"), bx, by))
    if stage >= 2:
        gp = P(L["gate"], L["yard"][3], 46)
        inner = ('<path d="M12 8v20" stroke="#6B5D50" stroke-width="2" stroke-linecap="round"/><path d="M13 8h14l-4 5 4 5H13z" fill="#4BB38B"/>'
                 f'<text x="34" y="23" font-size="13" font-weight="700" fill="{INK}">10/30 開張</text>')
        over.append(ks(bubble(gp[0], gp[1], 112, 34, inner), gp[0], gp[1]))
    if stage >= 3:
        cs = p["crate"][:crates]
        spr += cs
    if stage >= 4:
        kx, ky, kw, kd = L["keep"]
        hp = P(kx - .2, ky + kd + .6, 30)
        inner = (f'<g transform="translate(9 7)">{ic_hammer(20)}</g><text x="34" y="22" font-size="12.5" font-weight="700" fill="{INK}">建城貸款</text>'
                 '<rect x="96" y="12" width="40" height="8" rx="4" fill="#E7EFD8"/><text x="142" y="21" font-size="11" font-weight="700" fill="#4E9A2F">0%</text>')
        over.append(ks(bubble(hp[0], hp[1], 160, 32, inner), hp[0], hp[1]))
    if stage >= 5:
        spr += p["dd"]
        dx, dy = P(*L["dd"])
        over.append(ks(nametag(dx, dy + 8, "丁丁") + bubble(dx + 2, dy - 46, 112, 34, coin(20, 17) + f'<text x="36" y="23.5" font-size="18" font-weight="600" fill="{INK}">$3,200</text>'), dx, dy))
    if stage >= 6:
        cp = P(*L["cls"], 60)
        inner = ('<rect x="10" y="9" width="22" height="15" rx="3" fill="#86BBD8"/><path d="M14 13h14M14 17h9" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>'
                 f'<text x="38" y="22" font-size="12.5" font-weight="700" fill="{INK}">場租還有 7 堂</text>')
        over.append(ks(bubble(cp[0], cp[1], 132, 32, inner), cp[0], cp[1]))
    if practice_cart:
        spr += p["cart"]
        cb = P(8.4, 5.95, 44) if L is MOB else P(13.5, 9.75, 44)
        inner = ('<circle cx="20" cy="18" r="11" fill="#E3F7F0"/>' + kiwi(17, 27, .5, DD)
                 + f'<text x="38" y="23" font-size="13" font-weight="700" fill="{INK}">丁丁</text>'
                 + f'<text x="70" y="24" font-size="18" font-weight="600" fill="{INK}">$1,000</text>'
                 + '<rect x="26" y="33" width="44" height="17" rx="8.5" fill="#EAE4F6"/><text x="48" y="45.5" font-size="11" font-weight="700" text-anchor="middle" fill="#6B55A8">練習</text>')
        o = bubble(cb[0], cb[1], 136, 56, inner)
        o += f'<g transform="translate({cb[0] + 62:.1f} {cb[1] - 64:.1f})"><g class="bob"><circle r="13" fill="#F4A23C" stroke="#FFFDF7" stroke-width="3"/><text y="6.5" font-size="18" font-weight="700" text-anchor="middle" fill="#FFFFFF">!</text></g></g>'
        over.append(ks(o, cb[0], cb[1]))
    if L is MOB:
        s1, s2 = P(12.9, 13.6), P(10.9, 1.3)
        over.append(gm.ks(gm.sign(s1[0], s1[1], "台南"), *s1) + gm.ks(gm.sign(s2[0], s2[1], "高雄"), *s2))
    spr.sort(key=lambda s: s[0])
    body = "".join(s for _, s in spr)
    W, H = L["W"], L["H"]
    size = 'width="390" height="844" style="display:block;position:absolute;inset:0"' if L is MOB else f'width="{W}" height="{H}" style="display:block"'
    return (f'<svg viewBox="0 0 {W} {H}" {size} role="img" aria-label="{label}">'
            f'{DEFS}<rect width="{W}" height="{H}" fill="{GROUND}"/>{L["flat"]}{body}{"".join(over)}{extra_over}</svg>')


# ---------- 共用 HTML ----------
OCSS = """
.qcard{position:absolute;left:24px;top:112px;width:404px;background:#FFFDF7;border-radius:28px;box-shadow:0 6px 0 rgba(77,66,57,.10),0 20px 50px rgba(64,54,46,.22);padding:22px 24px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}
.qnum{display:flex;align-items:center;justify-content:space-between;font-size:12.5px;font-weight:700;color:#8C7B6B}
.dots{display:flex;gap:5px}.dots i{width:22px;height:7px;border-radius:4px;background:#EADFCB}.dots i.on{background:#4BB38B}.dots i.now{background:#F4A23C}
.qt{font-size:23px;font-weight:900;line-height:1.3;margin:0}
.qd{font-size:13.5px;line-height:1.65;color:#6F6155;margin:0}
.dinp{height:52px;border-radius:16px;border:2px solid #4BB38B;background:#FFFFFF;display:flex;align-items:center;gap:8px;padding:0 14px;font:600 24px Fredoka,'Noto Sans TC',sans-serif;color:#4D4239;box-shadow:0 0 0 4px #E3F7F0}
.dinp.off{border-color:#EADFCB;box-shadow:none;font-size:17px}
.flbl{font-size:12.5px;font-weight:700;margin-bottom:-6px}
.hint{display:flex;gap:8px;align-items:flex-start;background:#F6F1E6;border-radius:14px;padding:10px 12px;font-size:12.5px;line-height:1.6;color:#6F6155}
.btns{display:flex;gap:10px;margin-top:4px}
.bp{flex:1;height:48px;border-radius:16px;border:0;background:#4BB38B;color:#FFFFFF;font:inherit;font-size:15px;font-weight:700;box-shadow:0 3px 0 #2B8E6E;cursor:pointer}
.bs{height:48px;padding:0 18px;border-radius:16px;border:2px solid #EADFCB;background:#FFFDF7;color:#4D4239;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.mem{display:flex;align-items:center;gap:10px;border:2px solid #EADFCB;border-radius:16px;padding:6px 12px 6px 6px;background:#FFFFFF;min-height:44px}
.mem.on{border-color:#4BB38B;background:#E3F7F0}
.mem .nm{flex:1;font-size:14.5px;font-weight:700}.mem .rl{font-size:11.5px;color:#8C7B6B;font-weight:500}
.radio{width:20px;height:20px;border-radius:50%;border:2px solid #D8CDBB;flex:none}.radio.on{border:6px solid #4BB38B}
.quest{display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:700;padding:7px 0}
.quest .ck{width:24px;height:24px;border-radius:50%;flex:none;display:grid;place-items:center;font:700 12px Fredoka,sans-serif}
.quest.done{color:#8C7B6B;text-decoration:line-through;text-decoration-color:#CDBFA8}
.quest .ck.d{background:#86C64F;color:#FFFFFF}.quest .ck.t{background:#FFFFFF;border:2px solid #D8CDBB;color:#8C7B6B}.quest .ck.n{background:#F4A23C;color:#FFFFFF}
.rolechip{font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap}
.boardb{font-family:'Noto Sans TC',system-ui,sans-serif;color:#4D4239;background:#EFE9DC;padding:34px 36px 40px}
.boardb h1{margin:0;font-size:26px;font-weight:900}
.boardb .lead{margin:6px 0 0;font-size:14px;color:#8C7B6B;line-height:1.6;max-width:1100px}
.mini-card{background:#FFFDF7;border-radius:22px;overflow:hidden;box-shadow:0 4px 0 rgba(77,66,57,.08),0 10px 24px rgba(77,66,57,.10);display:flex;flex-direction:column}
.mini-card .tx{padding:12px 16px 16px;display:flex;flex-direction:column;gap:6px}
.grow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#2B8E6E;background:#E3F7F0;border-radius:999px;padding:3px 10px;align-self:flex-start}
.rcard{background:#FFFDF7;border-radius:22px;padding:16px 18px;display:flex;flex-direction:column;gap:4px;box-shadow:0 4px 0 rgba(77,66,57,.08)}
"""


def dots(n, total=5):
    return '<div class="dots">' + "".join(f'<i class="{"on" if i < n - 1 else "now" if i == n - 1 else ""}"></i>' for i in range(total)) + "</div>"


def qcard(n, title, desc, body, nxt="下一步", top=112):
    return (f'<div class="qcard" role="dialog" aria-label="建城第 {n} 題" style="top:{top}px">'
            f'<div class="qnum"><span>建城 · 第 {n} 題，共 5 題</span>{dots(n)}</div>'
            f'<h2 class="qt">{title}</h2><p class="qd">{desc}</p>{body}'
            f'<div class="btns"><button class="bs">上一步</button><button class="bp">{nxt}</button></div></div>')


def badge(month="建城中"):
    return ('<div style="position:absolute;left:16px;top:12px;width:82px;height:82px;border-radius:50%;background:linear-gradient(#BFE6E3,#E7F4E6);border:4px solid #FFFDF7;box-shadow:0 4px 14px rgba(77,66,57,.16);display:grid;place-items:center">'
            + ic_keep(50) +
            f'<span style="position:absolute;left:-10px;bottom:-4px;background:#F4A23C;color:#FFFFFF;font-weight:700;font-size:11.5px;border-radius:999px;padding:3px 8px;border:3px solid #FFFDF7;white-space:nowrap">{month}</span></div>')


def pill(icon, num, label, bg="#FFF3D9", dim=False, color=INK):
    op = "opacity:.55;" if dim else ""
    return (f'<div class="pill" style="{op}"><span class="ic" style="background:{bg}">{icon}</span>'
            f'<span class="n" style="color:{color}">{num}</span><span class="l">{label}</span></div>')


TOPRIGHT = f'''<div style="position:absolute;right:16px;top:16px;display:flex;gap:8px">
<button class="sq" aria-label="說明">{IC_HELP}</button></div>'''

LOCK = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="5.5" rx="1.5" fill="#B9AA95"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="#B9AA95" stroke-width="1.5" fill="none"/></svg>'


def quest(text, state, sub=""):
    mark = {"d": "✓", "n": "!", "t": ""}[state]
    cls = "quest done" if state == "d" else "quest"
    s = f'<div style="font-size:11.5px;font-weight:500;color:#8C7B6B;text-decoration:none">{sub}</div>' if sub else ""
    return f'<div class="{cls}"><span class="ck {state}">{mark}</span><div style="flex:1">{text}{s}</div></div>'


# ---------- A：第一次打開（空地） ----------
QUESTS_SETUP = [("誰保管公司的錢", "營收負責人"), ("從哪天開始記帳", "啟用日"), ("大水庫現在有多少錢", "期初餘額"),
                ("你自己放了多少錢進來", "選填，可以略過"), ("誰手上還有沒交的錢", "期初代收")]

EMPTY_CARD = ('<div class="qcard" style="top:112px;width:360px">'
              '<div style="display:flex;align-items:center;gap:12px">'
              f'<div style="width:52px;height:52px;border-radius:16px;background:#FFF1DE;display:grid;place-items:center;flex:none">{ic_hammer(32)}</div>'
              '<div><div style="font-size:20px;font-weight:900">建城任務</div><div style="font-size:12.5px;color:#8C7B6B">5 題，大約 10 分鐘</div></div></div>'
              '<p class="qd">這裡會變成公司的錢的小鎮。先回答幾個問題，主堡就會一塊一塊蓋起來。</p>'
              '<div style="display:flex;flex-direction:column;border-top:2px dashed #EADFCB;padding-top:6px">'
              + "".join(f'<div class="quest"><span class="ck t">{i + 1}</span><div style="flex:1">{t}<div style="font-size:11.5px;font-weight:500;color:#8C7B6B">{s}</div></div></div>' for i, (t, s) in enumerate(QUESTS_SETUP))
              + '</div>'
              '<div class="hint">' + ic_coin(18) + '<span>先準備：Excel「大水庫結餘」最後的數字、存摺餘額、手上的現金。</span></div>'
              '<div class="btns"><button class="bp">開始建城</button></div></div>')

HUD_EMPTY = (badge() + '<div style="position:absolute;left:110px;top:16px;display:flex;gap:10px;align-items:center">'
             + pill(ic_coin(), "—", "公司的錢", dim=True) + pill(ic_keep(), "—", "主堡財庫", "#E3F7F0", dim=True)
             + '<span style="font-size:12.5px;color:#4D4239;font-weight:700;background:rgba(255,253,247,.9);border-radius:999px;padding:6px 12px">建好主堡後出現</span></div>' + TOPRIGHT)

CAP_EMPTY = ("Sean（營收負責人）第一次打開水庫：還沒建城，地圖上只有台南丁丁家、高雄教室這些「地方」，主堡是一塊預定地（地基＋木架＋圍牆虛線）。"
             "左邊是建城任務，5 題一題一題答；HUD 先灰掉。建議第一次在電腦上做，旁邊有人陪。")

# ---------- B：第 3 題（大水庫現在有多少錢） ----------
STEP3 = qcard(3, "大水庫現在有多少錢？",
              "10/30 這天，公司的錢有多少——現金加銀行，一個數就好。",
              '<div class="flbl">現金＋銀行</div><div class="dinp">$ 38,000</div>'
              '<div class="hint">' + ic_keep(18) + '<span>可以先抄 Excel「大水庫結餘」最後的累計數，再跟存摺、手上的現金對一下。<b>學生已經付、還沒上的堂數不用另外填</b>，系統會從課卡算。</span></div>')

HUD_STEP3 = (badge() + '<div style="position:absolute;left:110px;top:16px;display:flex;gap:10px;align-items:center">'
             + pill(ic_coin(), "38,000", "公司的錢") + pill(ic_keep(), "38,000", "主堡財庫", "#E3F7F0")
             + '</div>' + TOPRIGHT)

at(DESK)
cp_ = P(16.2, 4.4, 92)
CRATE_POP = bubble(cp_[0], cp_[1], 176, 36, f'<g transform="translate(10 7)">{g.ic_crate(*g.CRATE, 22)}</g>'
                   f'<text x="40" y="24" font-size="14" font-weight="700" fill="{INK}">+38 箱 = $38,000</text>')

CAP_STEP3 = ("每答一題，小鎮就長出一塊（第 3 題：箱子堆進倉庫，1 箱 ≈ $1,000）。前兩題已經讓主堡蓋好、Sean 戴上皇冠、門口掛上「10/30 開張」。"
             "HUD 跟著出現真的數字。問題卡固定在左邊，地圖只是跟著長，不用操作。")

# ---------- C：5 題總覽 ----------
STEP_INFO = [
    (1, "誰保管公司的錢？", "選一位成員當營收負責人。只有他能確認繳回、記大水庫支出，推播也發給他。", "主堡蓋好，戴皇冠的 Sean 走進去",
     '<div class="mem on"><span class="radio on"></span>' + kiwi_avatar(SEAN, "crown", bg="#FFF6D8", s=32) + '<div class="nm">Sean <span class="rl">老師</span></div></div>'
     '<div class="mem"><span class="radio"></span>' + kiwi_avatar(DD, s=32) + '<div class="nm">丁丁 <span class="rl">擁有者</span></div></div>'),
    (2, "從哪天開始記帳？", "預設今天。這天之後的課卡收款、支出、薪資都走系統；之前的留在 Excel。", "門口掛上「10/30 開張」",
     '<div class="dinp off">10/30（今天）</div>'),
    (3, "大水庫現在有多少錢？", "現金＋銀行一個數。預收不用填，系統從課卡算。", "箱子堆進倉庫（38 箱）",
     '<div class="dinp off">$ 38,000</div>'),
    (4, "你自己放了多少錢進來？", "選填。前期投入、自己補的錢，都算借給公司，只記帳、不排還款。略過的話不顯示建城貸款，之後在水庫設定補。", "建城貸款牌＋回本進度條（略過就沒有）",
     '<div class="dinp off">$ 120,000</div><div style="display:flex;justify-content:flex-end"><button class="bs" style="height:44px">略過這題</button></div>'),
    (5, "現在誰手上還有沒交的錢？", "10/30 之前收的、還沒交給 Sean 的課卡錢，每人一個數。", "丁丁背上背包，泡泡 $3,200",
     '<div class="mem">' + kiwi_avatar(DD, "pack", s=32) + '<div class="nm">丁丁</div><span class="f" style="font-weight:600">$3,200</span></div>'),
]


def step_card(n, title, desc, grow, field):
    sc = scene(DESK, n, label=f"建城第 {n} 題完成後的小鎮").replace(f'width="{DESK["W"]}" height="{DESK["H"]}" style="display:block"',
                                                                  'width="100%" style="display:block;aspect-ratio:16/10"', 1)
    return (f'<div class="mini-card">{sc}<div class="tx"><div class="qnum"><span>第 {n} 題</span>{dots(n)}</div>'
            f'<div style="font-size:17px;font-weight:900">{title}</div><p class="qd" style="font-size:12.5px">{desc}</p>{field}'
            f'<span class="grow">小鎮長出：{grow}</span></div></div>')


STEPS_BOARD = ('<div class="boardb"><h1>建城 5 題：每一題，小鎮長出一塊</h1>'
               '<p class="lead">一題一畫面，問題卡在左、地圖在右跟著長（電腦版見上一張）。第 1、2、3 題必填；第 4 題（自己放了多少錢）選填，略過就不顯示建城貸款；第 5 題可以略過。都可以之後在水庫設定補。期初數字之後可以改，但要寫原因、留紀錄；第一筆繳回確認之前，啟用日也可以改（＝重新開帳）。</p>'
               '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:24px">'
               + "".join(step_card(*s) for s in STEP_INFO) + '</div></div>')

# ---------- D：在 Sean 手機上收尾 ----------
DIM = '<div style="position:absolute;inset:0;background:rgba(64,54,46,.36);z-index:3"></div>'


def m_hud(company="41,200", keep="38,000", road="3,200"):
    return f'''<div style="position:absolute;left:12px;right:12px;top:50px;display:flex;align-items:center;gap:8px;z-index:3">
<div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(#BFE6E3,#E7F4E6);border:3px solid #FFFDF7;box-shadow:0 3px 10px rgba(77,66,57,.16);display:grid;place-items:center;flex:none">{ic_keep(28)}</div>
<div class="pill" style="flex:1;height:44px"><span class="ic">{ic_coin()}</span><span class="n">{company}</span><span class="l">公司的錢</span></div>
<button class="sq" aria-label="通知" style="width:44px;height:44px;flex:none">{IC_MAIL}</button>
</div>
<div style="position:absolute;left:12px;right:12px;top:102px;display:flex;gap:6px;z-index:3">
{gm.mini(ic_keep(20), "財庫", keep)}{gm.mini(ic_cart(20), "路上", road, "#C2700F")}{gm.mini(ic_hammer(18), "回本", "0%", "#4E9A2F")}
</div>'''


SHARE = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="#2F7FD6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
PLUSBOX = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="#4D4239" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="#4D4239" stroke-width="2" stroke-linecap="round"/></svg>'
BELL = '<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 1 6 6v4l2 3H4l2-3V9a6 6 0 0 1 6-6z" fill="#F6C344"/><circle cx="12" cy="19" r="2.2" fill="#E2A62C"/><circle cx="18" cy="5" r="3.4" fill="#E8735F"/></svg>'


def step_row(n, icon, text):
    return (f'<div style="display:flex;align-items:center;gap:12px;background:#F6F1E6;border-radius:16px;padding:10px 12px">'
            f'<span style="width:26px;height:26px;border-radius:50%;background:#4D4239;color:#FFF;font:700 13px/26px Fredoka;text-align:center;flex:none">{n}</span>'
            f'<span style="flex:1;font-size:14px;font-weight:700">{text}</span>{icon}</div>')


MS_FULL = scene(MOB, 5, label="建好的手機版小鎮")
SHEET_HOME = f'''<div class="sheet" style="gap:12px"><div class="handle"></div>
<div style="font-size:19px;font-weight:900">先把水庫放到主畫面</div>
<p class="qd" style="font-size:13px">從主畫面打開，才收得到「有人送錢來」的通知。只要做一次。</p>
{step_row(1, SHARE, "點下面的「分享」")}
{step_row(2, PLUSBOX, "選「加入主畫面」")}
{step_row(3, '<span style="width:28px;height:28px;border-radius:8px;background:linear-gradient(#BFE6E3,#E7F4E6);display:grid;place-items:center">' + ic_keep(20) + '</span>', "從主畫面的圖示打開")}
<div class="hint" style="font-size:12px">偵測到不是從主畫面打開（不是 standalone）才出現；Android 換成 Chrome 的步驟。</div>
</div>'''
SHEET_PUSH = f'''<div class="sheet" style="gap:12px;align-items:stretch"><div class="handle"></div>
<div style="display:flex;justify-content:center;padding-top:6px"><div style="width:72px;height:72px;border-radius:24px;background:#FFF6D8;display:grid;place-items:center">{BELL}</div></div>
<div style="font-size:19px;font-weight:900;text-align:center">有人送錢來時通知你</div>
<p class="qd" style="font-size:13px;text-align:center">丁丁按「送回主堡」，你的手機就會響。<br>按下去之後 iPhone 會再問一次，選「允許」。</p>
<div class="hint" style="font-size:12px">只會通知：有人送錢來、超過 3 天還沒確認。不會每筆收款都響。</div>
<button class="bp" style="flex:none">開啟通知</button>
<button class="bs" style="border:0;background:none;color:#8C7B6B">之後再說</button>
</div>'''
MS_TRIAL = scene(MOB, 5, practice_cart=True, label="練習推車停在主堡門口")
SHEET_TRIAL = f'''<div class="sheet" style="gap:10px"><div class="handle"></div>
<div style="display:flex;align-items:center;gap:8px"><span class="rolechip" style="background:#EAE4F6;color:#6B55A8">練習</span><span style="font-size:12.5px;color:#8C7B6B">不會記進帳裡</span></div>
<div style="display:flex;align-items:center;gap:12px">
<div style="position:relative;flex:none">{kiwi_avatar("#6FA8DC", "cap", bg="#FFFFFF", s=46)}<span style="position:absolute;right:-4px;top:-4px;width:20px;height:20px;border-radius:50%;background:#F4A23C;color:#FFF;font:700 13px/20px Fredoka;text-align:center;border:2px solid #FFFDF7">!</span></div>
<div style="flex:1"><div style="font-size:16px;font-weight:900">丁丁送來 <span class="f" style="font-size:19px">$1,000</span></div><div style="font-size:12.5px;color:#B86A12">現金 · 剛剛 · 等你確認</div></div></div>
<p class="qd" style="font-size:13px">之後每次有人送錢來，都在這裡按。錢真的拿到了就按「收到了」，金額對不上就按「金額不對」，寫原因退回去。</p>
<div class="btns" style="margin:0"><button class="bp">收到了</button><button class="bs">金額不對</button></div>
</div>'''


def col(n, title, ph, cap):
    return (f'<div class="col"><div class="vh"><span class="verdict" style="background:#FFFDF7;color:#4D4239">{n}</span>{title}</div>'
            f'{ph}<p class="cap">{cap}</p></div>')


TRIAL_BOARD = f'''<div class="board">
<div style="max-width:1206px;margin:0 auto;padding:0 6px"><h1>建城收尾：換到 Sean 的手機</h1>
<p class="lead">5 題在電腦上答完後，畫面跳出 QR code「用手機繼續」。Sean 用手機掃，接著做三件事。之後他每天做的就是這件事：手機響、打開、按「收到了」。</p></div>
<div class="row">
{col("1", "加入主畫面", gm.phone(MS_FULL + m_hud() + DIM + SHEET_HOME), "iPhone 只有從主畫面打開，才能收網頁推播。偵測到是 Safari 分頁就先教這一步；已經是從主畫面打開就直接跳過。")}
{col("2", "開啟通知", gm.phone(MS_FULL + m_hud() + DIM + SHEET_PUSH), "先講清楚會通知什麼，再請他按。iPhone 的系統詢問只會出現一次，被拒絕就要去設定裡開，所以按鈕前先說明。")}
{col("3", "試玩一次：收到了", gm.phone(MS_TRIAL + m_hud() + SHEET_TRIAL), "一台練習推車（紫色「練習」標籤）開到主堡門口，跳 ❗。按「收到了」播入庫動畫，箱子 +1，然後推車消失。練習不寫進資料庫，HUD 數字也不變。")}
</div></div>'''

# ---------- E：沒建城前的其他人＋新手任務 ----------
MS_EMPTY = scene(MOB, 0, label="主堡還是預定地")
SHEET_WAIT = f'''<div class="sheet" style="gap:12px"><div class="handle"></div>
<div style="display:flex;align-items:center;gap:12px"><div style="width:52px;height:52px;border-radius:16px;background:#FFF1DE;display:grid;place-items:center;flex:none">{ic_hammer(30)}</div>
<div><div style="font-size:19px;font-weight:900">主堡施工中</div><div style="font-size:12.5px;color:#8C7B6B">等 Sean 完成建城</div></div></div>
<p class="qd" style="font-size:13px">建好之後，你收的課卡錢會出現在你的背包，按「送回主堡」交給 Sean。</p>
<div style="font-size:13px;font-weight:900;margin-top:2px">現在可以先做</div>
{quest("把網站加入主畫面", "t", "之後才收得到通知")}
</div>'''


def quest_sheet(title, sub, items, chips):
    return (f'<div class="sheet" style="gap:4px"><div class="handle"></div>'
            f'<div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:19px;font-weight:900">{title}</div><span class="f" style="font-size:14px;font-weight:700;color:#4E9A2F">{sub}</span></div>'
            f'<div style="display:flex;gap:6px;margin:4px 0 6px">{chips}</div>'
            + "".join(quest(*it) for it in items) +
            '<div style="font-size:11.5px;color:#8C7B6B;margin-top:4px">全部完成就收掉。真的做到了才打勾，不是看過說明就算。</div></div>')


CH_BOSS = '<span class="rolechip" style="background:#FFF6D8;color:#9A6A10">營收負責人</span>'
CH_OWNER = '<span class="rolechip" style="background:#EEF3F7;color:#4D6B85">擁有者</span>'
CH_HOLD = '<span class="rolechip" style="background:#E3F7F0;color:#1B5E4A">代收人</span>'
CH_TEACH = '<span class="rolechip" style="background:#EAF1FB;color:#3F6FB0">老師</span>'

SEAN_Q = quest_sheet("新手任務", "3 / 7", [
    ("建城 5 題", "d"), ("加入主畫面、開通知", "d"), ("試玩推車", "d"),
    ("連上 Google Sheet", "n", "把 Sheet 分享給系統的 email，貼上網址"),
    ("記第一筆支出", "t", "例如丁丁的場地費"),
    ("第一次確認真的繳回", "t", "有人送錢來時會通知你"),
    ("看第一堂課的分潤", "t")], CH_BOSS + CH_TEACH)
DD_Q = quest_sheet("新手任務", "2 / 6", [
    ("開啟水庫模組", "d"), ("選營收負責人", "d"),
    ("通知大家加入主畫面", "n", "一鍵複製 LINE 訊息"),
    ("看一次我的背包", "t"),
    ("第一次送回主堡", "t", "背包有錢時按下面的推車"),
    ("確認自己是哪位老師", "t", "連到課程上的老師，才算得出分潤")], CH_OWNER + CH_HOLD + CH_TEACH)
QPILL = ('<div style="position:absolute;right:12px;top:146px;z-index:3;display:flex;align-items:center;gap:6px;background:#FFFDF7;border-radius:999px;padding:5px 12px 5px 6px;box-shadow:0 2px 0 rgba(77,66,57,.10),0 6px 16px rgba(77,66,57,.12);font-size:12px;font-weight:700">'
         '<span style="width:22px;height:22px;border-radius:50%;background:#F4A23C;color:#FFF;font:700 12px/22px Fredoka;text-align:center">!</span>新手任務</div>')

ROLES = [
    (CH_OWNER, "擁有者（丁丁）", "開啟水庫模組 → 選營收負責人 → 通知大家加入主畫面"),
    (CH_BOSS, "營收負責人（Sean）", "建城 → 加入主畫面、開通知 → 試玩推車 → 連上 Google Sheet → 記第一筆支出 → 第一次確認真的繳回"),
    (CH_HOLD, "代收人", "加入主畫面、開通知 → 看一次我的背包 → 第一次送回主堡"),
    (CH_TEACH, "老師", "確認自己是哪位老師 → 看第一堂課的分潤（第二步上線後才出現）"),
]
ROLE_GRID = ('<div style="max-width:1206px;margin:28px auto 0;padding:0 6px"><div style="font-size:16px;font-weight:900;margin-bottom:10px">各角色的新手任務（一個人有好幾個角色就合併、去重）</div>'
             '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'
             + "".join(f'<div class="rcard">{c}<div style="font-size:15px;font-weight:900;margin-top:4px">{t}</div><p class="qd" style="font-size:12.5px">{d}</p></div>' for c, t, d in ROLES)
             + '</div></div>')

QUEST_BOARD = f'''<div class="board">
<div style="max-width:1206px;margin:0 auto;padding:0 6px"><h1>建城之前的其他人，和建城之後的新手任務</h1>
<p class="lead">建城之前，其他人打開水庫只看到施工中。建城之後，每個人右上角有「新手任務」，點開是依角色合併的清單；全部完成就收掉。</p></div>
<div class="row">
{col("1", "丁丁：建城之前", gm.phone(MS_EMPTY + DIM + SHEET_WAIT), "主堡是預定地，HUD 不出現，背包、推車按鈕都沒有。唯一能做的是先加入主畫面。")}
{col("2", "Sean：建城之後", gm.phone(MS_FULL + m_hud() + QPILL + DIM + SEAN_Q), "營收負責人＋老師兩個角色合併。下一個要做的（橘色 !）是連 Google Sheet。")}
{col("3", "丁丁：建城之後", gm.phone(MS_FULL + m_hud() + QPILL + DIM + DD_Q), "擁有者＋代收人＋老師。「通知大家加入主畫面」提供一段 LINE 訊息，複製貼到群組。")}
</div>{ROLE_GRID}</div>'''


# ---------- 輸出 ----------
def write(fname, title, body, height):
    css = CSS + gm.MCSS + OCSS
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


def stage_page(svg, hud, caption):
    return (f'<div class="stage">{svg}{hud}</div>'
            f'<p style="margin:0;padding:14px 22px 18px;font-family:\'Noto Sans TC\',sans-serif;font-size:13px;line-height:1.6;color:#8C7B6B;max-width:1180px">{caption}</p>')


write("BuildEmpty.dc.html", "建城：第一次打開", stage_page(scene(DESK, 0, label="還沒建城的小鎮：主堡是預定地"), HUD_EMPTY + EMPTY_CARD, CAP_EMPTY), 860)
write("BuildStep.dc.html", "建城：第 3 題", stage_page(scene(DESK, 3, extra_over=CRATE_POP, label="主堡蓋好、箱子堆進倉庫"), HUD_STEP3 + STEP3, CAP_STEP3), 860)
write("BuildSteps.dc.html", "建城 5 題總覽", STEPS_BOARD, 1180)
write("BuildTrial.dc.html", "建城收尾：手機", TRIAL_BOARD, 1150)
write("BuildQuests.dc.html", "新手任務", QUEST_BOARD, 1380)
print("onboard ok")
