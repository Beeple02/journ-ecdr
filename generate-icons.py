#!/usr/bin/env python3
"""
generate-icons.py — Creates PNG icons for the Diplomacy Advisor Chrome extension.
Run once from the project root:  python3 generate-icons.py

Requires only Python stdlib (struct + zlib). No Pillow needed.
"""

import struct
import zlib
import os

# Colour palette
DARK_BG     = (26,  31,  46)   # #1a1f2e
GOLD        = (201, 168, 76)   # #c9a84c
BORDER      = (58,  64,  96)   # #3a4060
WHITE       = (232, 234, 240)  # #e8eaf0


def png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)


def make_png(width: int, height: int) -> bytes:
    """Draw a simple sword icon on a dark background."""
    pixels = []
    cx, cy = width / 2, height / 2
    scale = width / 16  # normalise design to a 16-unit grid

    for y in range(height):
        row = []
        for x in range(width):
            # Normalised coordinates (0-16 grid)
            nx = x / scale
            ny = y / scale

            # Background
            r, g, b = DARK_BG

            # Outer rounded border (1 px)
            margin = 0.8
            if nx < margin or nx > 16 - margin or ny < margin or ny > 16 - margin:
                r, g, b = BORDER

            # Sword blade: vertical bar from (7.5-8.5, 1.5) to (7.5-8.5, 11)
            blade_x = abs(nx - 8) < 0.7
            blade_y = 1.5 <= ny <= 11.0
            if blade_x and blade_y:
                r, g, b = WHITE

            # Crossguard: horizontal bar from (4, 9) to (12, 10.2)
            guard_x = 4.0 <= nx <= 12.0
            guard_y = abs(ny - 9.6) < 0.8
            if guard_x and guard_y:
                r, g, b = GOLD

            # Pommel: small circle at (8, 13)
            if (nx - 8) ** 2 + (ny - 13) ** 2 < 1.2 ** 2:
                r, g, b = GOLD

            # Sword tip: triangle (8, 1) sharp point
            tip_y = ny < 3.5
            tip_x = abs(nx - 8) < (ny - 0.5) * 0.5
            if tip_y and tip_x:
                r, g, b = WHITE

            row.append((r, g, b))
        pixels.append(row)

    # Build raw image data (filter byte 0 = None per row)
    raw = b''
    for row in pixels:
        raw += b'\x00'
        for r, g, b in row:
            raw += bytes([r, g, b])

    signature = b'\x89PNG\r\n\x1a\n'
    ihdr = png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    idat = png_chunk(b'IDAT', zlib.compress(raw, 9))
    iend = png_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


def main():
    os.makedirs('icons', exist_ok=True)
    for size in (16, 48, 128):
        path = f'icons/icon{size}.png'
        with open(path, 'wb') as f:
            f.write(make_png(size, size))
        print(f'  Created {path}  ({size}x{size})')
    print('Done.')


if __name__ == '__main__':
    main()
