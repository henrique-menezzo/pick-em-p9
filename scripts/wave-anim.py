# The brand's animated wave (nation-speaks-wave-animated.svg, a 30 fps flipbook: one <g> per frame,
# shown for a frame each) as data the app draws on a canvas: per frame, every capsule as
# colour, x, y, width, height in the SVG's units, y from the top of the wave's box.
# python3 scripts/wave-anim.py <svg> src/data/wave-anim.json
import json, re, sys
s = open(sys.argv[1]).read()
vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
frames = re.findall(r'<g class="f" style="animation-delay:([\d.]+)s">(.*?)</g>', s, re.S)
dur = float(re.search(r'animation:s ([\d.]+)s', s).group(1))
rects = [re.findall(r'<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="[\d.]+" fill="(#\w+)"', g) for _, g in frames]
colors = []
for f in rects:
    for *_, c in f:
        if c not in colors: colors.append(c)
y0 = min(float(r[1]) for f in rects for r in f)
y1 = max(float(r[1]) + float(r[3]) for f in rects for r in f)
num = lambda v: int(v) if float(v).is_integer() else round(float(v), 1)
out = {
    'w': vb[2], 'h': y1 - y0, 'fps': round(len(frames) / dur, 3), 'colors': colors,
    'frames': [[v for x, y, w, h, c in f for v in (colors.index(c), num(x), num(float(y) - y0), num(w), num(h))] for f in rects],
}
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print(len(frames), 'frames', out['fps'], 'fps', 'box', out['w'], 'x', out['h'], 'colors', len(colors))
