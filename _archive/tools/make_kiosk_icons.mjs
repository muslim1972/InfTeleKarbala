/**
 * _archive/tools/make_kiosk_icons.mjs
 * يولد أيقونات PWA خاصة لطرفية البصمة البيومترية العامة:
 * public/kiosk-icon-192.png
 * public/kiosk-icon-512.png
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  const rowBytes = width * 4 + 1;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData, { level: 9 });

  function crc32(buf) {
    let table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const typeAndData = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflated),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function renderBiometricIcon(size) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 512;

  return (x, y) => {
    // الخلفية: كحلي داكن ملكي
    let r = 2;
    let g = 6;
    let b = 23;
    let a = 255;

    const dx = x - cx;
    const dy = y - cy;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);

    // حدود بطاقة التطبيق مستديرة الحواف
    const margin = 28 * scale;
    const radius = 90 * scale;
    const innerW = size - 2 * margin;
    const innerH = size - 2 * margin;

    // فحص المسافة من مستطيل مستدير
    const qx = Math.abs(x - cx) - (innerW / 2 - radius);
    const qy = Math.abs(y - cy) - (innerH / 2 - radius);
    const dRect = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;

    // خارج المستطيل المستدير تماماً
    if (dRect > 0) {
      return [r, g, b, 255];
    }

    // تدرج الخلفية الداخلية
    const bgFactor = 1 - (distFromCenter / (size * 0.7));
    r = Math.floor(10 + 15 * bgFactor);
    g = Math.floor(15 + 25 * bgFactor);
    b = Math.floor(40 + 50 * bgFactor);

    // إطار نيون زمردي خارجي
    if (Math.abs(dRect) < 8 * scale) {
      const grad = (x + y) / (size * 2);
      r = Math.floor(16 * (1 - grad) + 6 * grad);
      g = Math.floor(185 * (1 - grad) + 182 * grad);
      b = Math.floor(129 * (1 - grad) + 212 * grad);
      return [r, g, b, 255];
    }

    // أقواس الاستهداف الأربعة في الزوايا (Target Reticle)
    const bracketSize = 45 * scale;
    const bracketThick = 6 * scale;
    const bOffset = 70 * scale;
    const inCorners = 
      ((Math.abs(x - (cx - bOffset)) < bracketSize && Math.abs(y - (cy - bOffset)) < bracketThick) ||
       (Math.abs(x - (cx - bOffset)) < bracketThick && Math.abs(y - (cy - bOffset)) < bracketSize) ||
       (Math.abs(x - (cx + bOffset)) < bracketSize && Math.abs(y - (cy - bOffset)) < bracketThick) ||
       (Math.abs(x - (cx + bOffset)) < bracketThick && Math.abs(y - (cy - bOffset)) < bracketSize) ||
       (Math.abs(x - (cx - bOffset)) < bracketSize && Math.abs(y - (cy + bOffset)) < bracketThick) ||
       (Math.abs(x - (cx - bOffset)) < bracketThick && Math.abs(y - (cy + bOffset)) < bracketSize) ||
       (Math.abs(x - (cx + bOffset)) < bracketSize && Math.abs(y - (cy + bOffset)) < bracketThick) ||
       (Math.abs(x - (cx + bOffset)) < bracketThick && Math.abs(y - (cy + bOffset)) < bracketSize));

    if (inCorners) {
      return [6, 182, 212, 255]; // Cyan reticle
    }

    // حلقة المسح الخارجية
    const ring1Radius = 155 * scale;
    if (Math.abs(distFromCenter - ring1Radius) < 3.5 * scale) {
      return [16, 185, 129, 230];
    }

    // حلقة المسح المتوسطة المنقطة
    const ring2Radius = 135 * scale;
    if (Math.abs(distFromCenter - ring2Radius) < 2 * scale) {
      const angle = Math.atan2(dy, dx);
      if (Math.sin(angle * 16) > 0) {
        return [52, 211, 153, 200];
      }
    }

    // إطار الوجه البيومتري (Oval Face Silhouette)
    const ovalX = dx / (78 * scale);
    const ovalY = (dy + 15 * scale) / (105 * scale);
    const ovalDist = Math.hypot(ovalX, ovalY);
    if (Math.abs(ovalDist - 1.0) < 0.05) {
      return [16, 185, 129, 255]; // Emerald face contour
    }

    // عينان بيومتريتان
    const eyeY = cy - 20 * scale;
    const eyeX1 = cx - 35 * scale;
    const eyeX2 = cx + 35 * scale;
    const dEye1 = Math.hypot(x - eyeX1, y - eyeY);
    const dEye2 = Math.hypot(x - eyeX2, y - eyeY);
    if (dEye1 < 9 * scale || dEye2 < 9 * scale) {
      return [34, 211, 238, 255]; // Cyan eye nodes
    }
    if (Math.abs(dEye1 - 15 * scale) < 2 * scale || Math.abs(dEye2 - 15 * scale) < 2 * scale) {
      return [16, 185, 129, 180];
    }

    // أنف بيومتري
    const dNose = Math.hypot(x - cx, y - (cy + 10 * scale));
    if (dNose < 5 * scale) {
      return [34, 211, 238, 240];
    }

    // فم بيومتري
    const mouthY = cy + 45 * scale;
    const dMouthX = Math.abs(x - cx);
    if (dMouthX < 26 * scale && Math.abs(y - mouthY) < 3 * scale) {
      return [52, 211, 153, 230];
    }

    // نقاط شبكة المسح البيومتري على الخدين والجبين
    const nodes = [
      [cx - 45 * scale, cy + 15 * scale],
      [cx + 45 * scale, cy + 15 * scale],
      [cx, cy - 60 * scale],
      [cx - 30 * scale, cy - 55 * scale],
      [cx + 30 * scale, cy - 55 * scale],
      [cx, cy + 70 * scale]
    ];
    for (const [nx, ny] of nodes) {
      const dn = Math.hypot(x - nx, y - ny);
      if (dn < 4 * scale) {
        return [34, 211, 238, 255];
      }
    }

    // خط الليزر الأفقي المتوهج للمسح
    const laserY = cy + 5 * scale;
    const dLaser = Math.abs(y - laserY);
    if (dLaser < 2.5 * scale && Math.abs(dx) < 110 * scale) {
      return [255, 255, 255, 255]; // Bright white laser core
    } else if (dLaser < 10 * scale && Math.abs(dx) < 110 * scale) {
      const laserAlpha = 1 - (dLaser / (10 * scale));
      return [
        Math.floor(6 * laserAlpha + r * (1 - laserAlpha)),
        Math.floor(182 * laserAlpha + g * (1 - laserAlpha)),
        Math.floor(212 * laserAlpha + b * (1 - laserAlpha)),
        255
      ];
    }

    return [r, g, b, a];
  };
}

console.log('Generating kiosk-icon-192.png...');
const png192 = createPng(192, 192, renderBiometricIcon(192));
fs.writeFileSync('public/kiosk-icon-192.png', png192);

console.log('Generating kiosk-icon-512.png...');
const png512 = createPng(512, 512, renderBiometricIcon(512));
fs.writeFileSync('public/kiosk-icon-512.png', png512);

console.log('Done generating Kiosk PWA icons successfully.');
