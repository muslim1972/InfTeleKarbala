from PIL import Image
from collections import deque

im = Image.open('public/media/moc-symbol-outlined.png').convert('RGBA')
w, h = im.size
px = im.load()

# Classify each pixel into component color: None, 'R', 'G', 'K'
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

# Connected components
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
                        # Keep same color family or merge R/K? Notice at x=45 top segment had K misclassified on dark red antialias, let's group by proximity + non-white
                        # Better: group by region (y relative to green or color)
                        if grid[ny][nx] == color or (color != 'G' and grid[ny][nx] != 'G'):
                            visited[ny][nx] = True
                            q.append((nx, ny))
            if len(pts) > 20:
                comps.append(pts)

print(f"Found {len(comps)} components:", [len(c) for c in comps])
for idx, pts in enumerate(comps):
    avg_y = sum(p[1] for p in pts)/len(pts)
    min_x = min(p[0] for p in pts)
    max_x = max(p[0] for p in pts)
    print(f"Comp {idx}: count={len(pts)}, avg_y={avg_y:.1f}, x=[{min_x},{max_x}]")
