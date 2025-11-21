import re, os, glob

with open('EarwaxAudio.jet', 'r', encoding='utf-8') as f:
    text = f.read()
ids = set(int(m.group(1)) for m in re.finditer(r'"id"\s*:\s*(\d+)', text))
ogg_paths = glob.glob(os.path.join('Audio', '*.ogg'))
unused = []
for path in ogg_paths:
    base = os.path.splitext(os.path.basename(path))[0]
    if base.isdigit():
        if int(base) not in ids:
            unused.append(path)
    else:
        unused.append(path)
print('UNUSED_OGG_START')
for u in sorted(unused):
    print(u)
print('UNUSED_OGG_END')
