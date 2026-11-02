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

# ---------------------------------------------------------------- Makeup & grooming

def brush_cup(x, ground, s=1.0):
    """A cup of makeup brushes: fluffy, angled and fan."""
    w, h = 30*s, 30*s
    out = [P((x, ground - h), (x + 3*s, ground), (x + w - 3*s, ground), (x + w, ground - h), close=True), P((x + 2*s, ground - h + 6*s), (x + w - 2*s, ground - h + 6*s))]
    for dx, L, lean, head in ((6, 44, -10, "round"), (13, 54, -2, "fan"), (19, 50, 4, "angle"), (25, 40, 12, "round")):
        a = math.radians(lean); ux, uy = math.sin(a), -math.cos(a)
        bx, by = x + dx*s, ground - h + 2*s; ex, ey = bx + ux*L*s, by + uy*L*s
        mx, my = bx + ux*(L - 12)*s, by + uy*(L - 12)*s
        out.append(P((bx, by), (mx, my)))
        if head == "round":
            out.append(f"M{f(mx - 3*s)} {f(my)} Q{f(ex - 7*s)} {f(ey + 3*s)} {f(ex)} {f(ey)} Q{f(ex + 7*s)} {f(ey + 3*s)} {f(mx + 3*s)} {f(my)}")
        elif head == "fan":
            out.append(f"M{f(mx)} {f(my)} L{f(ex - 10*s)} {f(ey + 2*s)} Q{f(ex)} {f(ey - 6*s)} {f(ex + 10*s)} {f(ey + 2*s)} Z")
        else:
            out.append(f"M{f(mx - 3*s)} {f(my)} L{f(ex - 4*s)} {f(ey + 4*s)} L{f(ex + 4*s)} {f(ey - 2*s)} L{f(mx + 3*s)} {f(my)}")
    return out

def compact(x, ground, s=1.0):
    """An open powder compact: mirror lid up, puff in the pan."""
    out = [ellipse(x, ground - 5*s, 22*s, 5*s), P((x - 22*s, ground - 5*s), (x - 22*s, ground - 1*s)), P((x + 22*s, ground - 5*s), (x + 22*s, ground - 1*s)),
           f"M{f(x - 22*s)} {f(ground - 1*s)} Q{f(x)} {f(ground + 3*s)} {f(x + 22*s)} {f(ground - 1*s)}", ellipse(x, ground - 5*s, 15*s, 3*s)]
    out.append(oval(x + 4*s, ground - 30*s, 22*s, 14*s, -8)); out.append(oval(x + 4*s, ground - 30*s, 17*s, 10*s, -8))
    out.append(f"M{f(x - 6*s)} {f(ground - 36*s)} Q{f(x - 2*s)} {f(ground - 40*s)} {f(x + 4*s)} {f(ground - 40*s)}")
    return out

def lipstick(x, ground, s=1.0):
    w = 13*s
    return [rrect(x, ground - 24*s, w, 24*s, 2*s), P((x + 1.5*s, ground - 24*s), (x + 1.5*s, ground - 32*s), (x + w - 1.5*s, ground - 32*s), (x + w - 1.5*s, ground - 24*s)),
            f"M{f(x + 3*s)} {f(ground - 32*s)} L{f(x + 3*s)} {f(ground - 42*s)} Q{f(x + 3*s)} {f(ground - 44*s)} {f(x + 6*s)} {f(ground - 46*s)} L{f(x + w - 3*s)} {f(ground - 50*s)} L{f(x + w - 3*s)} {f(ground - 32*s)}",
            P((x, ground - 10*s), (x + w, ground - 10*s))]

def palette(x, ground, s=1.0):
    """An eyeshadow palette lying open, seen from the front at an angle."""
    out = [P((x, ground), (x + 70*s, ground), (x + 64*s, ground - 24*s), (x + 6*s, ground - 24*s), close=True)]
    for r in range(2):
        for c in range(4):
            cx = x + 15*s + c*13.5*s - r*1.5*s + (1 - r)*0.0; cy = ground - 6*s - r*11*s
            out.append(ellipse(cx + r*2*s, cy, 5*s, 3.4*s))
    return out

def hand_mirror(x, ground, s=1.0):
    """A bridal hand mirror with a scalloped frame, standing on its handle."""
    cy = ground - 62*s
    out = [ellipse(x, cy, 20*s, 25*s), ellipse(x, cy, 15*s, 20*s)]
    for k in range(14):
        a = math.radians(k*360/14); out.append(circle(x + 23*s*math.sin(a), cy - 28*s*math.cos(a), 2.2*s))
    out.append(f"M{f(x - 4*s)} {f(cy + 25*s)} L{f(x - 3*s)} {f(ground - 6*s)} Q{f(x)} {f(ground)} {f(x + 3*s)} {f(ground - 6*s)} L{f(x + 4*s)} {f(cy + 25*s)}")
    out.append(f"M{f(x - 8*s)} {f(cy - 8*s)} Q{f(x - 6*s)} {f(cy - 16*s)} {f(x + 2*s)} {f(cy - 17*s)}")
    return out

def jhumka(x, y, s=1.0):
    """A pair of jhumka earrings hanging from a stand."""
    out = [P((x - 28*s, y), (x + 28*s, y)), P((x - 24*s, y), (x - 24*s, G)), P((x + 24*s, y), (x + 24*s, G)), P((x - 30*s, G), (x - 18*s, G)), P((x + 18*s, G), (x + 30*s, G))]
    for dx in (-10, 10):
        cx = x + dx*s
        out += [P((cx, y), (cx, y + 8*s)), circle(cx, y + 12*s, 4*s),
                f"M{f(cx - 10*s)} {f(y + 34*s)} Q{f(cx - 10*s)} {f(y + 18*s)} {f(cx)} {f(y + 17*s)} Q{f(cx + 10*s)} {f(y + 18*s)} {f(cx + 10*s)} {f(y + 34*s)} Z"]
        for k in range(5): out.append(circle(cx - 8*s + k*4*s, y + 37*s, 1.3*s))
    return out

def razor(x, ground, s=1.0):
    """A barber's straight razor lying open: a slim handle, the pivot, and the blade with its curved edge."""
    px, py = x + 46*s, ground - 3*s
    out = [f"M{f(x)} {f(ground)} Q{f(x + 22*s)} {f(ground - 5*s)} {f(px)} {f(py - 2.5*s)} L{f(px)} {f(py + 2.5*s)} Q{f(x + 22*s)} {f(ground + 3*s)} {f(x)} {f(ground)}",
           circle(px, py, 2*s)]
    a = math.radians(-16); ux, uy = math.cos(a), math.sin(a); vx, vy = -uy, ux
    q = lambda u, v: (px + ux*u + vx*v, py + uy*u + vy*v)
    s0, s1, e1, e0 = q(4*s, -3*s), q(52*s, -3*s), q(54*s, 9*s), q(10*s, 7*s)
    out.append(f"M{f(s0[0])} {f(s0[1])} L{f(s1[0])} {f(s1[1])} Q{f(q(57*s, 2*s)[0])} {f(q(57*s, 2*s)[1])} {f(e1[0])} {f(e1[1])} Q{f(q(30*s, 12*s)[0])} {f(q(30*s, 12*s)[1])} {f(e0[0])} {f(e0[1])} Z")
    t0, t1 = q(4*s, -3*s), q(-6*s, -8*s)
    out.append(f"M{f(t0[0])} {f(t0[1])} Q{f(q(-2*s, -7*s)[0])} {f(q(-2*s, -7*s)[1])} {f(t1[0])} {f(t1[1])}")
    out.append(P(q(14*s, -1*s), q(46*s, -1*s)))
    return out

def shaving_brush(x, ground, s=1.0):
    """A shaving brush standing on its handle, bristles up."""
    out = [f"M{f(x - 10*s)} {f(ground)} L{f(x + 10*s)} {f(ground)} Q{f(x + 6*s)} {f(ground - 14*s)} {f(x + 8*s)} {f(ground - 28*s)} L{f(x - 8*s)} {f(ground - 28*s)} Q{f(x - 6*s)} {f(ground - 14*s)} {f(x - 10*s)} {f(ground)}",
           P((x - 9*s, ground - 6*s), (x + 9*s, ground - 6*s))]
    out.append(f"M{f(x - 8*s)} {f(ground - 28*s)} C{f(x - 22*s)} {f(ground - 40*s)} {f(x - 16*s)} {f(ground - 62*s)} {f(x)} {f(ground - 62*s)} C{f(x + 16*s)} {f(ground - 62*s)} {f(x + 22*s)} {f(ground - 40*s)} {f(x + 8*s)} {f(ground - 28*s)}")
    for k in (-2, -1, 0, 1, 2):
        out.append(f"M{f(x + k*3*s)} {f(ground - 30*s)} Q{f(x + k*5.5*s)} {f(ground - 44*s)} {f(x + k*4.5*s)} {f(ground - 56*s + abs(k)*2*s)}")
    return out

def groom():
    o = []
    o += brush_cup(20, G, 1.0) + lipstick(66, G, 1.0) + lipstick(84, G, 0.85) + compact(140, G, 1.0) + sparkle(176, 44, 5)
    o += hand_mirror(230, G, 1.0) + palette(268, G, 1.0) + sparkle(318, 64, 5)
    o += jhumka(390, 48, 1.0) + sparkle(440, 40, 6)
    o += razor(460, G, 1.0) + shaving_brush(580, G, 1.0) + sprig(620, G, 50, 8)
    o += brush_cup(660, G, 0.9) + compact(740, G, 0.9) + lipstick(780, G, 0.95) + sparkle(812, 52, 5)
    o += hand_mirror(860, G, 0.9) + jhumka(950, 54, 0.85) + palette(1000, G, 0.9)
    o += shaving_brush(1100, G, 0.9) + razor(1124, G, 0.85) + sparkle(1238, 50, 5)
    o.append(P((0, G), (W, G)))
    return o

# ---------------------------------------------------------------- Ayurveda & massage

def kindi(x, ground, s=1.0):
    """A kindi: the round spouted vessel used to pour oil."""
    cy = ground - 20*s
    out = [f"M{f(x - 8*s)} {f(ground)} L{f(x + 8*s)} {f(ground)} L{f(x + 10*s)} {f(ground - 3*s)} C{f(x + 26*s)} {f(ground - 8*s)} {f(x + 26*s)} {f(cy - 14*s)} {f(x + 8*s)} {f(cy - 18*s)}"
           f" L{f(x + 7*s)} {f(cy - 30*s)} L{f(x - 7*s)} {f(cy - 30*s)} L{f(x - 8*s)} {f(cy - 18*s)} C{f(x - 26*s)} {f(cy - 14*s)} {f(x - 26*s)} {f(ground - 8*s)} {f(x - 10*s)} {f(ground - 3*s)} Z"]
    out.append(ellipse(x, cy - 30*s, 10*s, 2.5*s))
    out.append(f"M{f(x + 20*s)} {f(cy - 2*s)} C{f(x + 30*s)} {f(cy - 8*s)} {f(x + 34*s)} {f(cy - 20*s)} {f(x + 40*s)} {f(cy - 26*s)} L{f(x + 42*s)} {f(cy - 23*s)} C{f(x + 36*s)} {f(cy - 16*s)} {f(x + 32*s)} {f(cy + 2*s)} {f(x + 22*s)} {f(cy + 6*s)}")
    out.append(f"M{f(x - 18*s)} {f(cy - 2*s)} Q{f(x)} {f(cy + 4*s)} {f(x + 18*s)} {f(cy - 2*s)}")
    return out

def uruli(x, ground, s=1.0):
    """A wide bronze uruli with flowers floating in it."""
    out = [ellipse(x, ground - 18*s, 40*s, 6*s), f"M{f(x - 40*s)} {f(ground - 18*s)} C{f(x - 38*s)} {f(ground - 2*s)} {f(x + 38*s)} {f(ground - 2*s)} {f(x + 40*s)} {f(ground - 18*s)}",
           ellipse(x, ground - 1*s, 12*s, 1.5*s), P((x - 46*s, ground - 19*s), (x - 40*s, ground - 18*s)), P((x + 40*s, ground - 18*s), (x + 46*s, ground - 19*s))]
    for dx, r in ((-18, 4), (0, 5), (17, 4)):
        cx = x + dx*s; cy = ground - 19*s
        for k in range(5):
            a = math.radians(k*72); out.append(ellipse(cx + r*0.9*s*math.cos(a), cy + r*0.3*s*math.sin(a), r*0.55*s, r*0.3*s))
    return out

def droni(x, ground, s=1.0):
    """A droni: the carved wooden Ayurvedic massage table, with a folded towel and a bowl of oil."""
    L, top = 150*s, ground - 34*s
    out = [f"M{f(x)} {f(top)} L{f(x + L)} {f(top)} Q{f(x + L + 6*s)} {f(top)} {f(x + L + 4*s)} {f(top + 6*s)} L{f(x + L - 4*s)} {f(top + 12*s)} L{f(x + 4*s)} {f(top + 12*s)} L{f(x - 4*s)} {f(top + 6*s)} Q{f(x - 6*s)} {f(top)} {f(x)} {f(top)}",
           f"M{f(x + 6*s)} {f(top + 4*s)} Q{f(x + L/2)} {f(top + 10*s)} {f(x + L - 6*s)} {f(top + 4*s)}"]
    for lx in (x + 14*s, x + L - 14*s):
        out += [P((lx - 4*s, top + 12*s), (lx - 6*s, ground)), P((lx + 4*s, top + 12*s), (lx + 6*s, ground))]
    out.append(P((x + 14*s, ground - 8*s), (x + L - 14*s, ground - 8*s)))
    out.append(rrect(x + 10*s, top - 7*s, 30*s, 7*s, 3*s)); out.append(P((x + 16*s, top - 3.5*s), (x + 34*s, top - 3.5*s)))
    out.append(f"M{f(x + L - 34*s)} {f(top - 1*s)} Q{f(x + L - 24*s)} {f(top - 10*s)} {f(x + L - 14*s)} {f(top - 1*s)} Z")
    return out

def dhara(x, ground, s=1.0):
    """Shirodhara: a pot hanging from a wooden frame, a thin stream of oil falling into a bowl."""
    top = ground - 114*s
    out = [P((x - 30*s, ground), (x - 30*s, top)), P((x + 30*s, ground), (x + 30*s, top)), P((x - 36*s, top), (x + 36*s, top))]
    out += [P((x - 6*s, top), (x - 12*s, top + 22*s)), P((x + 6*s, top), (x + 12*s, top + 22*s)), P((x, top), (x, top + 18*s))]
    out.append(f"M{f(x - 16*s)} {f(top + 22*s)} C{f(x - 18*s)} {f(top + 44*s)} {f(x + 18*s)} {f(top + 44*s)} {f(x + 16*s)} {f(top + 22*s)} Z")
    out.append(P((x, top + 38*s), (x, top + 40*s)))
    d = f"M{f(x)} {f(top + 42*s)}"
    for k in range(6): d += f" q{f((1 if k % 2 else -1)*1.2*s)} {f(5*s)} 0 {f(10*s)}"
    out.append(d)
    out.append(f"M{f(x - 16*s)} {f(ground - 14*s)} Q{f(x)} {f(ground + 2*s)} {f(x + 16*s)} {f(ground - 14*s)} Z")
    for k in (-1, 1): out.append(f"M{f(x + k*5*s)} {f(ground - 18*s)} q{f(k*2*s)} {f(-3*s)} {f(k*5*s)} {f(-2*s)}")
    return out

def banana_leaf(x, ground, s=1.0):
    """Herbs, flowers and a mortar of crushed leaves laid out on a banana leaf."""
    L = 110*s
    out = [f"M{f(x)} {f(ground - 2*s)} Q{f(x + L*0.5)} {f(ground - 22*s)} {f(x + L)} {f(ground - 6*s)} Q{f(x + L*0.5)} {f(ground + 2*s)} {f(x)} {f(ground - 2*s)}",
           f"M{f(x + 2*s)} {f(ground - 2.5*s)} Q{f(x + L*0.5)} {f(ground - 11*s)} {f(x + L - 4*s)} {f(ground - 6*s)}"]
    for k in range(7):
        t = 0.12 + k*0.12; px = x + L*t; py = ground - 2*s - 18*s*t*(1 - t)*1.6
        out.append(P((px, py), (px + 6*s, py - 7*s*(1 - t))))
    out += leaf(x + 26*s, ground - 12*s, 16*s, -60) + leaf(x + 30*s, ground - 12*s, 14*s, 10)
    cx = x + 74*s
    out.append(f"M{f(cx - 12*s)} {f(ground - 16*s)} Q{f(cx)} {f(ground - 2*s)} {f(cx + 12*s)} {f(ground - 16*s)} Z")
    out.append(P((cx + 4*s, ground - 14*s), (cx + 14*s, ground - 34*s)))
    out.append(circle(cx + 14.5*s, ground - 35*s, 2.2*s))
    for k in range(5):
        a = math.radians(k*72); out.append(circle(x + 52*s + 3*s*math.cos(a), ground - 15*s + 3*s*math.sin(a), 1.8*s))
    return out

def stones(x, ground, s=1.0):
    out = []
    for i, (w, h) in enumerate(((30, 8), (24, 7), (18, 6), (12, 5))):
        y = ground - sum(hh for _, hh in ((30, 8), (24, 7), (18, 6), (12, 5))[:i])*s*1.6 - h*s*0.8
        out.append(ellipse(x, y, w*s/2 + 2*s, h*s*0.8))
    return out + leaf(x + 6*s, ground - 34*s, 12*s, 40)

def ayur():
    o = []
    o += sprig(16, G, 70, 8, 3) + kindi(64, G, 1.0) + uruli(160, G, 1.0)
    o += dhara(262, G, 1.0) + droni(320, G, 1.0) + sparkle(500, 46, 5)
    o += banana_leaf(512, G, 1.0) + stones(660, G, 1.0) + sprig(700, G, 56, -6)
    o += kindi(744, G, 0.9) + uruli(830, G, 0.85) + sparkle(890, 56, 5)
    o += droni(910, G, 0.82) + dhara(1080, G, 0.88) + banana_leaf(1124, G, 0.85) + sprig(1240, G, 50, -6)
    o.append(P((0, G), (W, G)))
    return o

# ---------------------------------------------------------------- Smile & dental

def tooth(cx, ground, s=1.0, shine=True):
    """A molar standing on its roots."""
    top = ground - 56*s
    out = [f"M{f(cx - 22*s)} {f(top + 14*s)} C{f(cx - 24*s)} {f(top)} {f(cx - 10*s)} {f(top - 4*s)} {f(cx)} {f(top + 4*s)} C{f(cx + 10*s)} {f(top - 4*s)} {f(cx + 24*s)} {f(top)} {f(cx + 22*s)} {f(top + 14*s)}"
           f" C{f(cx + 21*s)} {f(top + 26*s)} {f(cx + 16*s)} {f(top + 34*s)} {f(cx + 14*s)} {f(top + 46*s)} C{f(cx + 13*s)} {f(ground - 2*s)} {f(cx + 7*s)} {f(ground)} {f(cx + 5*s)} {f(ground - 8*s)}"
           f" C{f(cx + 3*s)} {f(top + 36*s)} {f(cx - 3*s)} {f(top + 36*s)} {f(cx - 5*s)} {f(ground - 8*s)} C{f(cx - 7*s)} {f(ground)} {f(cx - 13*s)} {f(ground - 2*s)} {f(cx - 14*s)} {f(top + 46*s)}"
           f" C{f(cx - 16*s)} {f(top + 34*s)} {f(cx - 21*s)} {f(top + 26*s)} {f(cx - 22*s)} {f(top + 14*s)} Z"]
    if shine: out.append(f"M{f(cx - 14*s)} {f(top + 8*s)} Q{f(cx - 13*s)} {f(top + 2*s)} {f(cx - 7*s)} {f(top + 2*s)}")
    return out

def toothbrush(x, ground, s=1.0, lean=-14):
    a = math.radians(lean); ux, uy = math.sin(a), -math.cos(a); vx, vy = -uy, ux
    p = lambda u, v: (x + ux*u + vx*v, ground + uy*u + vy*v)
    out = [f"M{f(p(0, -3*s)[0])} {f(p(0, -3*s)[1])} L{f(p(60*s, -2*s)[0])} {f(p(60*s, -2*s)[1])} L{f(p(78*s, -2.5*s)[0])} {f(p(78*s, -2.5*s)[1])} L{f(p(78*s, 2.5*s)[0])} {f(p(78*s, 2.5*s)[1])} L{f(p(60*s, 2*s)[0])} {f(p(60*s, 2*s)[1])} L{f(p(0, 3*s)[0])} {f(p(0, 3*s)[1])} Z"]
    for u in range(62, 79, 3): out.append(P(p(u*s, 2.5*s), p(u*s, 9*s)))
    return out

def cup(x, ground, s=1.0):
    return [P((x, ground - 30*s), (x + 3*s, ground), (x + 21*s, ground), (x + 24*s, ground - 30*s)), ellipse(x + 12*s, ground - 30*s, 12*s, 2.5*s)]

def mirror_probe(x, ground, s=1.0):
    """A dental mirror and a probe crossed on a tray."""
    out = [rrect(x, ground - 6*s, 90*s, 6*s, 3*s)]
    out.append(P((x + 8*s, ground - 9*s), (x + 64*s, ground - 18*s)))
    out.append(oval(x + 72*s, ground - 19.5*s, 7*s, 5*s, -10)); out.append(oval(x + 72*s, ground - 19.5*s, 4.5*s, 3*s, -10))
    out.append(f"M{f(x + 24*s)} {f(ground - 24*s)} L{f(x + 76*s)} {f(ground - 10*s)} Q{f(x + 82*s)} {f(ground - 9*s)} {f(x + 84*s)} {f(ground - 14*s)}")
    return out

def dental_chair(x, ground, s=1.0):
    """A dental chair, reclined, with its overhead lamp."""
    out = [P((x - 20*s, ground), (x + 40*s, ground)), P((x + 6*s, ground), (x + 6*s, ground - 26*s)), P((x + 14*s, ground), (x + 14*s, ground - 26*s))]
    out.append(f"M{f(x - 30*s)} {f(ground - 30*s)} L{f(x + 46*s)} {f(ground - 30*s)} Q{f(x + 54*s)} {f(ground - 30*s)} {f(x + 56*s)} {f(ground - 22*s)} L{f(x + 60*s)} {f(ground - 12*s)}")
    out.append(f"M{f(x - 30*s)} {f(ground - 30*s)} L{f(x - 30*s)} {f(ground - 38*s)} L{f(x + 40*s)} {f(ground - 38*s)} L{f(x + 48*s)} {f(ground - 30*s)}")
    out.append(f"M{f(x - 30*s)} {f(ground - 34*s)} L{f(x - 58*s)} {f(ground - 62*s)} Q{f(x - 62*s)} {f(ground - 66*s)} {f(x - 56*s)} {f(ground - 68*s)} L{f(x - 24*s)} {f(ground - 40*s)}")
    out.append(rrect(x - 70*s, ground - 78*s, 14*s, 8*s, 4*s))
    out.append(P((x + 60*s, ground), (x + 60*s, ground - 104*s), (x + 8*s, ground - 104*s), (x - 10*s, ground - 92*s)))
    out.append(f"M{f(x - 26*s)} {f(ground - 90*s)} Q{f(x - 10*s)} {f(ground - 102*s)} {f(x + 4*s)} {f(ground - 86*s)} Z")
    for k in (-1, 0, 1): out.append(P((x - 11*s + k*7*s, ground - 84*s), (x - 13*s + k*10*s, ground - 76*s)))
    return out

def smile(cx, cy, s=1.0):
    """A wide smile: upper lip, lower lip and a row of teeth."""
    out = [f"M{f(cx - 34*s)} {f(cy)} Q{f(cx - 16*s)} {f(cy - 12*s)} {f(cx)} {f(cy - 6*s)} Q{f(cx + 16*s)} {f(cy - 12*s)} {f(cx + 34*s)} {f(cy)}",
           f"M{f(cx - 34*s)} {f(cy)} Q{f(cx)} {f(cy + 26*s)} {f(cx + 34*s)} {f(cy)}",
           f"M{f(cx - 26*s)} {f(cy + 1*s)} Q{f(cx)} {f(cy - 3*s)} {f(cx + 26*s)} {f(cy + 1*s)} Q{f(cx)} {f(cy + 12*s)} {f(cx - 26*s)} {f(cy + 1*s)}"]
    for k in range(-3, 4):
        x = cx + k*7*s; out.append(P((x, cy - 0.5*s - (3 - abs(k))*0.4*s), (x, cy + 6*s - abs(k)*0.9*s)))
    return out

def paste(x, ground, s=1.0):
    return [f"M{f(x)} {f(ground)} L{f(x + 54*s)} {f(ground)} L{f(x + 60*s)} {f(ground - 6*s)} L{f(x + 54*s)} {f(ground - 12*s)} L{f(x)} {f(ground - 12*s)} Z",
            rrect(x + 60*s, ground - 9*s, 8*s, 6*s, 1.5*s), P((x + 6*s, ground - 6*s), (x + 30*s, ground - 6*s)), P((x + 4*s, ground), (x + 4*s, ground - 12*s))]

def dental():
    o = []
    o += tooth(40, G, 1.0) + sparkle(70, 66, 6) + cup(92, G, 1.0) + toothbrush(98, G - 26, 0.8, 14) + toothbrush(106, G - 26, 0.8, -6)
    o += mirror_probe(140, G, 1.0) + smile(300, 72, 1.1) + sparkle(352, 48, 5)
    o += dental_chair(450, G, 1.0) + sprig(540, G, 52, 6)
    o += paste(570, G, 1.0) + tooth(680, G, 0.9) + sparkle(706, 60, 5)
    o += smile(800, 74, 0.95) + mirror_probe(850, G, 0.9)
    o += cup(966, G, 0.95) + toothbrush(976, G - 24, 0.75, -10) + tooth(1040, G, 1.05) + sparkle(1074, 56, 6)
    o += dental_chair(1160, G, 0.9) + sprig(1240, G, 44, -6)
    o.append(P((0, G), (W, G)))
    return o

DRAW = {"nails": nails, "hair": hair, "skin": skin, "groom": groom, "ayur": ayur, "dental": dental}

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
