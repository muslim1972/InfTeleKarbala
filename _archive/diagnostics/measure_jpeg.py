from PIL import Image

im = Image.open('public/media/شعار الوزارة.jpeg').convert('RGB')
w, h = im.size
px = im.load()

# Print corner endpoints of the left emblem (x < 190) in شعار الوزارة.jpeg
for x in range(0, 188):
    # find R, G, K spans
    spans = []
    cur = None
    start = 0
    for y in range(h):
        r, g, b = px[x, y]
        if r > 180 and g > 180 and b > 180:
            col = None
        elif r > g + 50 and r > b + 50:
            col = 'R'
        elif g > r + 25 and g > b + 15:
            col = 'G'
        elif r < 90 and g < 90 and b < 90:
            col = 'K'
        else:
            col = None
        if col != cur:
            if cur is not None:
                spans.append((cur, start, y-1))
            cur = col
            start = y
    if cur is not None:
        spans.append((cur, start, h-1))
    if x in [0, 1, 2, 10, 22, 45, 70, 91, 112, 137, 160, 173, 180, 182]:
        print(f"x={x:3d}: {spans}")
