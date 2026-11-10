# أيقونة وزن: ميزان بسيط على خلفية خضراء
from PIL import Image, ImageDraw
def icon(size, path):
    S = 4 * size
    im = Image.new('RGB', (S, S), (15, 92, 82))
    d = ImageDraw.Draw(im)
    c = (246, 242, 233)
    w = int(S * 0.045)
    cx = S // 2
    top, bottom = int(S * 0.22), int(S * 0.76)
    d.line([(cx, top), (cx, bottom)], fill=c, width=w)                        # العمود
    d.line([(int(S*0.33), bottom), (int(S*0.67), bottom)], fill=c, width=w)   # القاعدة
    beam = int(S * 0.34)
    d.line([(int(S*0.18), beam), (int(S*0.82), beam)], fill=c, width=w)       # العاتق
    r = int(S * 0.035); d.ellipse([cx-r, top-r, cx+r, top+r], fill=c)
    for x in (0.18, 0.82):
        px = int(S * x)
        d.line([(px, beam), (px - int(S*0.11), int(S*0.58))], fill=c, width=int(w*0.7))
        d.line([(px, beam), (px + int(S*0.11), int(S*0.58))], fill=c, width=int(w*0.7))
        d.pieslice([px - int(S*0.13), int(S*0.48), px + int(S*0.13), int(S*0.68)], 0, 180, fill=c)
    im.resize((size, size), Image.LANCZOS).save(path)
icon(192, '/home/claude/wazn/icons/icon-192.png')
icon(512, '/home/claude/wazn/icons/icon-512.png')
icon(180, '/home/claude/wazn/icons/apple-touch-icon.png')
