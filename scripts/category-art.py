# Draws one hairline band per service category, shown at the top of that category's pages (search, price guides and the
# business page for that trade). Same style as the city footers: stroke only, no fill, currentColor.
# Usage: python3 scripts/category-art.py <out-dir>   -> <out-dir>/<category>.svg, 1260 x 140
import math, sys

W, H, G = 1260, 140, 132          # band size and the ground line the objects stand on

def f(x): return f"{x:.1f}".rstrip('0').rstrip('.')
def P(*pts, close=False):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + (" Z" if close else "")
def circle(cx, cy, r): return f"M{f(cx-r)} {f(cy)} a{f(r)} {f(r)} 0 1 0 {f(2*r)} 0 a{f(r)} {f(r)} 0 1 0 {f(-2*r)} 0"
def ellipse(cx, cy, rx, ry): return f"M{f(cx-rx)} {f(cy)} a{f(rx)} {f(ry)} 0 1 0 {f(2*rx)} 0 a{f(rx)} {f(ry)} 0 1 0 {f(-2*rx)} 0"
def oval(cx, cy, rx, ry, deg):
    """An ellipse rotated by deg."""
    a = math.radians(deg); dx, dy = rx*math.cos(a), rx*math.sin(a)
    return f"M{f(cx-dx)} {f(cy-dy)} A{f(rx)} {f(ry)} {f(deg)} 1 0 {f(cx+dx)} {f(cy+dy)} A{f(rx)} {f(ry)} {f(deg)} 1 0 {f(cx-dx)} {f(cy-dy)}"
def rrect(x, y, w, h, r):
    return (f"M{f(x+r)} {f(y)} L{f(x+w-r)} {f(y)} Q{f(x+w)} {f(y)} {f(x+w)} {f(y+r)} L{f(x+w)} {f(y+h-r)} Q{f(x+w)} {f(y+h)} {f(x+w-r)} {f(y+h)}"
            f" L{f(x+r)} {f(y+h)} Q{f(x)} {f(y+h)} {f(x)} {f(y+h-r)} L{f(x)} {f(y+r)} Q{f(x)} {f(y)} {f(x+r)} {f(y)} Z")
def sparkle(x, y, r=6):
    return [f"M{f(x)} {f(y-r)} Q{f(x)} {f(y)} {f(x+r)} {f(y)} Q{f(x)} {f(y)} {f(x)} {f(y+r)} Q{f(x)} {f(y)} {f(x-r)} {f(y)} Q{f(x)} {f(y)} {f(x)} {f(y-r)}"]
def leaf(x, y, L, ang, w=0.38):
    """A simple leaf from (x, y), length L, pointing at ang degrees (0 = up), with its midrib."""
    a = math.radians(ang); ux, uy = math.sin(a), -math.cos(a); vx, vy = -uy, ux
    tip = (x + ux*L, y + uy*L)
    c1 = (x + ux*L*0.5 + vx*L*w, y + uy*L*0.5 + vy*L*w); c2 = (x + ux*L*0.5 - vx*L*w, y + uy*L*0.5 - vy*L*w)
    return [f"M{f(x)} {f(y)} Q{f(c1[0])} {f(c1[1])} {f(tip[0])} {f(tip[1])} Q{f(c2[0])} {f(c2[1])} {f(x)} {f(y)}", P((x, y), (x + ux*L*0.8, y + uy*L*0.8))]
def sprig(x, ground, h, lean=0, n=3):
    """A stem with leaves in pairs, for filling gaps."""
    out = [f"M{f(x)} {f(ground)} Q{f(x+lean*0.4)} {f(ground-h*0.5)} {f(x+lean)} {f(ground-h)}"]
    for i in range(n):
        t = 0.35 + 0.28*i; px, py = x + lean*t*t, ground - h*t
        out += leaf(px, py, 14 - i*2, -50 + lean*0.4) + leaf(px, py, 14 - i*2, 50 + lean*0.4)
    out += leaf(x + lean, ground - h, 12, lean*0.5)
    return out

def svg(paths, w=W, h=H, stroke=1.1):
    body = "".join(f'<path d="{p}"/>' for p in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="none" stroke="currentColor" '
            f'stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{body}</svg>')

# ---------------------------------------------------------------- Nails, lashes & brows

def tip(cx, cy, ang, L=34, Wd=15, pat=0):
    """One almond nail tip, base at (cx, cy), pointing along ang (0 = up), with a design on it."""
    a = math.radians(ang); ux, uy = math.sin(a), -math.cos(a); vx, vy = -uy, ux
    pt = lambda u, v: (cx + ux*u + vx*v, cy + uy*u + vy*v)
    b1, b2, t = pt(0, -Wd/2), pt(0, Wd/2), pt(L, 0)
    c1, c2, bq = pt(L*0.72, -Wd/2), pt(L*0.72, Wd/2), pt(-3, 0)
    out = [f"M{f(b1[0])} {f(b1[1])} C{f(c1[0])} {f(c1[1])} {f(t[0])} {f(t[1])} {f(t[0])} {f(t[1])} C{f(t[0])} {f(t[1])} {f(c2[0])} {f(c2[1])} {f(b2[0])} {f(b2[1])} Q{f(bq[0])} {f(bq[1])} {f(b1[0])} {f(b1[1])}"]
    s = L/34
    if pat == 0:      # French tip
        p1, p2, p3 = pt(L*0.6, -Wd*0.42), pt(L*0.8, 0), pt(L*0.6, Wd*0.42)
        out.append(f"M{f(p1[0])} {f(p1[1])} Q{f(p2[0])} {f(p2[1])} {f(p3[0])} {f(p3[1])}")
    elif pat == 1:    # dots
        for u, v in ((10, -3), (10, 3), (17, 0), (24, -2), (24, 2.5)):
            x, y = pt(u*s, v*s); out.append(circle(x, y, 0.9*s))
    elif pat == 2:    # flower
        x, y = pt(16*s, 0)
        for k in range(5):
            r = math.radians(k*72 + ang); out.append(circle(x + 3.1*s*math.sin(r), y - 3.1*s*math.cos(r), 1.5*s))
        out.append(circle(x, y, 0.7*s))
    elif pat == 3:    # diagonal stripes
        for u in (8, 14, 20):
            p, q = pt(u*s, -Wd*0.38), pt((u+6)*s, Wd*0.38); out.append(P(p, q))
    elif pat == 4:    # half moon at the base
        p, q, r = pt(4*s, -Wd*0.38), pt(11*s, 0), pt(4*s, Wd*0.38); out.append(f"M{f(p[0])} {f(p[1])} Q{f(q[0])} {f(q[1])} {f(r[0])} {f(r[1])}")
    elif pat == 5:    # sparkle
        x, y = pt(17*s, 0); out += sparkle(x, y, 4*s)
    return out

def fan(cx, cy, s=1.0, n=9, spread=128):
    """A salon's swatch fan: nail tips on sticks, pinned at a ring."""
    out, R = [], 46*s
    for i in range(n):
        ang = -spread/2 + i*spread/(n-1); a = math.radians(ang)
        bx, by = cx + R*math.sin(a), cy - R*math.cos(a)
        out += tip(bx, by, ang, 30*s, 13*s, i % 6)
        out.append(P((cx + 6*s*math.sin(a), cy - 6*s*math.cos(a)), (bx, by)))
    out += [circle(cx, cy, 6*s), circle(cx, cy, 2*s)]
    return out

def bottle(x, ground, s=1.0, kind=0):
    """A nail polish bottle: square, round or tall, with its long cap."""
    out = []
    if kind == 0:
        w, h = 24*s, 22*s
        out.append(rrect(x, ground-h, w, h, 4*s)); nx = x + w/2
        out.append(P((nx-4*s, ground-h), (nx-4*s, ground-h-4*s), (nx+4*s, ground-h-4*s), (nx+4*s, ground-h)))
        out.append(P((nx-5.5*s, ground-h-4*s), (nx-4.5*s, ground-h-28*s), (nx+4.5*s, ground-h-28*s), (nx+5.5*s, ground-h-4*s)))
        out.append(P((x+4*s, ground-h*0.45), (x+w-4*s, ground-h*0.45)))
    elif kind == 1:
        r = 13*s; cy = ground - r; nx = x + r
        out.append(circle(nx, cy, r))
        out.append(P((nx-4*s, cy-r+0.5), (nx-4*s, cy-r-4*s), (nx+4*s, cy-r-4*s), (nx+4*s, cy-r+0.5)))
        out.append(f"M{f(nx-5*s)} {f(cy-r-4*s)} L{f(nx-3*s)} {f(cy-r-24*s)} Q{f(nx)} {f(cy-r-27*s)} {f(nx+3*s)} {f(cy-r-24*s)} L{f(nx+5*s)} {f(cy-r-4*s)}")
        out.append(f"M{f(nx-r*0.55)} {f(cy-r*0.3)} Q{f(nx-r*0.45)} {f(cy-r*0.65)} {f(nx-r*0.05)} {f(cy-r*0.72)}")
    else:
        w, h = 17*s, 36*s; nx = x + w/2
        out.append(P((x, ground), (x+1*s, ground-h), (x+w-1*s, ground-h), (x+w, ground), close=True))
        out.append(P((nx-3.5*s, ground-h), (nx-3.5*s, ground-h-4*s), (nx+3.5*s, ground-h-4*s), (nx+3.5*s, ground-h)))
        out.append(f"M{f(nx-4.5*s)} {f(ground-h-4*s)} L{f(nx-4.5*s)} {f(ground-h-19*s)} Q{f(nx)} {f(ground-h-23*s)} {f(nx+4.5*s)} {f(ground-h-19*s)} L{f(nx+4.5*s)} {f(ground-h-4*s)}")
        for k in range(3): out.append(circle(x + 4.5*s + k*4*s, ground - h*0.5 + (k % 2)*6*s, 1*s))
    return out

def tool(x, ground, s=1.0, lean=-10, kind="brush"):
    """A nail art brush or a dotting tool, standing on its end."""
    a = math.radians(lean); L = 62*s; ux, uy = math.sin(a), -math.cos(a)
    e = (x + ux*L, ground + uy*L)
    if kind == "brush":
        m = (x + ux*L*0.72, ground + uy*L*0.72)
        return [P((x, ground), m), f"M{f(m[0]-2*s)} {f(m[1])} Q{f(e[0]-1*s)} {f(e[1]+8*s)} {f(e[0])} {f(e[1])} Q{f(e[0]+1*s)} {f(e[1]+8*s)} {f(m[0]+2*s)} {f(m[1])}"]
    return [P((x, ground), e), circle(e[0], e[1] - 2*s, 2.2*s)]

def lashes(cx, cy, s=1.0):
    """A closed eye with long lashes and a groomed brow above it."""
    out = [f"M{f(cx-30*s)} {f(cy)} Q{f(cx)} {f(cy+16*s)} {f(cx+30*s)} {f(cy)}"]
    for i in range(9):
        t = (i + 0.5)/9; x = cx - 30*s + 60*s*t; y = cy + 16*s*2*t*(1-t)
        dx = (t - 0.5)*12*s
        out.append(f"M{f(x)} {f(y)} Q{f(x+dx*0.4)} {f(y+7*s)} {f(x+dx)} {f(y+13*s - abs(t-0.5)*8*s)}")
    out.append(f"M{f(cx-36*s)} {f(cy-14*s)} Q{f(cx-8*s)} {f(cy-30*s)} {f(cx+32*s)} {f(cy-20*s)} Q{f(cx-4*s)} {f(cy-24*s)} {f(cx-36*s)} {f(cy-14*s)}")
    return out

def brow_pencil(x, ground, s=1.0, lean=30):
    a = math.radians(lean); L = 74*s; ux, uy = math.sin(a), -math.cos(a); vx, vy = -uy, ux
    w = 3.2*s
    p = lambda u, v: (x + ux*u + vx*v, ground + uy*u + vy*v)
    return [P(p(0, -w), p(L, -w), p(L+9*s, 0), p(L, w), p(0, w), close=True), P(p(L, -w), p(L, w)), P(p(L*0.18, -w), p(L*0.18, w))]

def nails():
    o = []
    o += bottle(30, G, 1.0, 0) + bottle(62, G, 1.0, 2) + bottle(88, G, 1.0, 1)
    o += tool(130, G, 1.0, -9, "brush") + tool(142, G, 1.0, 10, "dot") + sparkle(178, 50, 5)
    o += fan(290, G - 4, 1.15) + sparkle(205, 84, 4) + sparkle(372, 44, 6)
    o += bottle(400, G, 0.9, 1) + bottle(430, G, 1.05, 0)
    o += lashes(560, 74, 1.2) + brow_pencil(500, G, 0.95, 74) + sparkle(632, 40, 5)
    o += bottle(660, G, 1.0, 2) + bottle(686, G, 1.1, 0) + tool(726, G, 1.0, -6, "brush")
    o += fan(840, G - 4, 0.95, 7, 116) + sparkle(912, 52, 6) + sparkle(764, 60, 4)
    o += bottle(940, G, 1.0, 1) + bottle(976, G, 0.95, 0)
    o += lashes(1090, 76, 0.95) + sparkle(1150, 46, 5)
    o += tool(1170, G, 1.0, 8, "dot") + bottle(1186, G, 1.0, 2) + bottle(1212, G, 1.05, 1)
    o.append(P((0, G), (W, G)))
    return o

# ---------------------------------------------------------------- Hair & scalp

def scissors(cx, cy, s=1.0, ang=-20):
    """Open hairdressing scissors, pivot at (cx, cy)."""
    out = []
    for side in (-1, 1):
        a = math.radians(ang + side*14); ux, uy = math.sin(a), -math.cos(a); vx, vy = -uy, ux
        tipp = (cx + ux*48*s, cy + uy*48*s)
        out.append(f"M{f(cx)} {f(cy)} Q{f(cx + ux*30*s + vx*4*s*side)} {f(cy + uy*30*s + vy*4*s*side)} {f(tipp[0])} {f(tipp[1])}")
        ring = (cx - ux*20*s, cy - uy*20*s)
        out.append(P((cx, cy), (cx - ux*12*s, cy - uy*12*s)))
        out.append(ellipse(ring[0], ring[1], 7*s, 7*s))
    out.append(circle(cx, cy, 1.8*s))
    return out

def comb(x, y, s=1.0, ang=-8, n=16):
    a = math.radians(ang); ux, uy = math.cos(a), math.sin(a); vx, vy = -uy, ux
    L, Hh = 70*s, 10*s
    p = lambda u, v: (x + ux*u + vx*v, y + uy*u + vy*v)
    out = [P(p(0, 0), p(L, 0), p(L, -Hh*0.55), p(0, -Hh*0.55), close=True)]
    for i in range(n):
        u = 3*s + i*(L - 6*s)/(n-1); out.append(P(p(u, 0), p(u, Hh*(1.0 if i < n*0.6 else 0.7))))
    return out

def dryer(x, ground, s=1.0):
    """A hairdryer resting on a ledge, nozzle to the right, with a curled cord."""
    out = [ellipse(x, ground - 52*s, 20*s, 20*s), ellipse(x, ground - 52*s, 9*s, 9*s)]
    out.append(P((x + 14*s, ground - 66*s), (x + 52*s, ground - 62*s), (x + 52*s, ground - 44*s), (x + 16*s, ground - 38*s)))
    out.append(P((x + 52*s, ground - 64*s), (x + 56*s, ground - 64*s), (x + 56*s, ground - 42*s), (x + 52*s, ground - 42*s)))
    out.append(f"M{f(x - 6*s)} {f(ground - 33*s)} L{f(x - 10*s)} {f(ground - 4*s)} Q{f(x - 9*s)} {f(ground)} {f(x - 2*s)} {f(ground)} L{f(x + 6*s)} {f(ground)} Q{f(x + 10*s)} {f(ground - 2*s)} {f(x + 9*s)} {f(ground - 6*s)} L{f(x + 8*s)} {f(ground - 33*s)}")
    out.append(P((x - 1*s, ground - 26*s), (x + 4*s, ground - 26*s)))
    d = f"M{f(x - 2*s)} {f(ground)}"
    for k in range(5): d += f" q{f(4*s)} {f(-6*s)} {f(8*s)} 0"
    out.append(d)
    return out

def chair_mirror(x, ground, s=1.0):
    """A salon station: an oval mirror on the wall above a styling chair."""
    out = [ellipse(x, ground - 98*s, 26*s, 34*s), ellipse(x, ground - 98*s, 22*s, 30*s)]
    out.append(f"M{f(x - 12*s)} {f(ground - 108*s)} Q{f(x - 6*s)} {f(ground - 118*s)} {f(x + 2*s)} {f(ground - 120*s)}")
    cy = ground - 26*s
    out.append(f"M{f(x - 22*s)} {f(cy)} L{f(x - 22*s)} {f(cy - 30*s)} Q{f(x - 22*s)} {f(cy - 40*s)} {f(x - 12*s)} {f(cy - 40*s)} L{f(x + 12*s)} {f(cy - 40*s)} Q{f(x + 22*s)} {f(cy - 40*s)} {f(x + 22*s)} {f(cy - 30*s)} L{f(x + 22*s)} {f(cy)}")
    out.append(rrect(x - 28*s, cy - 8*s, 56*s, 10*s, 4*s))
    out.append(P((x - 28*s, cy - 14*s), (x - 34*s, cy - 14*s), (x - 34*s, cy - 3*s)))
    out.append(P((x + 28*s, cy - 14*s), (x + 34*s, cy - 14*s), (x + 34*s, cy - 3*s)))
    out.append(P((x, cy + 2*s), (x, ground - 6*s)))
    out.append(P((x - 4*s, cy + 6*s), (x + 4*s, cy + 6*s)))
    out.append(f"M{f(x - 20*s)} {f(ground)} Q{f(x)} {f(ground - 8*s)} {f(x + 20*s)} {f(ground)}")
    return out

def jasmine_braid(x, ground, s=1.0):
    """The back of a head with a long Kerala braid wound with a string of jasmine (mullappoo)."""
    out = []
    top = ground - 118*s
    out.append(f"M{f(x - 22*s)} {f(top + 34*s)} C{f(x - 24*s)} {f(top + 6*s)} {f(x + 24*s)} {f(top + 6*s)} {f(x + 22*s)} {f(top + 34*s)}"
               f" C{f(x + 21*s)} {f(top + 48*s)} {f(x + 12*s)} {f(top + 54*s)} {f(x + 8*s)} {f(top + 58*s)}")
    out.append(f"M{f(x - 22*s)} {f(top + 34*s)} C{f(x - 21*s)} {f(top + 48*s)} {f(x - 12*s)} {f(top + 54*s)} {f(x - 8*s)} {f(top + 58*s)}")
    out.append(f"M{f(x - 8*s)} {f(top + 58*s)} L{f(x - 10*s)} {f(top + 72*s)} Q{f(x - 34*s)} {f(top + 78*s)} {f(x - 46*s)} {f(ground)}")
    out.append(f"M{f(x + 8*s)} {f(top + 58*s)} L{f(x + 10*s)} {f(top + 72*s)} Q{f(x + 34*s)} {f(top + 78*s)} {f(x + 46*s)} {f(ground)}")
    for k in (-15, -8, 0, 8, 15):    # hair combed back to the nape
        out.append(f"M{f(x + k*s)} {f(top + 14*s)} Q{f(x + k*1.15*s)} {f(top + 36*s)} {f(x + k*0.2*s)} {f(top + 50*s)}")
    y, by, n = top + 50*s, ground - 6*s, 8
    seg = (by - y)/n
    for i in range(n):              # the plait: overlapping lobes, alternating sides
        side = 1 if i % 2 else -1; w = 6.2*s*(1 - i*0.045)
        out.append(oval(x + side*w*0.45, y + seg*(i + 0.55), w*0.75, seg*0.62, 90 + side*28))
    out.append(f"M{f(x - 2.5*s)} {f(by)} L{f(x - 1*s)} {f(ground)} M{f(x + 2.5*s)} {f(by)} L{f(x + 1*s)} {f(ground)}")
    for i in range(9):              # the jasmine string down one side
        t = i/8; yy = y - 2*s + (by - y)*t; xx = x + 10*s*(1 - t*0.35)
        out.append(circle(xx, yy, 2.3*s)); out.append(circle(xx, yy, 0.6*s))
    return out

def round_brush(x, ground, s=1.0, ang=-30):
    a = math.radians(ang); ux, uy = math.sin(a), -math.cos(a); vx, vy = -uy, ux
    p = lambda u, v: (x + ux*u + vx*v, ground + uy*u + vy*v)
    out = [P(p(0, -2.5*s), p(34*s, -2.5*s)), P(p(0, 2.5*s), p(34*s, 2.5*s)), P(p(0, -2.5*s), p(0, 2.5*s))]
    out.append(P(p(34*s, -6*s), p(66*s, -6*s), p(66*s, 6*s), p(34*s, 6*s), close=True))
    for u in range(37, 66, 4):
        out.append(P(p(u*s, -6*s), p(u*s, -10*s))); out.append(P(p(u*s, 6*s), p(u*s, 10*s)))
    return out

def spray(x, ground, s=1.0):
    w, h = 20*s, 40*s
    out = [rrect(x, ground - h, w, h, 5*s), P((x + 6*s, ground - h), (x + 6*s, ground - h - 6*s), (x + 14*s, ground - h - 6*s), (x + 14*s, ground - h))]
    out.append(P((x + 4*s, ground - h - 6*s), (x + 4*s, ground - h - 14*s), (x + 18*s, ground - h - 14*s), (x + 26*s, ground - h - 11*s), (x + 18*s, ground - h - 9*s), (x + 16*s, ground - h - 6*s)))
    out.append(P((x + 10*s, ground - h - 14*s), (x + 10*s, ground - h - 6*s)))
    for i in range(3): out.append(circle(x + 32*s + i*5*s, ground - h - 12*s + (i - 1)*3*s, 0.8*s))
    out.append(P((x + 5*s, ground - h*0.55), (x + 15*s, ground - h*0.55)))
    return out

def strands(x, y, s=1.0, n=4):
    out = []
    for i in range(n):
        yy = y + i*7*s
        out.append(f"M{f(x)} {f(yy)} C{f(x + 30*s)} {f(yy - 12*s)} {f(x + 50*s)} {f(yy + 12*s)} {f(x + 84*s)} {f(yy - 2*s)}")
    return out

def hair():
    o = []
    o += chair_mirror(80, G, 1.0)
    o += scissors(196, 64, 1.0, -30) + comb(160, 112, 1.0, -6)
    o += dryer(300, G, 1.0) + strands(380, 54, 0.9)
    o += jasmine_braid(520, G, 1.0) + sprig(452, G, 46, -8) + sprig(588, G, 40, 8)
    o += spray(640, G, 1.0) + round_brush(696, G, 1.0, 30)
    o += chair_mirror(800, G, 0.92)
    o += scissors(908, 58, 0.85, 24) + comb(880, 114, 0.9, 6)
    o += strands(960, 60, 0.85, 3) + dryer(1080, G, 0.92)
    o += round_brush(1166, G, 0.9, 22) + spray(1214, G, 0.95)
    o.append(P((0, G), (W, G)))
    return o

# ---------------------------------------------------------------- Skin & facials

def profile(x, ground, s=1.0):
    """A face in profile, eyes closed, with a towel wrap: someone mid-facial."""
    X = lambda u: x + u*s; Y = lambda v: ground - v*s
    out = []
    out.append(f"M{f(X(-8))} {f(Y(0))} C{f(X(-6))} {f(Y(14))} {f(X(-2))} {f(Y(22))} {f(X(4))} {f(Y(28))}"
               f" C{f(X(10))} {f(Y(32))} {f(X(18))} {f(Y(30))} {f(X(24))} {f(Y(36))}"
               f" C{f(X(28))} {f(Y(40))} {f(X(27))} {f(Y(44))} {f(X(24))} {f(Y(46))}"
               f" C{f(X(28))} {f(Y(48))} {f(X(28))} {f(Y(52))} {f(X(25))} {f(Y(54))}"
               f" C{f(X(28))} {f(Y(58))} {f(X(34))} {f(Y(62))} {f(X(36))} {f(Y(66))}"
               f" C{f(X(30))} {f(Y(68))} {f(X(28))} {f(Y(70))} {f(X(29))} {f(Y(76))}"
               f" C{f(X(30))} {f(Y(84))} {f(X(28))} {f(Y(92))} {f(X(24))} {f(Y(96))}")
    out.append(f"M{f(X(24))} {f(Y(96))} C{f(X(14))} {f(Y(112))} {f(X(-24))} {f(Y(116))} {f(X(-36))} {f(Y(96))}"
               f" C{f(X(-44))} {f(Y(82))} {f(X(-40))} {f(Y(64))} {f(X(-30))} {f(Y(56))}")
    out.append(f"M{f(X(26))} {f(Y(92))} C{f(X(10))} {f(Y(100))} {f(X(-18))} {f(Y(100))} {f(X(-34))} {f(Y(90))}")
    out.append(f"M{f(X(-30))} {f(Y(56))} C{f(X(-24))} {f(Y(46))} {f(X(-18))} {f(Y(30))} {f(X(-22))} {f(Y(0))}")
    out.append(f"M{f(X(12))} {f(Y(74))} Q{f(X(17))} {f(Y(71))} {f(X(22))} {f(Y(74))}")
    for k in range(3): out.append(P((X(13 + k*4), Y(72.5)), (X(12.5 + k*4), Y(69.5))))
    out.append(f"M{f(X(26))} {f(Y(80))} Q{f(X(20))} {f(Y(86))} {f(X(10))} {f(Y(83))}")
    return out

def jar(x, ground, s=1.0):
    w, h = 36*s, 22*s
    return [rrect(x, ground - h, w, h, 6*s), rrect(x - 2*s, ground - h - 9*s, w + 4*s, 9*s, 3*s), P((x + 6*s, ground - h*0.5), (x + w - 6*s, ground - h*0.5))]

def dropper(x, ground, s=1.0):
    w, h = 18*s, 32*s; nx = x + w/2
    return [rrect(x, ground - h, w, h, 5*s), P((nx - 5*s, ground - h), (nx - 5*s, ground - h - 6*s), (nx + 5*s, ground - h - 6*s), (nx + 5*s, ground - h)),
            f"M{f(nx - 4*s)} {f(ground - h - 6*s)} L{f(nx - 4*s)} {f(ground - h - 12*s)} Q{f(nx)} {f(ground - h - 24*s)} {f(nx + 4*s)} {f(ground - h - 12*s)} L{f(nx + 4*s)} {f(ground - h - 6*s)}",
            rrect(x + 4*s, ground - h*0.7, w - 8*s, h*0.36, 2*s)]

def pump(x, ground, s=1.0):
    w, h = 22*s, 46*s; nx = x + w/2
    return [rrect(x, ground - h, w, h, 6*s), P((nx - 4*s, ground - h), (nx - 4*s, ground - h - 8*s), (nx + 4*s, ground - h - 8*s), (nx + 4*s, ground - h)),
            P((nx, ground - h - 8*s), (nx, ground - h - 14*s)), P((nx - 6*s, ground - h - 14*s), (nx + 14*s, ground - h - 14*s), (nx + 16*s, ground - h - 11*s)),
            P((x + 5*s, ground - h*0.6), (x + w - 5*s, ground - h*0.6)), P((x + 5*s, ground - h*0.48), (x + w - 9*s, ground - h*0.48))]

def jade_roller(x, ground, s=1.0, ang=-38):
    """A face roller: handle, a forked frame and the stone roller across it."""
    a = math.radians(ang); ux, uy = math.sin(a), -math.cos(a); vx, vy = -uy, ux
    p = lambda u, v: (x + ux*u + vx*v, ground + uy*u + vy*v)
    out = [P(p(0, -2.6*s), p(38*s, -2.6*s)), P(p(0, 2.6*s), p(38*s, 2.6*s)),
           f"M{f(p(0, -2.6*s)[0])} {f(p(0, -2.6*s)[1])} Q{f(p(-4*s, 0)[0])} {f(p(-4*s, 0)[1])} {f(p(0, 2.6*s)[0])} {f(p(0, 2.6*s)[1])}"]
    out.append(P(p(38*s, -2.6*s), p(44*s, -9*s), p(56*s, -9*s)))
    out.append(P(p(38*s, 2.6*s), p(44*s, 9*s), p(56*s, 9*s)))
    c = p(56*s, 0)
    out.append(oval(c[0], c[1], 12*s, 6.5*s, math.degrees(math.atan2(vy, vx))))
    out.append(oval(c[0], c[1], 12*s, 2.2*s, math.degrees(math.atan2(vy, vx))))
    return out

def gua_sha(x, y, s=1.0):
    return [f"M{f(x)} {f(y)} C{f(x - 22*s)} {f(y - 4*s)} {f(x - 26*s)} {f(y - 26*s)} {f(x - 10*s)} {f(y - 30*s)} Q{f(x - 2*s)} {f(y - 32*s)} {f(x)} {f(y - 24*s)}"
            f" Q{f(x + 2*s)} {f(y - 32*s)} {f(x + 10*s)} {f(y - 30*s)} C{f(x + 26*s)} {f(y - 26*s)} {f(x + 22*s)} {f(y - 4*s)} {f(x)} {f(y)} Z",
            f"M{f(x - 12*s)} {f(y - 14*s)} Q{f(x)} {f(y - 4*s)} {f(x + 12*s)} {f(y - 14*s)}"]

def cucumber(x, y, s=1.0):
    out = [circle(x, y, 9*s), circle(x, y, 7*s)]
    for k in range(6):
        a = math.radians(k*60); out.append(circle(x + 4*s*math.cos(a), y + 4*s*math.sin(a), 0.8*s))
    return out

def aloe(x, ground, s=1.0):
    out = []
    for ang, L in ((-40, 52), (-14, 70), (10, 64), (34, 48), (-62, 34), (58, 32)):
        a = math.radians(ang); ux, uy = math.sin(a), -math.cos(a); vx, vy = -uy, ux
        tip_ = (x + ux*L*s, ground + uy*L*s)
        c1 = (x + ux*L*s*0.45 + vx*7*s, ground + uy*L*s*0.45 + vy*7*s); c2 = (x + ux*L*s*0.45 - vx*7*s, ground + uy*L*s*0.45 - vy*7*s)
        out.append(f"M{f(x - vx*5*s)} {f(ground - vy*5*s)} Q{f(c1[0])} {f(c1[1])} {f(tip_[0])} {f(tip_[1])} Q{f(c2[0])} {f(c2[1])} {f(x + vx*5*s)} {f(ground + vy*5*s)}")
    return out

def towel(x, ground, s=1.0):
    out = []
    for i, (dx, dy) in enumerate(((0, 0), (34, 0), (17, -18))):
        cx, cy = x + dx*s, ground - 9*s + dy*s
        out.append(ellipse(cx, cy, 16*s, 9*s)); out.append(f"M{f(cx - 6*s)} {f(cy)} a6 4.5 0 1 0 {f(12*s)} 0")
    return out

def skin():
    o = []
    o += sprig(24, G, 60, 6) + jar(52, G, 1.0) + dropper(100, G, 1.0) + pump(130, G, 1.0)
    o += cucumber(190, 112, 1.0) + cucumber(212, 120, 0.9) + sparkle(200, 60, 5)
    o += profile(300, G, 1.05) + sparkle(352, 40, 6)
    o += aloe(410, G, 1.0) + jade_roller(486, G, 1.0, -40) + gua_sha(560, G - 2, 1.0)
    o += towel(600, G, 1.0) + sparkle(640, 64, 5)
    o += pump(690, G, 0.9) + jar(724, G, 1.1) + dropper(772, G, 0.95)
    o += sprig(812, G, 70, -10) + profile(900, G, 0.95) + sparkle(946, 44, 5)
    o += aloe(1012, G, 0.9) + cucumber(1060, 118, 1.0) + gua_sha(1104, G - 2, 0.9)
    o += jar(1140, G, 0.95) + dropper(1184, G, 1.0) + sprig(1230, G, 56, -6)
    o.append(P((0, G), (W, G)))
    return o

DRAW = {"nails": nails, "hair": hair, "skin": skin}

if __name__ == "__main__":
    out = sys.argv[1]
    if out.endswith(".ts"):     # the site's copy: python3 scripts/category-art.py src/views/category-art.ts
        band = lambda k: svg(DRAW[k]()).replace("<svg ", '<svg class="cat-art" preserveAspectRatio="xMidYMax slice" ', 1).replace('<path d=', '<path vector-effect="non-scaling-stroke" d=')
        body = "\n".join(f"  {k}: `{band(k)}`," for k in DRAW)
        open(out, "w").write("// Hairline bands for each service category, shown at the top of its search page, price guides and business page.\n"
                             "// Generated by scripts/category-art.py; edit the drawings there and run it again.\n"
                             f"export const CAT_ART: Record<string, string> = {{\n{body}\n}};\n\n"
                             "/** The band for a category, or nothing if it has no drawing yet. */\n"
                             "export const catBand = (cat?: string) => (cat && CAT_ART[cat] ? `<div class=\"cat-band\" aria-hidden=\"true\">${CAT_ART[cat]}</div>` : \"\");\n")
    else:
        for k, fn in DRAW.items():
            open(f"{out}/{k}.svg", "w").write(svg(fn()))
    print("drew", ", ".join(DRAW))
