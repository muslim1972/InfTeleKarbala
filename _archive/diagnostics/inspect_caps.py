from PIL import Image
from collections import deque

# Measure top 3 red bands + green bar from moc-symbol-outlined.png, enforce exact horizontal & vertical symmetry!
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

# For each component, find left-most, right-most, center saddle, and fit smooth quadratic/cubic Bezier on top & bottom edges
# Notice the bands have angled/beveled end-caps! Look closely at top-left vs bottom-left of each red band:
# At left end, top edge starts further right (e.g. x=24->31) while bottom edge starts further left (or vice-versa).
# Let's print the leftmost and rightmost 5 columns of each component!
for idx, pts in enumerate(comps):
    by_x = {}
    for x, y in pts:
        by_x.setdefault(x, []).append(y)
    xs = sorted(by_x.keys())
    print(f"Comp {idx}:")
    print("  Left :", [(x, min(by_x[x]), max(by_x[x])) for x in xs[:12]])
    print("  Mid  :", [(x, min(by_x[x]), max(by_x[x])) for x in xs[len(xs)//2-2:len(xs)//2+3]])
    print("  Right:", [(x, min(by_x[x]), max(by_x[x])) for x in xs[-12:]])
