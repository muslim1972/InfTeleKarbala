from PIL import Image
from collections import deque

im = Image.open('public/media/moc-symbol-outlined.png').convert('RGBA')
w, h = im.size
px = im.load()

grid = [[None]*w for _ in range(h)]
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a > 100 and not (r > 200 and g > 200 and b > 200):
            if r > g + 45 and r > b + 45:
                grid[y][x] = 'R'
            elif g > r + 25:
                grid[y][x] = 'G'
            else:
                grid[y][x] = 'K'

visited = [[False]*w for _ in range(h)]
comps = []
for y in range(h):
    for x in range(w):
        if grid[y][x] and not visited[y][x]:
            color = grid[y][x]
            q = deque([(x, y)])
            visited[y][x] = True
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = cx+dx, cy+dy
                    if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and grid[ny][nx]:
                        if grid[ny][nx] == color or (color != 'G' and grid[ny][nx] != 'G'):
                            visited[ny][nx] = True
                            q.append((nx, ny))
            if len(pts) > 20:
                comps.append(pts)

# Enforce bilateral symmetry about x_mid = 90.5, and smooth polynomial/bezier fit on inner curves
def poly_fit(pts, deg=4):
    # Simple least-squares fit of y(u) where u = (x - 90.5)/90.0 using Gauss elimination (no numpy needed)
    u_pts = [((x - 90.5) / 90.0, y) for x, y in pts]
    m = deg + 1
    A = [[0.0]*m for _ in range(m)]
    B = [0.0]*m
    for u, y in u_pts:
        # Use even-only powers? Wait: bilateral symmetry means only even powers of u! (u^0, u^2, u^4)
        # Wait: even powers guarantee zero slope at center (no center kink!) AND perfect left-right mirror!
        pass
    # Actually let's use even powers: u^0, u^2, u^4, u^6 -> 4 parameters!
    pows = [0, 2, 4, 6]
    m = len(pows)
    A = [[0.0]*m for _ in range(m)]
    B = [0.0]*m
    for u, y in u_pts:
        vals = [u**p for p in pows]
        for i in range(m):
            B[i] += vals[i] * y
            for j in range(m):
                A[i][j] += vals[i] * vals[j]
    # Gaussian elimination
    for i in range(m):
        piv = max(range(i, m), key=lambda r: abs(A[r][i]))
        A[i], A[piv] = A[piv], A[i]
        B[i], B[piv] = B[piv], B[i]
        for r in range(i+1, m):
            f = A[r][i] / A[i][i]
            for c in range(i, m):
                A[r][c] -= f * A[i][c]
            B[r] -= f * B[i]
    coef = [0.0]*m
    for i in range(m-1, -1, -1):
        coef[i] = (B[i] - sum(A[i][j]*coef[j] for j in range(i+1, m))) / A[i][i]
    return lambda x: sum(coef[i] * (((x - 90.5)/90.0)**pows[i]) for i in range(m))

def curve_d(fn, x0, x1, steps=16):
    # Generate smooth polyline/catmull-rom along analytical curve
    pts = [(x0 + (x1 - x0)*i/steps, fn(x0 + (x1 - x0)*i/steps)) for i in range(steps+1)]
    return pts

def pts_to_bezier(points):
    d = f"M {points[0][0]:.2f} {points[0][1]:.2f}"
    n = len(points)
    for i in range(n - 1):
        p0 = points[i-1] if i > 0 else points[0]
        p1 = points[i]
        p2 = points[i+1]
        p3 = points[i+2] if i+2 < n else points[-1]
        cp1x = p1[0] + (p2[0] - p0[0]) / 6.0
        cp1y = p1[1] + (p2[1] - p0[1]) / 6.0
        cp2x = p2[0] - (p3[0] - p1[0]) / 6.0
        cp2y = p2[1] - (p3[1] - p1[1]) / 6.0
        d += f" C {cp1x:.2f} {cp1y:.2f}, {cp2x:.2f} {cp2y:.2f}, {p2[0]:.2f} {p2[1]:.2f}"
    return d

# Exact sharp cap breakpoints observed from inspect_caps.py:
# Band 0: cap top-left=(34.5, 2.0), bot-left=(24.0, 12.8)
# Band 1: cap top-left=(18.5, 19.0), bot-left=(11.5, 30.0)
# Band 2: cap top-left=(8.0, 37.2), bot-left=(5.0, 46.2)
# Band 3 (Green): left-top=(1.5, 68.0), left-bot=(1.5, 74.5)
top_specs = [
    (0, 34.5, 24.0, '#CE1126'),
    (1, 18.5, 11.5, '#CE1126'),
    (2,  8.0,  5.0, '#CE1126'),
]

svg_paths = []
cx = 90.5
cy = 71.0

for idx, x_tl, x_bl, col in top_specs:
    by_x = {}
    for x, y in comps[idx]:
        by_x.setdefault(x, []).append(y)
    # Fit top curve over x in [x_tl, 2*cx - x_tl]
    x_tr = 2*cx - x_tl
    x_br = 2*cx - x_bl
    top_samples = [(x + 0.5, float(min(by_x[x]))) for x in sorted(by_x) if x_tl <= x <= x_tr]
    bot_samples = [(x + 0.5, float(max(by_x[x]) + 1.0)) for x in sorted(by_x) if x_bl <= x <= x_br]
    fn_top = poly_fit(top_samples)
    fn_bot = poly_fit(bot_samples)

    t_pts = curve_d(fn_top, x_tl, x_tr, 18)
    b_pts = curve_d(fn_bot, x_br, x_bl, 18)

    # Top path: M bl -> L tl -> C ... tr -> L br -> C ... bl Z
    d_top_red = f"M {x_bl:.2f} {fn_bot(x_bl):.2f} L {x_tl:.2f} {fn_top(x_tl):.2f} " + pts_to_bezier(t_pts).split(' ', 3)[3] + f" L {x_br:.2f} {fn_bot(x_br):.2f} " + pts_to_bezier(b_pts).split(' ', 3)[3] + " Z"
    svg_paths.append((col, d_top_red))

# Green bar (comp 3)
by_x_g = {}
for x, y in comps[3]:
    by_x_g.setdefault(x, []).append(y)
gx0, gx1 = 1.5, 2*cx - 1.5
g_top = poly_fit([(x+0.5, float(min(by_x_g[x]))) for x in sorted(by_x_g) if gx0+2 <= x <= gx1-2])
g_bot = poly_fit([(x+0.5, float(max(by_x_g[x])+1.0)) for x in sorted(by_x_g) if gx0+2 <= x <= gx1-2])
gt_pts = curve_d(g_top, gx0, gx1, 14)
gb_pts = curve_d(g_bot, gx1, gx0, 14)
d_green = pts_to_bezier(gt_pts) + " L " + f"{gx1:.2f} {g_bot(gx1):.2f} " + pts_to_bezier(gb_pts).split(' ', 3)[3] + " Z"
svg_paths.append(('#007A3D', d_green))

# Bottom 3 black bands: mirror top 3 vertically across cy=71.0 (or fit from comps[4..6] for exact match!)
# Wait: mirroring around cy=71.0 makes top & bottom 100% crisp, symmetrical, balanced! Let's verify cy offset from comps 4..6!
bot_specs = [
    (4,  5.0,  8.0, '#111827'),
    (5, 11.5, 18.5, '#111827'),
    (6, 24.0, 34.5, '#111827'),
]
for idx, x_tl, x_bl, col in bot_specs:
    by_x = {}
    for x, y in comps[idx]:
        by_x.setdefault(x, []).append(y)
    x_tr = 2*cx - x_tl
    x_br = 2*cx - x_bl
    top_samples = [(x + 0.5, float(min(by_x[x]))) for x in sorted(by_x) if x_tl <= x <= x_tr]
    bot_samples = [(x + 0.5, float(max(by_x[x]) + 1.0)) for x in sorted(by_x) if x_bl <= x <= x_br]
    fn_top = poly_fit(top_samples)
    fn_bot = poly_fit(bot_samples)

    t_pts = curve_d(fn_top, x_tl, x_tr, 18)
    b_pts = curve_d(fn_bot, x_br, x_bl, 18)

    d_blk = f"M {x_bl:.2f} {fn_bot(x_bl):.2f} L {x_tl:.2f} {fn_top(x_tl):.2f} " + pts_to_bezier(t_pts).split(' ', 3)[3] + f" L {x_br:.2f} {fn_bot(x_br):.2f} " + pts_to_bezier(b_pts).split(' ', 3)[3] + " Z"
    svg_paths.append((col, d_blk))

svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="none">\n'
for col, d in svg_paths:
    svg += f'  <path d="{d}" fill="{col}" />\n'
svg += '</svg>'

with open('d:/InfTeleKarbala/_archive/diagnostics/moc_clean.svg', 'w', encoding='utf-8') as f:
    f.write(svg)
print("Generated symmetric SVG length:", len(svg))
