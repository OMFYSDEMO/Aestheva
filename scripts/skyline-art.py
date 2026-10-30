# Draws the Trivandrum footer sketch as SVG line art. Usage: python3 scripts/skyline-art.py <out-dir>
# Hairline line-art of Trivandrum, generated as SVG paths (stroke only, no fill).
import math, sys
OUT = sys.argv[1]

def f(x): return f"{x:.1f}".rstrip('0').rstrip('.')
def P(*pts, close=False):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + (" Z" if close else "")

def gopuram(cx, ground, h=150):
    """Seven-tier east gopuram of Sree Padmanabhaswamy, with its barrel roof and finials."""
    s = h / 150.0; out = []
    bw, bh = 118*s, 34*s
    # gateway base with plinth and doorway
    out.append(P((cx-bw/2-6*s, ground), (cx+bw/2+6*s, ground)))
    out.append(P((cx-bw/2, ground), (cx-bw/2, ground-bh), (cx+bw/2, ground-bh), (cx+bw/2, ground)))
    out.append(P((cx-bw/2-3*s, ground-bh), (cx+bw/2+3*s, ground-bh)))
    dw, dh = 22*s, 26*s
    out.append(f"M{f(cx-dw/2)} {f(ground)} L{f(cx-dw/2)} {f(ground-dh+dw/2)} A{f(dw/2)} {f(dw/2)} 0 0 1 {f(cx+dw/2)} {f(ground-dh+dw/2)} L{f(cx+dw/2)} {f(ground)}")
    for k in (-1, 1):   # pilasters either side of the door
        for x in (cx + k*30*s, cx + k*46*s):
            out.append(P((x, ground-2*s), (x, ground-bh+3*s)))
    # seven tiers, each a ledge and a narrower storey, with small arched niches
    y, w = ground - bh, bw - 6*s
    tiers = 7; top_w = 50*s; th = (h*0.62)/tiers
    for i in range(tiers):
        w_next = w - (w - top_w) / (tiers - i)
        y2 = y - th
        out.append(P((cx-w/2, y), (cx-w_next/2, y2), (cx+w_next/2, y2), (cx+w/2, y)))
        out.append(P((cx-w_next/2-2.5*s, y2), (cx+w_next/2+2.5*s, y2)))   # cornice
        n = max(1, int(w_next / (16*s)))
        for j in range(n):
            nx = cx - w_next/2 + (j + .5) * w_next / n
            r = min(2.6*s, th*0.22)
            out.append(f"M{f(nx-r)} {f(y-th*0.2)} L{f(nx-r)} {f(y-th*0.55)} A{f(r)} {f(r)} 0 0 1 {f(nx+r)} {f(y-th*0.55)} L{f(nx+r)} {f(y-th*0.2)}")
        y, w = y2, w_next
    # barrel-vaulted crown (shala) and seven kalasams
    rw, rh = top_w + 10*s, 14*s
    out.append(f"M{f(cx-rw/2)} {f(y)} C{f(cx-rw/2)} {f(y-rh)} {f(cx-rw/2+6*s)} {f(y-rh)} {f(cx-rw/2+10*s)} {f(y-rh)} L{f(cx+rw/2-10*s)} {f(y-rh)} C{f(cx+rw/2-6*s)} {f(y-rh)} {f(cx+rw/2)} {f(y-rh)} {f(cx+rw/2)} {f(y)}")
    for k in (-1, 1):   # horn-like end finials of the shala
        ex = cx + k*(rw/2 - 2*s)
        out.append(f"M{f(ex)} {f(y-rh*0.6)} Q{f(ex+k*7*s)} {f(y-rh*1.1)} {f(ex+k*4*s)} {f(y-rh*1.6)}")
    for j in range(7):
        kx = cx - (rw/2 - 12*s) + j * (rw - 24*s) / 6
        ky = y - rh
        out.append(P((kx, ky), (kx, ky-7*s)))
        out.append(f"M{f(kx-2.2*s)} {f(ky-7*s)} A{f(2.2*s)} {f(2.2*s)} 0 1 1 {f(kx+2.2*s)} {f(ky-7*s)}")
        out.append(P((kx, ky-9.2*s), (kx, ky-12*s)))
    return out

def tank(cx, y, w):
    """Padmatheertham: the temple tank, as a few calm ripples."""
    return [f"M{f(cx-w/2+i*8)} {f(y+6+i*6)} q{f(w/4-i*6)} -3 {f(w/2-i*8)} 0 t{f(w/2-i*8)} 0" for i in range(3)]

def palm(x, ground, h, lean=1.0):
    out = []
    tx, ty = x + 14*lean, ground - h
    out.append(f"M{f(x)} {f(ground)} Q{f(x+2*lean)} {f(ground-h*0.55)} {f(tx)} {f(ty)}")
    for a, L, droop in ((-160, 30, 14), (-125, 26, 10), (-70, 24, 8), (-25, 30, 12), (10, 26, 16), (-195, 22, 14)):
        r = math.radians(a)
        ex, ey = tx + L*math.cos(r)*lean, ty + L*math.sin(r)
        mx, my = (tx+ex)/2, (ty+ey)/2 - 8
        out.append(f"M{f(tx)} {f(ty)} Q{f(mx)} {f(my)} {f(ex)} {f(ey+droop)}")
    out.append(f"M{f(tx-2)} {f(ty+4)} a2 2 0 1 0 4 0")   # coconuts
    return out

def napier(x, ground, s=1.0):
    """Napier Museum: long arcaded hall under tiered Kerala roofs with gabled ends and turrets."""
    out = []; W = 210*s
    out.append(P((x, ground), (x+W, ground)))
    out.append(P((x+6*s, ground), (x+6*s, ground-22*s), (x+W-6*s, ground-22*s), (x+W-6*s, ground)))
    for i in range(9):   # arcade
        ax = x + 18*s + i*21.5*s
        out.append(f"M{f(ax)} {f(ground)} L{f(ax)} {f(ground-11*s)} A{f(6*s)} {f(6*s)} 0 0 1 {f(ax+12*s)} {f(ground-11*s)} L{f(ax+12*s)} {f(ground)}")
    # lower roof with upturned eaves
    out.append(f"M{f(x-6*s)} {f(ground-20*s)} Q{f(x+4*s)} {f(ground-24*s)} {f(x+18*s)} {f(ground-34*s)} L{f(x+W-18*s)} {f(ground-34*s)} Q{f(x+W-4*s)} {f(ground-24*s)} {f(x+W+6*s)} {f(ground-20*s)}")
    # central upper roof and gable
    cx = x + W/2
    out.append(P((cx-44*s, ground-34*s), (cx-44*s, ground-44*s), (cx+44*s, ground-44*s), (cx+44*s, ground-34*s)))
    out.append(f"M{f(cx-56*s)} {f(ground-42*s)} Q{f(cx-40*s)} {f(ground-50*s)} {f(cx-16*s)} {f(ground-66*s)} L{f(cx+16*s)} {f(ground-66*s)} Q{f(cx+40*s)} {f(ground-50*s)} {f(cx+56*s)} {f(ground-42*s)}")
    out.append(P((cx-16*s, ground-66*s), (cx, ground-76*s), (cx+16*s, ground-66*s)))   # gable
    out.append(P((cx, ground-76*s), (cx, ground-82*s)))
    for k in (-1, 1):   # end towers with small pyramidal caps
        tx = cx + k*80*s
        out.append(P((tx-9*s, ground-34*s), (tx-9*s, ground-50*s), (tx+9*s, ground-50*s), (tx+9*s, ground-34*s)))
        out.append(f"M{f(tx-13*s)} {f(ground-48*s)} Q{f(tx-6*s)} {f(ground-52*s)} {f(tx)} {f(ground-62*s)} Q{f(tx+6*s)} {f(ground-52*s)} {f(tx+13*s)} {f(ground-48*s)}")
        out.append(P((tx, ground-62*s), (tx, ground-67*s)))
    return out

def lighthouse(x, ground, s=1.0):
    """Kovalam (Vizhinjam) lighthouse on its rocky headland, with a few light rays."""
    out = []
    out.append(f"M{f(x-55*s)} {f(ground)} Q{f(x-30*s)} {f(ground-6*s)} {f(x-18*s)} {f(ground-16*s)} Q{f(x)} {f(ground-24*s)} {f(x+18*s)} {f(ground-16*s)} Q{f(x+34*s)} {f(ground-6*s)} {f(x+60*s)} {f(ground)}")
    b, top, bw, tw = ground-20*s, ground-92*s, 12*s, 7*s
    out.append(P((x-bw, b), (x-tw, top), (x+tw, top), (x+bw, b)))
    for t in (0.25, 0.5, 0.75):   # painted bands
        yy = b + (top-b)*t; ww = bw + (tw-bw)*t
        out.append(P((x-ww, yy), (x+ww, yy)))
    out.append(P((x-11*s, top), (x+11*s, top)))   # gallery
    out.append(P((x-6*s, top), (x-6*s, top-10*s), (x+6*s, top-10*s), (x+6*s, top)))   # lantern
    out.append(f"M{f(x-7*s)} {f(top-10*s)} Q{f(x)} {f(top-18*s)} {f(x+7*s)} {f(top-10*s)}")
    for k in (-1, 1):
        out.append(P((x+k*12*s, top-6*s), (x+k*34*s, top-11*s)))
        out.append(P((x+k*12*s, top-3*s), (x+k*30*s, top-1*s)))
    return out

def houseboat(x, y, s=1.0):
    """Kettuvallam on the backwaters: long hull with upswept ends, arched woven roof in sections."""
    out = []; L = 120*s
    out.append(f"M{f(x)} {f(y-14*s)} Q{f(x+6*s)} {f(y+2*s)} {f(x+26*s)} {f(y+2*s)} L{f(x+L-26*s)} {f(y+2*s)} Q{f(x+L-6*s)} {f(y+2*s)} {f(x+L)} {f(y-14*s)}")
    out.append(P((x+14*s, y-4*s), (x+L-14*s, y-4*s)))   # deck line
    for i, (a0, a1) in enumerate(((24, 52), (52, 80), (80, 100))):   # roof sections
        out.append(f"M{f(x+a0*s)} {f(y-4*s)} Q{f(x+(a0+a1)/2*s)} {f(y-(22 if i==1 else 17)*s)} {f(x+a1*s)} {f(y-4*s)}")
    out.append(P((x+L*0.5, y-17*s), (x+L*0.5, y-24*s)))   # pole
    out.append(f"M{f(x-10*s)} {f(y+7*s)} q8 -2 16 0 t16 0 M{f(x+L-20*s)} {f(y+7*s)} q8 -2 16 0 t16 0")   # ripples
    return out

def technopark(x, ground, s=1.0):
    """Technopark: a few modern blocks with window grids."""
    out = []
    for bx, bw, bh in ((0, 34, 64), (40, 26, 46), (72, 44, 78), (122, 30, 40)):
        X, W, H = x+bx*s, bw*s, bh*s
        out.append(P((X, ground), (X, ground-H), (X+W, ground-H), (X+W, ground)))
        for r in range(1, int(H/(9*s))):
            out.append(P((X+3*s, ground-r*9*s), (X+W-3*s, ground-r*9*s)))
    return out

def waves(x0, x1, y, amp=2.5, step=26):
    d = f"M{f(x0)} {f(y)}"; x = x0
    while x < x1:
        d += f" q{f(step/4)} {f(-amp)} {f(step/2)} 0 t{f(step/2)} 0"; x += step
    return [d]

def svg(paths, w, h, stroke=1.1):
    body = "".join(f'<path d="{p}"/>' for p in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="none" stroke="currentColor" '
            f'stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{body}</svg>')

# Version 1: the gopuram alone, over its tank
v1 = gopuram(150, 168, 160) + tank(150, 168, 230) + palm(28, 168, 70, 1) + palm(272, 168, 64, -1)
open(f"{OUT}/gopuram.svg", "w").write(svg(v1, 300, 192))

# Version 2: the city line, with the gopuram at the centre
G = 176
v2 = []
v2 += waves(0, 140, G+8) + lighthouse(70, G, 1.0)
v2 += palm(150, G, 66, 1) + palm(172, G, 52, 1)
v2 += houseboat(186, G-3, 0.95)
v2 += palm(310, G, 60, -1)
v2 += napier(340, G, 1.0)
v2 += palm(575, G, 72, 1)
v2 += gopuram(700, G, 166) + tank(700, G, 260)
v2 += palm(822, G, 70, -1) + palm(846, G, 56, -1)
v2 += waves(860, 1040, G+8)
v2 += technopark(1060, G, 1.0)
v2 += palm(1238, G, 58, -1)
v2 += [P((0, G), (60, G)), P((290, G), (340, G)), P((556, G), (600, G)), P((800, G), (860, G)), P((1040, G), (1260, G))]
open(f"{OUT}/skyline.svg", "w").write(svg(v2, 1260, 200))
print("ok", len(open(f"{OUT}/gopuram.svg").read()), len(open(f"{OUT}/skyline.svg").read()))
