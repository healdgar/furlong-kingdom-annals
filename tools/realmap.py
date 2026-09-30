#!/usr/bin/env python3
"""Build a real-region map for the game from public elevation tiles (Terrarium PNGs, AWS open data,
which include sea-floor depths), and embed it in index.html between the REALMAPS markers.

  python3 tools/realmap.py tools/regions/channel.json

Heights are stored one byte a cell (-100..410 m in 2 m steps) on the region's grid, north at the top; the game
scales them down (vscale) because the map's distances stand for a realm ~40x larger than it is drawn.
Needs: pip install pillow numpy"""
import sys, json, math, io, base64, urllib.request, re, os
import numpy as np
from PIL import Image

Z = 9  # ~0.2 km a pixel at 50 N: finer than the game's ~1.1 km cells, averaged down
def tile_xy(lat, lon):
    n = 2 ** Z; x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

cache = {}
def tile(x, y):
    if (x, y) not in cache:
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png"
        for attempt in range(4):
            try:
                data = urllib.request.urlopen(url, timeout=60).read(); break
            except Exception as e:
                if attempt == 3: raise
        a = np.asarray(Image.open(io.BytesIO(data)).convert('RGB')).astype(np.float64)
        cache[(x, y)] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    return cache[(x, y)]

def height(lat, lon):
    fx, fy = tile_xy(lat, lon); px, py = fx * 256, fy * 256
    x0, y0 = int(math.floor(px)), int(math.floor(py)); dx, dy = px - x0, py - y0
    def at(X, Y): return tile(X // 256, Y // 256)[Y % 256, X % 256]
    return (at(x0, y0) * (1 - dx) + at(x0 + 1, y0) * dx) * (1 - dy) + (at(x0, y0 + 1) * (1 - dx) + at(x0 + 1, y0 + 1) * dx) * dy

def main(path):
    R = json.load(open(path)); b = R['box']; N = R['grid']; SS = 3  # 3x3 samples a cell, averaged
    out = np.zeros((N, N))
    for j in range(N):
        for i in range(N):
            acc = 0
            for sj in range(SS):
                for si in range(SS):
                    v = (j + (sj + 0.5) / SS) / N; u = (i + (si + 0.5) / SS) / N
                    lat = b['latN'] + (b['latS'] - b['latN']) * v; lon = b['lonW'] + (b['lonE'] - b['lonW']) * u
                    acc += height(lat, lon)
            out[j, i] = acc / SS / SS
        if j % 30 == 0: print(f"row {j}/{N}, tiles {len(cache)}", file=sys.stderr)
    q = np.clip(np.round((out + 100) / 2), 0, 255).astype(np.uint8)
    land = (out > 0).mean()
    print(f"heights {out.min():.0f}..{out.max():.0f} m, land {land*100:.0f}%", file=sys.stderr)
    sites = [{'n': s[0], 'u': (s[2] - b['lonW']) / (b['lonE'] - b['lonW']) - 0.5, 'v': (b['latN'] - s[1]) / (b['latN'] - b['latS']) - 0.5, 'c': s[3], 'w': s[4]} for s in R['sites']]
    sites = [s for s in sites if abs(s['u']) < 0.5 and abs(s['v']) < 0.5]
    for s in sites: s['u'] = round(s['u'], 4); s['v'] = round(s['v'], 4)
    M = {'title': R['title'], 'about': R['about'], 'w': N, 'h': N, 'q': [-100, 2], 'vscale': R['vscale'], 'crown': R['crown'], 'sites': sites,
         'data': base64.b64encode(q.tobytes()).decode()}
    block = f"<script>/* a real region, built by tools/realmap.py from {os.path.basename(path)} */(window.KA_MAPS=window.KA_MAPS||{{}})[{json.dumps(R['id'])}]={json.dumps(M, ensure_ascii=False, separators=(',', ':'))};</script>"
    html = open('index.html', encoding='utf-8').read()
    tag = f"<!--REALMAP:{R['id']}-->"
    pat = re.compile(re.escape(tag) + '.*?' + re.escape(tag), re.S)
    new = tag + block + tag
    html = pat.sub(lambda m: new, html) if pat.search(html) else html.replace('<!--REALMAPS-->', '<!--REALMAPS-->\n' + new)
    open('index.html', 'w', encoding='utf-8').write(html)
    print(f"embedded {R['id']}: {len(block)//1024} KB", file=sys.stderr)

if __name__ == '__main__': main(sys.argv[1])
