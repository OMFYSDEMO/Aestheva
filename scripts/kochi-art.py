# Draws the Kochi footer sketch as SVG line art. Usage: python3 scripts/kochi-art.py <out-dir>
# Hairline line-art of Kochi, in the same style as scripts/skyline-art.py (stroke only, no fill):
# a vallam on the sea, the cheena vala (Chinese fishing nets) of Fort Kochi at the centre, St Francis Church,
# a Fort Kochi heritage house, Santa Cruz Basilica, the Mattancherry clock tower, a Water Metro boat,
# a Vallarpadam container crane and the Marine Drive skyline.
import math, sys
OUT = sys.argv[1]

def f(x): return f"{x:.1f}".rstrip('0').rstrip('.')
def P(*pts, close=False):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + (" Z" if close else "")

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

def fishing_net(px, ground, s=1.0, d=-1):
    """Cheena vala: a cantilevered teak boom on a shore platform, the net held up on four arched spars
    over the water (on side d), counterweight stones on ropes at the shore end, and guy ropes."""
    out = []
    deck = ground - 10*s
    # platform on stilts at the water's edge
    out.append(P((px-26*s, deck), (px+26*s, deck)))
    for x in (px-22*s, px-8*s, px+8*s, px+22*s):
        out.append(P((x, deck), (x, ground+4*s)))
    # A-frame pivot and the long boom, lifted out over the water
    pv = (px, deck-14*s)
    out.append(P((px-10*s, deck), pv, (px+10*s, deck)))
    tip = (px + d*118*s, deck - 92*s)
    tail = (px - d*42*s, deck - 2*s)
    out.append(P(tail, pv, tip))
    # four straight spars fan down from the tip; the net is slung between their ends
    ends = [(tip[0] - 58*s, tip[1] + 36*s), (tip[0] - 26*s, tip[1] + 46*s), (tip[0] + 26*s, tip[1] + 46*s), (tip[0] + 58*s, tip[1] + 36*s)]
    for e in ends:
        out.append(P(tip, e))
    a, b = ends[0], ends[3]
    dip = tip[1] + 80*s
    out.append(f"M{f(a[0])} {f(a[1])} Q{f(tip[0])} {f(dip + 14*s)} {f(b[0])} {f(b[1])}")
    out.append(f"M{f(ends[1][0])} {f(ends[1][1])} Q{f(tip[0])} {f(dip)} {f(ends[2][0])} {f(ends[2][1])}")
    for t in (0.18, 0.32, 0.46, 0.6, 0.74, 0.88):   # a few mesh lines down to the sagging edge
        x0 = a[0] + (b[0]-a[0])*t
        y_top = a[1] + (b[1]-a[1])*t + 3*s
        y_bot = (1-t)**2*a[1] + 2*(1-t)*t*(dip + 14*s) + t**2*b[1]
        out.append(P((x0, y_top), (x0, y_bot - 1*s)))
    # guy ropes from the tip back to the tail
    out.append(P(tip, (tail[0], tail[1] - 30*s)))
    out.append(P((tail[0], tail[1] - 30*s), pv))
    # counterweight stones hanging from the tail end
    for i, k in enumerate((0.0, 0.35, 0.7)):
        hx = tail[0] + (pv[0]-tail[0])*k
        hy = tail[1] + (pv[1]-tail[1])*k
        out.append(P((hx, hy), (hx, hy + (10 + i*3)*s)))
        r = 2.6*s
        out.append(f"M{f(hx-r)} {f(hy + (10 + i*3)*s + r)} a{f(r)} {f(r)} 0 1 0 {f(2*r)} 0 a{f(r)} {f(r)} 0 1 0 {f(-2*r)} 0")
    return out

def st_francis(x, ground, s=1.0):
    """St Francis Church, Fort Kochi: a stepped, scrolled gable front with an arched door and a bell, tiled roof behind."""
    out = []; W = 74*s; cx = x + W/2
    out.append(P((x-6*s, ground), (x+W+6*s, ground)))
    out.append(P((x, ground), (x, ground-34*s), (x+W, ground-34*s), (x+W, ground)))
    # stepped gable with scrolled shoulders
    out.append(f"M{f(x)} {f(ground-34*s)} Q{f(x+8*s)} {f(ground-36*s)} {f(x+12*s)} {f(ground-44*s)} L{f(x+20*s)} {f(ground-44*s)} L{f(x+20*s)} {f(ground-54*s)}"
               f" Q{f(cx-10*s)} {f(ground-56*s)} {f(cx-8*s)} {f(ground-64*s)} L{f(cx+8*s)} {f(ground-64*s)} Q{f(cx+10*s)} {f(ground-56*s)} {f(x+W-20*s)} {f(ground-54*s)}"
               f" L{f(x+W-20*s)} {f(ground-44*s)} L{f(x+W-12*s)} {f(ground-44*s)} Q{f(x+W-8*s)} {f(ground-36*s)} {f(x+W)} {f(ground-34*s)}")
    # bell arch at the top, and a cross
    out.append(f"M{f(cx-5*s)} {f(ground-64*s)} L{f(cx-5*s)} {f(ground-70*s)} A{f(5*s)} {f(5*s)} 0 0 1 {f(cx+5*s)} {f(ground-70*s)} L{f(cx+5*s)} {f(ground-64*s)}")
    out.append(P((cx, ground-75*s), (cx, ground-84*s))); out.append(P((cx-3*s, ground-81*s), (cx+3*s, ground-81*s)))
    # arched door, two windows and a rose window
    out.append(f"M{f(cx-7*s)} {f(ground)} L{f(cx-7*s)} {f(ground-16*s)} A{f(7*s)} {f(7*s)} 0 0 1 {f(cx+7*s)} {f(ground-16*s)} L{f(cx+7*s)} {f(ground)}")
    for k in (-1, 1):
        wx = cx + k*22*s
        out.append(f"M{f(wx-4*s)} {f(ground-12*s)} L{f(wx-4*s)} {f(ground-22*s)} A{f(4*s)} {f(4*s)} 0 0 1 {f(wx+4*s)} {f(ground-22*s)} L{f(wx+4*s)} {f(ground-12*s)}")
    r = 4*s
    out.append(f"M{f(cx-r)} {f(ground-46*s)} a{f(r)} {f(r)} 0 1 0 {f(2*r)} 0 a{f(r)} {f(r)} 0 1 0 {f(-2*r)} 0")
    # tiled roof running back
    out.append(P((x+W, ground-34*s), (x+W+18*s, ground-28*s), (x+W+18*s, ground)))
    return out

def heritage_house(x, ground, s=1.0):
    """A Fort Kochi heritage house: long sloping tiled roof over a pillared veranda, shuttered windows."""
    out = []; W = 96*s
    out.append(P((x, ground), (x+W, ground)))
    out.append(f"M{f(x-8*s)} {f(ground-26*s)} L{f(x+14*s)} {f(ground-46*s)} L{f(x+W-14*s)} {f(ground-46*s)} L{f(x+W+8*s)} {f(ground-26*s)}")
    out.append(P((x-8*s, ground-26*s), (x+W+8*s, ground-26*s)))
    for i in range(6):   # roof tile lines
        tx = x + 18*s + i*(W-36*s)/5
        out.append(P((tx, ground-45*s), (tx - 6*s, ground-28*s)))
    for i in range(6):   # veranda pillars
        out.append(P((x+4*s + i*(W-8*s)/5, ground-26*s), (x+4*s + i*(W-8*s)/5, ground)))
    out.append(P((x, ground-8*s), (x+W, ground-8*s)))   # balustrade rail
    return out

def santa_cruz(cx, ground, s=1.0):
    """Santa Cruz Basilica: twin Gothic spires either side of a pedimented front with a rose window."""
    out = []; tw, th, gap = 18*s, 70*s, 34*s
    out.append(P((cx-gap-tw-6*s, ground), (cx+gap+tw+6*s, ground)))
    # central front
    out.append(P((cx-gap, ground), (cx-gap, ground-58*s), (cx, ground-80*s), (cx+gap, ground-58*s), (cx+gap, ground)))
    out.append(f"M{f(cx-9*s)} {f(ground)} L{f(cx-9*s)} {f(ground-22*s)} A{f(9*s)} {f(9*s)} 0 0 1 {f(cx+9*s)} {f(ground-22*s)} L{f(cx+9*s)} {f(ground)}")
    r = 8*s
    out.append(f"M{f(cx-r)} {f(ground-50*s)} a{f(r)} {f(r)} 0 1 0 {f(2*r)} 0 a{f(r)} {f(r)} 0 1 0 {f(-2*r)} 0")
    for a in range(0, 180, 45):   # rose window tracery
        ra = math.radians(a)
        out.append(P((cx - r*math.cos(ra), ground-50*s - r*math.sin(ra)), (cx + r*math.cos(ra), ground-50*s + r*math.sin(ra))))
    out.append(P((cx, ground-80*s), (cx, ground-90*s))); out.append(P((cx-3*s, ground-87*s), (cx+3*s, ground-87*s)))
    for k in (-1, 1):   # the two towers and spires
        x0 = cx + k*gap if k > 0 else cx - gap - tw
        out.append(P((x0, ground), (x0, ground-th), (x0+tw, ground-th), (x0+tw, ground)))
        for yy in (ground-26*s, ground-50*s):
            out.append(P((x0, yy), (x0+tw, yy)))
        out.append(f"M{f(x0+tw/2-3*s)} {f(ground-th+16*s)} L{f(x0+tw/2-3*s)} {f(ground-th+8*s)} A{f(3*s)} {f(3*s)} 0 0 1 {f(x0+tw/2+3*s)} {f(ground-th+8*s)} L{f(x0+tw/2+3*s)} {f(ground-th+16*s)}")
        out.append(P((x0-2*s, ground-th), (x0+tw/2, ground-th-46*s), (x0+tw+2*s, ground-th)))
        out.append(P((x0+tw/2, ground-th-46*s), (x0+tw/2, ground-th-54*s)))
        out.append(P((x0+tw/2-2.5*s, ground-th-51*s), (x0+tw/2+2.5*s, ground-th-51*s)))
    return out

def clock_tower(x, ground, s=1.0):
    """The clock tower beside the Paradesi Synagogue in Mattancherry: a slim square tower, clock face, pyramid cap."""
    out = []; w = 16*s
    out.append(P((x-w/2, ground), (x-w/2, ground-60*s), (x+w/2, ground-60*s), (x+w/2, ground)))
    out.append(P((x-w/2-2*s, ground-60*s), (x+w/2+2*s, ground-60*s)))
    r = 5*s; cy = ground-48*s
    out.append(f"M{f(x-r)} {f(cy)} a{f(r)} {f(r)} 0 1 0 {f(2*r)} 0 a{f(r)} {f(r)} 0 1 0 {f(-2*r)} 0")
    out.append(P((x, cy), (x, cy-3.4*s))); out.append(P((x, cy), (x+2.6*s, cy)))
    out.append(P((x-w/2-2*s, ground-60*s), (x, ground-76*s), (x+w/2+2*s, ground-60*s)))
    out.append(P((x, ground-76*s), (x, ground-82*s)))
    for yy in (ground-14*s, ground-30*s):
        out.append(f"M{f(x-3*s)} {f(yy)} L{f(x-3*s)} {f(yy-6*s)} A{f(3*s)} {f(3*s)} 0 0 1 {f(x+3*s)} {f(yy-6*s)} L{f(x+3*s)} {f(yy)}")
    return out

def vallam(x, y, s=1.0):
    """A small country boat with a fisherman's pole."""
    out = [f"M{f(x)} {f(y-6*s)} Q{f(x+8*s)} {f(y+3*s)} {f(x+26*s)} {f(y+3*s)} Q{f(x+44*s)} {f(y+3*s)} {f(x+52*s)} {f(y-6*s)}"]
    out.append(P((x+30*s, y-1*s), (x+38*s, y-30*s)))
    out.append(f"M{f(x+24*s)} {f(y-1*s)} L{f(x+24*s)} {f(y-12*s)} M{f(x+21*s)} {f(y-15*s)} a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0")
    return out

def water_metro(x, y, s=1.0):
    """A Kochi Water Metro boat: low catamaran hull, a long cabin with windows and a flat roof."""
    out = []; L = 88*s
    out.append(f"M{f(x)} {f(y-6*s)} L{f(x+6*s)} {f(y)} L{f(x+L-4*s)} {f(y)} L{f(x+L)} {f(y-8*s)} Z")
    out.append(P((x+10*s, y-6*s), (x+14*s, y-20*s), (x+L-10*s, y-20*s), (x+L-6*s, y-8*s)))
    out.append(P((x+12*s, y-23*s), (x+L-8*s, y-23*s)))
    for i in range(7):
        wx = x + 18*s + i*9*s
        out.append(P((wx, y-11*s), (wx, y-17*s), (wx+5*s, y-17*s), (wx+5*s, y-11*s), close=True))
    return out

def crane(x, ground, s=1.0):
    """A ship-to-shore container crane at Vallarpadam: two A-frame legs, a long boom out over the water."""
    out = []; h = 96*s
    out.append(P((x, ground), (x+8*s, ground-h*0.6), (x+30*s, ground-h*0.6), (x+38*s, ground)))
    out.append(P((x+4*s, ground-h*0.3), (x+34*s, ground-h*0.3)))
    out.append(P((x+8*s, ground-h*0.6), (x+19*s, ground-h), (x+30*s, ground-h*0.6)))
    out.append(P((x-62*s, ground-h*0.66), (x+58*s, ground-h*0.66)))   # boom
    out.append(P((x+19*s, ground-h), (x-62*s, ground-h*0.66)))        # stays
    out.append(P((x+19*s, ground-h), (x+58*s, ground-h*0.66)))
    out.append(P((x-36*s, ground-h*0.66), (x-36*s, ground-h*0.4)))    # hoist
    out.append(P((x-42*s, ground-h*0.4), (x-30*s, ground-h*0.4), (x-30*s, ground-h*0.33), (x-42*s, ground-h*0.33), close=True))
    return out

def towers(x, ground, s=1.0, blocks=((0, 26, 70), (30, 34, 96), (70, 22, 58), (96, 30, 80))):
    """Marine Drive and Kakkanad: modern towers with window grids."""
    out = []
    for bx, bw, bh in blocks:
        X, W, H = x+bx*s, bw*s, bh*s
        out.append(P((X, ground), (X, ground-H), (X+W, ground-H), (X+W, ground)))
        for r in range(1, int(H/(9*s))):
            out.append(P((X+3*s, ground-r*9*s), (X+W-3*s, ground-r*9*s)))
    return out

def svg(paths, w, h, stroke=1.1):
    body = "".join(f'<path d="{p}"/>' for p in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="none" stroke="currentColor" '
            f'stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{body}</svg>')

# Version 1: one large net over the water, for the Kochi page
h = fishing_net(236, 176, 1.3, d=-1) + waves(0, 196, 184) + waves(16, 180, 192, amp=1.8, step=34) + palm(304, 176, 70, -1)
h += [P((196, 176), (330, 176))]
open(f"{OUT}/cheena-vala.svg", "w").write(svg(h, 330, 200))

# Version 2: the city line, with the nets at the centre
G = 176
k = []
k += waves(0, 84, G+8) + vallam(12, G+2, 0.85)
k += st_francis(92, G, 1.0)
k += palm(196, G, 62, 1)
k += heritage_house(224, G, 0.9)
k += palm(318, G, 56, -1)
# the cheena vala at the centre: three nets on their platforms, lifted out over the water
k += waves(336, 846, G+8) + waves(352, 830, G+16, amp=1.8, step=34)
k += fishing_net(362, G, 0.8, d=1)
k += fishing_net(526, G, 1.08, d=1)
k += fishing_net(700, G, 0.86, d=1)
k += palm(886, G, 68, -1)
k += santa_cruz(956, G, 0.9)
k += clock_tower(1024, G, 1.0)
k += waves(1036, 1124, G+8) + water_metro(1040, G+4, 0.8)
k += crane(1158, G, 0.85)
k += towers(1194, G, 0.84, ((0, 22, 64), (26, 28, 90), (58, 20, 54)))
k += [P((84, G), (92, G)), P((180, G), (224, G)), P((312, G), (336, G)), P((846, G), (904, G)), P((1008, G), (1036, G)), P((1124, G), (1260, G))]
open(f"{OUT}/kochi.svg", "w").write(svg(k, 1260, 200))
print("ok", len(open(f"{OUT}/kochi.svg").read()))
