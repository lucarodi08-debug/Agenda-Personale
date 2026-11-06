#!/usr/bin/env python3
"""Genera le icone dell'app (PNG + SVG) e il manifest PWA a partire da icon-config.json.
Uso:  python3 tools/make_icons.py     (richiede: pip install pillow)"""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(ROOT, 'icon-config.json'), encoding='utf-8'))
ic, app = cfg['icon'], cfg['app']
OUT = os.path.join(ROOT, 'icons')
os.makedirs(OUT, exist_ok=True)

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# Disegno in coordinate 512x512. scale: 1 = piena grandezza, <1 = ridotto (per l'icona "maskable", che ha un bordo di sicurezza)
def shapes(scale):
    k = lambda v: 256 + (v - 256) * scale
    s = lambda v: v * scale
    L = [('rrect', k(116), k(128), s(280), s(268), s(36), ic['cardColor']),
         ('rrect', k(116), k(128), s(280), s(76), s(36), ic['headerColor']),
         ('rect', k(116), k(166), s(280), s(38), ic['headerColor']),
         ('rrect', k(176), k(96), s(26), s(70), s(13), ic['ringColor']),
         ('rrect', k(310), k(96), s(26), s(70), s(13), ic['ringColor'])]
    sym = ic.get('symbol', 'check')
    if sym == 'check':
        L.append(('line', [(k(188), k(300)), (k(240), k(346)), (k(330), k(246))], s(30), ic['symbolColor']))
    elif sym == 'dots':
        for r in range(2):
            for c in range(3):
                L.append(('circle', k(186 + c * 70), k(264 + r * 62), s(17), ic['symbolColor']))
    return L

def svg(scale, full):
    rad = 0 if full else ic.get('cornerRadius', 112)
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
         '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>' % (ic['backgroundFrom'], ic['backgroundTo']),
         '<rect width="512" height="512" rx="%s" fill="url(#g)"/>' % rad]
    for sh in shapes(scale):
        if sh[0] == 'rrect': o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s"/>' % sh[1:])
        elif sh[0] == 'rect': o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % sh[1:])
        elif sh[0] == 'circle': o.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % sh[1:])
        elif sh[0] == 'line': o.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%.1f" stroke-linecap="round" stroke-linejoin="round"/>' % (' '.join('%.1f,%.1f' % p for p in sh[1]), sh[3], sh[2]))
    o.append('</svg>')
    return '\n'.join(o)

def png(scale, full, size):
    S = 4 * 512                                    # disegno 4 volte più grande e poi riduzione: bordi lisci
    f = S / 512.0
    a, b = rgb(ic['backgroundFrom']), rgb(ic['backgroundTo'])
    g = Image.new('L', (256, 256))
    g.putdata([int((x + y) / 510 * 255) for y in range(256) for x in range(256)])   # diagonale dall'alto a sinistra
    grad = g.resize((S, S), Image.BICUBIC)
    img = Image.composite(Image.new('RGB', (S, S), b), Image.new('RGB', (S, S), a), grad).convert('RGBA')
    d = ImageDraw.Draw(img)
    for sh in shapes(scale):
        if sh[0] == 'rrect': d.rounded_rectangle([sh[1] * f, sh[2] * f, (sh[1] + sh[3]) * f, (sh[2] + sh[4]) * f], radius=sh[5] * f, fill=rgb(sh[6]))
        elif sh[0] == 'rect': d.rectangle([sh[1] * f, sh[2] * f, (sh[1] + sh[3]) * f, (sh[2] + sh[4]) * f], fill=rgb(sh[5]))
        elif sh[0] == 'circle': d.ellipse([(sh[1] - sh[3]) * f, (sh[2] - sh[3]) * f, (sh[1] + sh[3]) * f, (sh[2] + sh[3]) * f], fill=rgb(sh[4]))
        elif sh[0] == 'line':
            pts = [(x * f, y * f) for x, y in sh[1]]; w = sh[2] * f
            d.line(pts, fill=rgb(sh[3]), width=int(w), joint='curve')
            for x, y in pts: d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=rgb(sh[3]))
    if not full:                                    # angoli arrotondati trasparenti
        m = Image.new('L', (S, S), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=ic.get('cornerRadius', 112) * f, fill=255)
        img.putalpha(m)
    return img.resize((size, size), Image.LANCZOS)

open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8').write(svg(1, False))
for size, name, scale, full in [(192, 'icon-192.png', 1, False), (512, 'icon-512.png', 1, False), (512, 'icon-maskable-512.png', .72, True), (180, 'apple-touch-icon.png', .78, True), (32, 'favicon-32.png', 1, False)]:
    png(scale, full, size).save(os.path.join(OUT, name))

manifest = {
    'name': app['name'], 'short_name': app['short_name'], 'description': app.get('description', ''), 'lang': app.get('lang', 'it'),
    'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'any',
    'theme_color': app['theme_color'], 'background_color': app['background_color'],
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}
json.dump(manifest, open(os.path.join(ROOT, 'manifest.webmanifest'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print('Icone e manifest generati in', ROOT)
