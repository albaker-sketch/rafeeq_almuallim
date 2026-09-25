"""توليد المقاطع الصوتية المدمجة لمؤقت الأنشطة (بدون آلات موسيقية).

التشغيل: python3 scripts/generate-timer-audio.py
الناتج: assets/audio/*.wav — مقاطع قصيرة تتكرر بسلاسة (loop).
"""
import math
import random
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "audio"
OUT.mkdir(parents=True, exist_ok=True)


def write_wav(name, samples, rate):
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = 0.85 / peak
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * scale)) * 32767)) for s in samples))
    print(f"{name}: {len(samples) / rate:.1f}s")


def add(buf, start, sig):
    for i, v in enumerate(sig):
        j = start + i
        if j < len(buf):
            buf[j] += v


# ---------- إيقاع دف: «دُم» منخفض و«تك» حاد ----------
def daf(rate=22050, bpm=96, bars=4):
    rnd = random.Random(7)
    eighth = 60 / bpm / 2
    length = int(rate * eighth * 8 * bars)
    buf = [0.0] * length

    def dum(vol):
        n = int(rate * 0.45)
        out, phase = [], 0.0
        for i in range(n):
            t = i / rate
            f = 55 + 45 * math.exp(-t * 18)
            phase += 2 * math.pi * f / rate
            body = math.sin(phase) * math.exp(-t * 7)
            skin = (rnd.random() * 2 - 1) * math.exp(-t * 60) * 0.25
            out.append((body + skin) * vol)
        return out

    def tak(vol):
        n = int(rate * 0.09)
        out, prev = [], 0.0
        for i in range(n):
            t = i / rate
            x = rnd.random() * 2 - 1
            hp = x - prev  # مرشّح تمرير عالٍ بسيط لصوت حاد
            prev = x
            ring = math.sin(2 * math.pi * 900 * t) * 0.3
            out.append((hp * 0.6 + ring) * math.exp(-t * 55) * vol)
        return out

    # نمط الوزن لكل مازورة (8 أثمان): D=دم، T=تك، t=تك خفيف
    pattern = ["D", "", "T", "t", "D", "D", "T", ""]
    for bar in range(bars):
        for k, hit in enumerate(pattern):
            pos = int(rate * eighth * (bar * 8 + k))
            if hit == "D":
                add(buf, pos, dum(1.0))
            elif hit == "T":
                add(buf, pos, tak(0.9))
            elif hit == "t":
                add(buf, pos, tak(0.45))
    # ذيل آخر نقرة يرجع لبداية المقطع ليكون التكرار سلسًا
    return buf, rate


# ---------- دقات ساعة هادئة ----------
def clock(rate=22050, seconds=8):
    rnd = random.Random(3)
    buf = [0.0] * (rate * seconds)
    for s in range(seconds):
        f = 2400 if s % 2 == 0 else 1900
        n = int(rate * 0.05)
        sig = []
        for i in range(n):
            t = i / rate
            sig.append((math.sin(2 * math.pi * f * t) * 0.6 + (rnd.random() * 2 - 1) * 0.4) * math.exp(-t * 140))
        add(buf, s * rate, sig)
    return buf, rate


# ---------- أمواج هادئة: ضجيج بني يعلو وينخفض ----------
def waves(rate=16000, seconds=16, period=8):
    rnd = random.Random(11)
    n = rate * seconds
    buf, brown, lp = [], 0.0, 0.0
    for i in range(n):
        brown = (brown + (rnd.random() * 2 - 1) * 0.02) * 0.998
        lp += (brown - lp) * 0.08
        t = i / rate
        swell = 0.15 + 0.85 * (0.5 - 0.5 * math.cos(2 * math.pi * t / period)) ** 1.6
        buf.append(lp * swell)
    # تلاشٍ قصير عند الطرفين لمنع النقرة عند التكرار
    fade = int(rate * 0.05)
    for i in range(fade):
        k = i / fade
        buf[i] *= k
        buf[-1 - i] *= k
    return buf, rate


if __name__ == "__main__":
    write_wav("daf.wav", *daf())
    write_wav("clock.wav", *clock())
    write_wav("waves.wav", *waves())
