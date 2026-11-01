# Draws the Thrissur and Kozhikode footer sketches (and one drawing each for the city pages) as SVG line art.
# Usage: python3 scripts/city-art.py <out-dir>
# Same hairline style as scripts/skyline-art.py and scripts/kochi-art.py: stroke only, no fill.
import math, sys
OUT = sys.argv[1]

def f(x): return f"{x:.1f}".rstrip('0').rstrip('.')
def P(*pts, close=False):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + (" Z" if close else "")
def circle(cx, cy, r): return f"M{f(cx-r)} {f(cy)} a{f(r)} {f(r)} 0 1 0 {f(2*r)} 0 a{f(r)} {f(r)} 0 1 0 {f(-2*r)} 0"
def arch(x, ground, w, h):
    r = w/2
    return f"M{f(x-r)} {f(ground)} L{f(x-r)} {f(ground-h+r)} A{f(r)} {f(r)} 0 0 1 {f(x+r)} {f(ground-h+r)} L{f(x+r)} {f(ground)}"

def waves(x0, x1, y, amp=2.5, step=26):
    d = f"M{f(x0)} {f(y)}"; x = x0
    while x < x1:
        d += f" q{f(step/4)} {f(-amp)} {f(step/2)} 0 t{f(step/2)} 0"; x += step
    return [d]

def palm(x, ground, h, lean=1.0):
    out = []
    tx, ty = x + 14*lean, ground - h
    out.append(f"M{f(x)} {f(ground)} Q{f(x+2*lean)} {f(ground-h*0.55)} {f(tx)} {f(ty)}")
    for a, L, droop in ((-160, 30, 14), (-125, 26, 10), (-70, 24, 8), (-25, 30, 12), (10, 26, 16), (-195, 22, 14)):
        r = math.radians(a)
        ex, ey = tx + L*math.cos(r)*lean, ty + L*math.sin(r)
        mx, my = (tx+ex)/2, (ty+ey)/2 - 8
        out.append(f"M{f(tx)} {f(ty)} Q{f(mx)} {f(my)} {f(ex)} {f(ey+droop)}")
    out.append(f"M{f(tx-2)} {f(ty+4)} a2 2 0 1 0 4 0")
    return out

def svg(paths, w, h, stroke=1.1):
    body = "".join(f'<path d="{p}"/>' for p in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="none" stroke="currentColor" '
            f'stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{body}</svg>')

# ---------------------------------------------------------------- Thrissur

def elephant(x, ground, s=1.0, d=1, umbrella=True):
    """A caparisoned Pooram elephant (side view), facing d (1 right, -1 left): nettipattam on the forehead,
    three riders, a muthukuda parasol held high and two alavattam fans."""
    X = lambda u: x + d*u*s
    Y = lambda v: ground + v*s
    out = []
    # body: rump, back, head, forehead
    out.append(f"M{f(X(14))} {f(Y(-28))} C{f(X(2))} {f(Y(-40))} {f(X(6))} {f(Y(-66))} {f(X(30))} {f(Y(-72))}"
               f" C{f(X(50))} {f(Y(-78))} {f(X(70))} {f(Y(-76))} {f(X(80))} {f(Y(-72))}"
               f" C{f(X(94))} {f(Y(-70))} {f(X(102))} {f(Y(-60))} {f(X(100))} {f(Y(-46))}")
    # trunk, hanging down and curling at the tip
    out.append(f"M{f(X(100))} {f(Y(-46))} C{f(X(102))} {f(Y(-30))} {f(X(104))} {f(Y(-16))} {f(X(102))} {f(Y(-6))} Q{f(X(100))} {f(Y(0))} {f(X(96))} {f(Y(-4))}")
    out.append(f"M{f(X(92))} {f(Y(-42))} C{f(X(94))} {f(Y(-30))} {f(X(96))} {f(Y(-18))} {f(X(96))} {f(Y(-8))}")
    # tusk and mouth
    out.append(f"M{f(X(90))} {f(Y(-38))} Q{f(X(98))} {f(Y(-30))} {f(X(108))} {f(Y(-32))}")
    # ear
    out.append(f"M{f(X(78))} {f(Y(-66))} C{f(X(64))} {f(Y(-62))} {f(X(62))} {f(Y(-44))} {f(X(70))} {f(Y(-36))} C{f(X(76))} {f(Y(-34))} {f(X(82))} {f(Y(-40))} {f(X(84))} {f(Y(-48))}")
    # legs and belly
    out.append(P((X(84), Y(-40)), (X(86), Y(0)), (X(74), Y(0)), (X(72), Y(-26))))
    out.append(f"M{f(X(72))} {f(Y(-26))} Q{f(X(50))} {f(Y(-18))} {f(X(32))} {f(Y(-24))}")
    out.append(P((X(32), Y(-24)), (X(30), Y(0)), (X(18), Y(0)), (X(14), Y(-28))))
    out.append(P((X(66), Y(-24)), (X(66), Y(0))))   # far legs, just their front edges
    out.append(P((X(24), Y(-22)), (X(24), Y(0))))
    out.append(f"M{f(X(6))} {f(Y(-48))} Q{f(X(-2))} {f(Y(-34))} {f(X(2))} {f(Y(-20))}")   # tail
    out.append(circle(X(88), Y(-56), 1.1*s))   # eye
    # nettipattam: the golden caparison down the forehead and trunk, with rows of bosses and a fringe
    out.append(P((X(84), Y(-72)), (X(97), Y(-68)), (X(103), Y(-50)), (X(102), Y(-30)), (X(96), Y(-22)), (X(92), Y(-30)), (X(88), Y(-52)), close=True))
    for (u, v) in ((90, -64), (95, -62), (92, -56), (98, -54), (95, -46), (100, -44), (97, -36)):
        out.append(circle(X(u), Y(v), 1.3*s))
    for u in (84, 88, 92, 96):
        out.append(P((X(u), Y(-71 + (u-84)*0.2)), (X(u), Y(-66 + (u-84)*0.2))))
    # caparison cloth over the back
    out.append(f"M{f(X(28))} {f(Y(-71))} L{f(X(30))} {f(Y(-52))} Q{f(X(48))} {f(Y(-48))} {f(X(66))} {f(Y(-52))} L{f(X(68))} {f(Y(-75))}")
    for u in range(32, 66, 7):
        out.append(P((X(u), Y(-51)), (X(u), Y(-47))))
    # three riders on the back
    for u in (34, 49, 64):
        out.append(P((X(u-4), Y(-73)), (X(u-3), Y(-83)), (X(u+3), Y(-83)), (X(u+4), Y(-74))))
        out.append(circle(X(u), Y(-87), 3*s))
    if umbrella:
        # the muthukuda, held up by the middle rider
        out.append(P((X(49), Y(-90)), (X(49), Y(-132))))
        out.append(f"M{f(X(31))} {f(Y(-124))} Q{f(X(31))} {f(Y(-146))} {f(X(49))} {f(Y(-148))} Q{f(X(67))} {f(Y(-146))} {f(X(67))} {f(Y(-124))}")
        scallops = "".join(f" q{f(d*2.25*s)} {f(4*s)} {f(d*4.5*s)} 0" for _ in range(8))
        out.append(f"M{f(X(31))} {f(Y(-124))}{scallops}")
        for u in (34, 40, 46, 52, 58, 64):   # fringe
            out.append(P((X(u), Y(-122)), (X(u), Y(-117))))
        out.append(f"M{f(X(37))} {f(Y(-134))} Q{f(X(49))} {f(Y(-140))} {f(X(61))} {f(Y(-134))}")   # a band of the umbrella
        out.append(P((X(49), Y(-148)), (X(49), Y(-155))))
        out.append(circle(X(49), Y(-157), 1.6*s))
        # alavattam fans held by the other two riders
        for u, k in ((34, -1), (64, 1)):
            out.append(P((X(u), Y(-90)), (X(u + k*4), Y(-108))))
            out.append(circle(X(u + k*4), Y(-115), 7*s))
            out.append(circle(X(u + k*4), Y(-115), 3.4*s))
    return out

def burst(cx, cy, r, n=14):
    """A firework burst: rays with a dot at each end."""
    out = []
    for i in range(n):
        a = 2*math.pi*i/n
        x0, y0 = cx + r*0.28*math.cos(a), cy + r*0.28*math.sin(a)
        x1, y1 = cx + r*math.cos(a), cy + r*math.sin(a)
        out.append(P((x0, y0), (x1, y1)))
        out.append(circle(x1 + 2.2*math.cos(a), y1 + 2.2*math.sin(a), 0.9))
    return out

def kerala_gopuram(cx, ground, s=1.0):
    """The gateway of Vadakkunnathan temple: a tiered Kerala gopuram with long sloping tiled roofs and a gabled front."""
    out = []; W = 120*s
    out.append(P((cx-W/2-10*s, ground), (cx+W/2+10*s, ground)))
    out.append(P((cx-W/2+4*s, ground), (cx-W/2+4*s, ground-24*s), (cx+W/2-4*s, ground-24*s), (cx+W/2-4*s, ground)))
    out.append(arch(cx, ground, 18*s, 20*s))
    for k in (-1, 1):
        for u in (22, 34, 46):
            out.append(P((cx + k*u*s, ground-1*s), (cx + k*u*s, ground-22*s)))
    # lower roof, wide eaves with a slight upturn
    out.append(f"M{f(cx-W/2-10*s)} {f(ground-20*s)} Q{f(cx-W/2)} {f(ground-22*s)} {f(cx-W/2+8*s)} {f(ground-26*s)} L{f(cx-30*s)} {f(ground-46*s)} L{f(cx+30*s)} {f(ground-46*s)} L{f(cx+W/2-8*s)} {f(ground-26*s)} Q{f(cx+W/2)} {f(ground-22*s)} {f(cx+W/2+10*s)} {f(ground-20*s)}")
    for i in range(7):
        u = -36 + i*12
        out.append(P((cx + u*s, ground-44*s), (cx + u*1.5*s, ground-27*s)))
    # upper storey with wooden lattice, upper roof
    out.append(P((cx-26*s, ground-46*s), (cx-26*s, ground-60*s), (cx+26*s, ground-60*s), (cx+26*s, ground-46*s)))
    for u in range(-22, 26, 6):
        out.append(P((cx + u*s, ground-48*s), (cx + u*s, ground-58*s)))
    out.append(f"M{f(cx-44*s)} {f(ground-56*s)} L{f(cx-14*s)} {f(ground-80*s)} L{f(cx+14*s)} {f(ground-80*s)} L{f(cx+44*s)} {f(ground-56*s)}")
    # gable (mukhappu) and the finials
    out.append(P((cx-14*s, ground-80*s), (cx, ground-94*s), (cx+14*s, ground-80*s)))
    out.append(P((cx-8*s, ground-82*s), (cx, ground-89*s), (cx+8*s, ground-82*s)))
    for u in (-14, 0, 14):
        y0 = ground - (94 if u == 0 else 80)*s
        out.append(P((cx + u*s, y0), (cx + u*s, y0 - 8*s)))
        out.append(circle(cx + u*s, y0 - 10*s, 2*s))
    return out

def basilica_tall(cx, ground, s=1.0):
    """Our Lady of Dolours Basilica (Puthenpally): a Gothic front with two towers and a very tall central bell tower."""
    out = []
    # central tower, tallest
    out.append(P((cx-11*s, ground-46*s), (cx-11*s, ground-120*s), (cx+11*s, ground-120*s), (cx+11*s, ground-46*s)))
    for v in (60, 80, 100):
        out.append(arch(cx, ground-v*s+12*s, 6*s, 12*s))
    out.append(P((cx-13*s, ground-120*s), (cx, ground-156*s), (cx+13*s, ground-120*s)))
    out.append(P((cx, ground-156*s), (cx, ground-165*s))); out.append(P((cx-3*s, ground-161*s), (cx+3*s, ground-161*s)))
    # nave front between the side towers
    out.append(P((cx-30*s, ground), (cx-30*s, ground-46*s), (cx+30*s, ground-46*s), (cx+30*s, ground)))
    out.append(arch(cx, ground, 14*s, 26*s))
    out.append(circle(cx, ground-36*s, 5*s))
    for k in (-1, 1):
        x0 = cx + k*30*s
        x1 = x0 + k*16*s
        out.append(P((x0, ground), (x0, ground-74*s), (x1, ground-74*s), (x1, ground)))
        out.append(arch((x0+x1)/2, ground-40*s, 6*s, 14*s))
        out.append(P((x0, ground-74*s), ((x0+x1)/2, ground-100*s), (x1, ground-74*s)))
        out.append(P(((x0+x1)/2, ground-100*s), ((x0+x1)/2, ground-106*s)))
    out.append(P((cx-56*s, ground), (cx+56*s, ground)))
    return out

def tharavad(x, ground, s=1.0):
    """A Kerala tharavad house: a two-level tiled roof over a veranda."""
    out = []; W = 104*s
    out.append(P((x, ground), (x+W, ground)))
    out.append(P((x+6*s, ground), (x+6*s, ground-22*s), (x+W-6*s, ground-22*s), (x+W-6*s, ground)))
    out.append(f"M{f(x-8*s)} {f(ground-20*s)} L{f(x+18*s)} {f(ground-40*s)} L{f(x+W-18*s)} {f(ground-40*s)} L{f(x+W+8*s)} {f(ground-20*s)}")
    out.append(f"M{f(x+24*s)} {f(ground-40*s)} L{f(x+38*s)} {f(ground-56*s)} L{f(x+W-38*s)} {f(ground-56*s)} L{f(x+W-24*s)} {f(ground-40*s)}")
    out.append(P((x+W/2-8*s, ground-56*s), (x+W/2, ground-64*s), (x+W/2+8*s, ground-56*s)))
    for i in range(5):
        out.append(P((x+14*s + i*19*s, ground-21*s), (x+14*s + i*19*s, ground)))
    return out

# ---------------------------------------------------------------- Kozhikode

def uru(x, y, s=1.0):
    """A Beypore uru: a big wooden dhow with a raised stern, plank lines and two lateen sails."""
    out = []; L = 150*s
    out.append(f"M{f(x)} {f(y-22*s)} Q{f(x+8*s)} {f(y+2*s)} {f(x+40*s)} {f(y+4*s)} L{f(x+L-34*s)} {f(y+4*s)} Q{f(x+L-6*s)} {f(y)} {f(x+L)} {f(y-28*s)}")
    out.append(f"M{f(x)} {f(y-22*s)} L{f(x+24*s)} {f(y-16*s)} L{f(x+L-14*s)} {f(y-16*s)} L{f(x+L)} {f(y-28*s)}")
    for v in (-10, -4):
        out.append(f"M{f(x+12*s)} {f(y+v*s)} Q{f(x+L/2)} {f(y+(v+6)*s)} {f(x+L-10*s)} {f(y+(v-2)*s)}")
    out.append(P((x+L-30*s, y-16*s), (x+L-30*s, y-26*s), (x+L-6*s, y-26*s)))   # stern cabin
    for mx, h, w in ((62, 96, 70), (104, 74, 52)):
        m = x + mx*s
        out.append(P((m, y-16*s), (m, y-h*s)))
        # lateen sail: a long slanted yard and the triangle below it
        top, bot = (m + 0.45*w*s, y-(h+8)*s), (m - 0.9*w*s, y-(h-46)*s)
        out.append(P(top, bot))
        out.append(f"M{f(top[0])} {f(top[1])} Q{f(m + 0.1*w*s)} {f(y-(h-30)*s)} {f(m + 0.05*w*s)} {f(y-22*s)} L{f(bot[0])} {f(bot[1])}")
    return out

def old_pier(x, ground, s=1.0):
    """The ruins of the old piers on Kozhikode beach: rows of pillars running out to sea, a broken deck."""
    out = []
    for i in range(9):
        px = x + i*16*s
        h = (26 - i*1.6)*s
        out.append(P((px, ground+6*s), (px, ground - h)))
        out.append(P((px+5*s, ground+6*s), (px+5*s, ground - h)))
        out.append(P((px-1*s, ground - h), (px+6*s, ground - h)))
    out.append(P((x-2*s, ground-27*s), (x+40*s, ground-24*s)))
    out.append(P((x+62*s, ground-20*s), (x+92*s, ground-18*s)))
    out.append(P((x+2*s, ground-14*s), (x+122*s, ground-9*s)))
    return out

def beach_lighthouse(x, ground, s=1.0):
    """The lighthouse on Kozhikode beach: a slim tower with a gallery and lantern."""
    out = []; b, top = ground, ground-86*s
    out.append(P((x-8*s, b), (x-5*s, top), (x+5*s, top), (x+8*s, b)))
    for t in (0.33, 0.66):
        yy = b + (top-b)*t; ww = 8*s + (5*s-8*s)*t
        out.append(P((x-ww, yy), (x+ww, yy)))
    out.append(P((x-9*s, top), (x+9*s, top)))
    out.append(P((x-5*s, top), (x-5*s, top-9*s), (x+5*s, top-9*s), (x+5*s, top)))
    out.append(f"M{f(x-6*s)} {f(top-9*s)} Q{f(x)} {f(top-16*s)} {f(x+6*s)} {f(top-9*s)}")
    out.append(P((x-14*s, b), (x+14*s, b)))
    return out

def mishkal(cx, ground, s=1.0):
    """Mishkal Mosque at Kuttichira: four storeys of wood under tiered, sloping Kerala roofs."""
    out = []
    out.append(P((cx-58*s, ground), (cx+58*s, ground)))
    out.append(P((cx-46*s, ground), (cx-46*s, ground-22*s), (cx+46*s, ground-22*s), (cx+46*s, ground)))
    for u in range(-38, 46, 12):
        out.append(arch(cx + u*s, ground, 6*s, 14*s))
    y, w = ground-22*s, 56*s
    for i, (hw, sh) in enumerate(((56, 14), (44, 13), (34, 12), (24, 11))):
        rw = hw*s
        out.append(f"M{f(cx-rw-10*s)} {f(y+2*s)} L{f(cx-rw+6*s)} {f(y-9*s)} L{f(cx+rw-6*s)} {f(y-9*s)} L{f(cx+rw+10*s)} {f(y+2*s)}")
        if i < 3:
            nw = (hw-10)*s
            out.append(P((cx-nw, y-9*s), (cx-nw, y-9*s-sh*s), (cx+nw, y-9*s-sh*s), (cx+nw, y-9*s)))
            for u in range(int(-hw+14), int(hw-12), 7):
                out.append(P((cx + u*s, y-11*s), (cx + u*s, y-7*s-sh*s)))
            y = y - 9*s - sh*s
        else:
            y = y - 9*s
    out.append(P((cx-14*s, y), (cx, y-12*s), (cx+14*s, y)))
    out.append(P((cx, y-12*s), (cx, y-18*s)))
    return out

def sweet_street(x, ground, s=1.0):
    """SM Street (Mittai Theruvu): shopfronts with awnings, and trays of halwa stacked in a window."""
    out = []
    for i, (w, h) in enumerate(((44, 58), (40, 66), (46, 54))):
        X0 = x + sum(ww for ww, _ in ((44, 58), (40, 66), (46, 54))[:i])*s + i*4*s
        W, H = w*s, h*s
        out.append(P((X0, ground), (X0, ground-H), (X0+W, ground-H), (X0+W, ground)))
        out.append(P((X0+3*s, ground-H+5*s), (X0+W-3*s, ground-H+5*s), (X0+W-3*s, ground-H+14*s), (X0+3*s, ground-H+14*s), close=True))   # signboard
        # striped awning
        ay = ground-H+22*s
        out.append(P((X0-3*s, ay+8*s), (X0+3*s, ay), (X0+W-3*s, ay), (X0+W+3*s, ay+8*s)))
        for k in range(1, 5):
            ux = X0 + k*W/5
            out.append(P((ux, ay), (ux - 1*s, ay+8*s)))
        out.append(f"M{f(X0-3*s)} {f(ay+8*s)}" + "".join(f" q{f(W/10+0.6*s)} {f(3*s)} {f(W/5+1.2*s)} 0" for _ in range(5)))
        # the window: halwa blocks on trays
        wy = ground-10*s
        out.append(P((X0+5*s, wy), (X0+W-5*s, wy)))
        for row in range(3):
            for j in range(3 - row):
                bx = X0 + 8*s + j*9*s + row*4.5*s
                by = wy - row*6*s
                out.append(P((bx, by), (bx, by-5*s), (bx+8*s, by-5*s), (bx+8*s, by)))
        out.append(arch(X0 + W - 10*s, ground, 9*s, 20*s))
    return out

def biriyani(cx, ground, s=1.0, steam=True):
    """A dum biriyani pot: a round copper handi sealed under its lid, on a stand over the coals, with steam."""
    out = []
    r = 26*s; by = ground - 14*s - r
    out.append(f"M{f(cx-14*s)} {f(by - r*0.82)} C{f(cx-r*1.35)} {f(by - r*0.5)} {f(cx-r*1.3)} {f(by + r*0.95)} {f(cx)} {f(by + r)} C{f(cx+r*1.3)} {f(by + r*0.95)} {f(cx+r*1.35)} {f(by - r*0.5)} {f(cx+14*s)} {f(by - r*0.82)}")
    out.append(P((cx-16*s, by - r*0.82), (cx+16*s, by - r*0.82)))   # rim
    # the lid, sealed with dough, and its knob
    out.append(f"M{f(cx-18*s)} {f(by - r*0.82)} Q{f(cx)} {f(by - r*1.4)} {f(cx+18*s)} {f(by - r*0.82)}")
    out.append(f"M{f(cx-17*s)} {f(by - r*0.78)} q{f(4.25*s)} {f(2*s)} {f(8.5*s)} 0 t{f(8.5*s)} 0 t{f(8.5*s)} 0 t{f(8.5*s)} 0")
    out.append(circle(cx, by - r*1.18, 2.4*s))
    out.append(f"M{f(cx-r*1.05)} {f(by)} Q{f(cx)} {f(by + 8*s)} {f(cx+r*1.05)} {f(by)}")   # a band round the belly
    for k in (-1, 1):   # handles
        out.append(f"M{f(cx + k*r*1.18)} {f(by - 6*s)} q{f(k*7*s)} {f(2*s)} {f(k*2*s)} {f(10*s)}")
    # stand and coals
    out.append(P((cx-22*s, ground), (cx-16*s, ground-14*s), (cx+16*s, ground-14*s), (cx+22*s, ground)))
    for u in (-10, -2, 6):
        out.append(f"M{f(cx + u*s)} {f(ground-2*s)} q{f(2*s)} {f(-4*s)} {f(4*s)} 0")
    if steam:
        for u, h in ((-8, 30), (2, 38), (12, 28)):
            x0, y0 = cx + u*s, by - r*1.32
            out.append(f"M{f(x0)} {f(y0)} c{f(-5*s)} {f(-h*0.25*s)} {f(5*s)} {f(-h*0.5*s)} 0 {f(-h*0.75*s)} s{f(5*s)} {f(-h*0.4*s)} {f(1*s)} {f(-h*s)}")
    return out

def halwa_plate(cx, ground, s=1.0):
    """Kozhikode halwa: glossy blocks stacked on a plate."""
    out = [f"M{f(cx-34*s)} {f(ground-4*s)} Q{f(cx)} {f(ground+4*s)} {f(cx+34*s)} {f(ground-4*s)}", P((cx-36*s, ground-4*s), (cx+36*s, ground-4*s))]
    for row, n in enumerate((4, 3, 2)):
        for j in range(n):
            bx = cx - n*8*s + j*16*s
            by = ground - 4*s - row*10*s
            out.append(P((bx, by), (bx, by-9*s), (bx+14*s, by-9*s), (bx+14*s, by)))
            out.append(P((bx+3*s, by-6*s), (bx+7*s, by-6*s)))   # a highlight
    return out

def town(x, ground, s=1.0, blocks=((0, 24, 58), (28, 30, 78), (62, 22, 50))):
    out = []
    for bx, bw, bh in blocks:
        X, W, H = x+bx*s, bw*s, bh*s
        out.append(P((X, ground), (X, ground-H), (X+W, ground-H), (X+W, ground)))
        for r in range(1, int(H/(9*s))):
            out.append(P((X+3*s, ground-r*9*s), (X+W-3*s, ground-r*9*s)))
    return out

def fishing_boat(x, y, s=1.0):
    return [f"M{f(x)} {f(y-6*s)} Q{f(x+8*s)} {f(y+3*s)} {f(x+26*s)} {f(y+3*s)} Q{f(x+44*s)} {f(y+3*s)} {f(x+52*s)} {f(y-6*s)}",
            P((x+26*s, y-1*s), (x+26*s, y-26*s)), f"M{f(x+26*s)} {f(y-25*s)} L{f(x+42*s)} {f(y-6*s)} L{f(x+26*s)} {f(y-6*s)}"]

G = 176

# Thrissur page drawing: one elephant under its parasol, with fireworks
th = elephant(70, 182, 1.15, d=1) + burst(250, 50, 30) + burst(290, 110, 18, 10) + burst(40, 30, 16, 10) + [P((30, 182), (300, 182))]
open(f"{OUT}/thrissur-hero.svg", "w").write(svg(th, 330, 200))

# Thrissur footer: Vadakkunnathan, the Pooram elephants facing each other at kudamattam, fireworks, Puthenpally, a tharavad
t = []
t += palm(18, G, 60, 1)
t += kerala_gopuram(120, G, 0.95)
t += palm(218, G, 66, -1)
for i in range(3):
    t += elephant(252 + i*92, G, 0.82, d=1)
for i in range(3):
    t += elephant(912 - i*92, G, 0.82, d=-1)
t += burst(600, 34, 26) + burst(560, 78, 14, 10) + burst(642, 70, 16, 10) + burst(470, 28, 14, 10) + burst(735, 30, 14, 10)
t += basilica_tall(1010, G, 0.92)
t += tharavad(1096, G, 0.95)
t += palm(1236, G, 58, -1)
t += [P((0, G), (1260, G))]
open(f"{OUT}/thrissur.svg", "w").write(svg(t, 1260, 200))

# Kozhikode page drawing: the dum biriyani pot, steaming
kh = biriyani(130, 186, 1.8) + halwa_plate(262, 186, 1.3) + [P((40, 186), (318, 186))]
open(f"{OUT}/kozhikode-hero.svg", "w").write(svg(kh, 330, 200))

# Kozhikode footer: an uru at sea, the old pier ruins and the lighthouse, Mishkal Mosque, SM Street halwa shops,
# the biriyani pot at the centre of it all, a fishing boat and the new city
z = []
z += waves(0, 360, G+8) + waves(10, 340, G+16, amp=1.8, step=34)
z += uru(14, G+2, 0.95)
z += old_pier(196, G, 1.0)
z += beach_lighthouse(372, G, 1.0)
z += mishkal(488, G, 0.95)
z += biriyani(640, G, 1.15)
z += sweet_street(700, G, 1.0)
z += palm(864, G, 64, -1)
z += waves(870, 1030, G+8) + fishing_boat(900, G+2, 1.0)
z += palm(1048, G, 56, -1)
z += town(1066, G, 1.0, ((0, 26, 62), (30, 34, 88), (68, 24, 54), (96, 30, 72)))
z += palm(1244, G, 60, -1)
z += [P((360, G), (870, G)), P((1030, G), (1260, G))]
open(f"{OUT}/kozhikode.svg", "w").write(svg(z, 1260, 200))
print("ok")
