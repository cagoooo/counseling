// 產生 favicon、App 圖示與社群分享圖（OG）
// 用法（Windows，一次性產生後提交 PNG 即可）：
//   npm install
//   npm run gen:images
// 文字使用本機「微軟正黑體」，產物是點陣 PNG，部署後不依賴字型。
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import pngToIco from 'png-to-ico';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = resolve(ROOT, 'assets');
mkdirSync(ASSETS, { recursive: true });

GlobalFonts.registerFromPath('C:/Windows/Fonts/msjhbd.ttc', 'JhengHeiBold');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msjh.ttc', 'JhengHei');

const C = {
  bg: '#f6f2ea',
  primary: '#2f6f62',
  primarySoft: '#e3efe9',
  paper: '#fffaf2',
  accent: '#d9822b',
  accentSoft: '#fbeedd',
  heart: '#e05a4c',
  ink: '#2a2723',
  muted: '#6b645a',
  line: '#e4dccd',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 與 icon.svg 相同的圖形（64×64 座標系）
function drawGlyph(ctx) {
  ctx.fillStyle = C.paper;
  roundRect(ctx, 15, 11, 34, 42, 4);
  ctx.fill();
  ctx.fillStyle = C.accent;
  roundRect(ctx, 15, 11, 7, 42, 2);
  ctx.fill();
  ctx.strokeStyle = C.primary;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  [[28, 21, 43], [28, 28, 43], [28, 35, 35]].forEach(([x1, y, x2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  });
  ctx.fillStyle = C.heart;
  ctx.fill(new Path2D('M41 49c-3.2-2.3-6.5-4.6-6.5-7.4a3.2 3.2 0 0 1 6.5-.7 3.2 3.2 0 0 1 6.5.7c0 2.8-3.3 5.1-6.5 7.4z'));
}

function drawIcon(ctx, x, y, size, { maskable = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.fillStyle = C.primary;
  if (maskable) {
    ctx.fillRect(0, 0, 64, 64);
    // 安全區：主圖縮到 80%，置中
    ctx.translate(32, 32);
    ctx.scale(0.8, 0.8);
    ctx.translate(-32, -32);
  } else {
    roundRect(ctx, 0, 0, 64, 64, 14);
    ctx.fill();
  }
  drawGlyph(ctx);
  ctx.restore();
}

function iconPng(size, opts) {
  const canvas = createCanvas(size, size);
  drawIcon(canvas.getContext('2d'), 0, 0, size, opts);
  return canvas.toBuffer('image/png');
}

function writeIcon(name, size, opts) {
  const p = resolve(ROOT, name);
  writeFileSync(p, iconPng(size, opts));
  return p;
}

// ---------- 圖示全套 ----------
const icoParts = [16, 32, 48].map((s) => writeIcon(`assets/favicon-${s}.png`, s));
writeFileSync(resolve(ROOT, 'favicon.ico'), await pngToIco(icoParts));
writeIcon('apple-touch-icon.png', 180);
writeIcon('assets/icon-192.png', 192);
writeIcon('assets/icon-512.png', 512);
writeIcon('assets/icon-192-maskable.png', 192, { maskable: true });
writeIcon('assets/icon-512-maskable.png', 512, { maskable: true });
copyFileSync(resolve(ROOT, 'icon.svg'), resolve(ROOT, 'favicon.svg'));

// ---------- 社群分享圖 1200×630 ----------
const W = 1200;
const H = 630;
const og = createCanvas(W, H);
const ctx = og.getContext('2d');

ctx.fillStyle = C.bg;
ctx.fillRect(0, 0, W, H);
// 背景裝飾圓
ctx.fillStyle = C.primarySoft;
ctx.beginPath(); ctx.arc(1080, 40, 260, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = C.accentSoft;
ctx.beginPath(); ctx.arc(-40, 640, 220, 0, Math.PI * 2); ctx.fill();

// 左欄：圖示＋標題
drawIcon(ctx, 80, 80, 104);
ctx.fillStyle = C.muted;
ctx.font = '26px JhengHei';
ctx.textBaseline = 'alphabetic';
ctx.fillText('國小老師的輔導紀錄撰寫工具', 206, 142);

ctx.fillStyle = C.ink;
ctx.font = '86px JhengHeiBold';
ctx.fillText('輔導紀錄小幫手', 76, 292);

ctx.fillStyle = C.primary;
ctx.font = '34px JhengHeiBold';
ctx.fillText('口語描述或點選標籤，', 80, 356);
ctx.fillText('整理成正式輔導紀錄', 80, 402);

// 特色膠囊
ctx.font = '24px JhengHeiBold';
let px = 80;
['姓名自動去識別化', '常見狀況標籤庫', '座號批次補登'].forEach((t) => {
  const w = ctx.measureText(t).width + 36;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, px, 440, w, 48, 24);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.fillText(t, px + 18, 473);
  px += w + 12;
});

// 網址膠囊與署名
ctx.font = '22px JhengHeiBold';
const url = 'cagoooo.github.io/counseling';
const uw = ctx.measureText(url).width + 48;
ctx.fillStyle = C.primary;
roundRect(ctx, 80, 530, uw, 52, 26);
ctx.fill();
ctx.fillStyle = '#ffffff';
ctx.fillText(url, 104, 564);
ctx.fillStyle = C.muted;
ctx.font = '22px JhengHei';
ctx.fillText('桃園市石門國小 阿凱老師', 80 + uw + 22, 564);

// 右欄：紀錄卡片示意
ctx.save();
ctx.translate(950, 318);
ctx.rotate((2.5 * Math.PI) / 180);
const cw = 330;
const ch = 440;
ctx.shadowColor = 'rgba(60, 40, 10, 0.18)';
ctx.shadowBlur = 40;
ctx.shadowOffsetY = 16;
ctx.fillStyle = '#ffffff';
roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 24);
ctx.fill();
ctx.shadowColor = 'transparent';

const cx = -cw / 2 + 30;
let cy = -ch / 2 + 84;
function bars(n, lastRatio) {
  for (let i = 0; i < n; i += 1) {
    const w = (cw - 60) * (i === n - 1 ? lastRatio : 1);
    ctx.fillStyle = '#ece6da';
    roundRect(ctx, cx, cy, w, 12, 6);
    ctx.fill();
    cy += 26;
  }
}
ctx.fillStyle = C.primary;
ctx.font = '24px JhengHeiBold';
ctx.fillText('輔導內容重點', cx, cy);
cy += 24;
bars(2, 0.6);
cy += 22;
ctx.fillStyle = C.primary;
ctx.fillText('聯繫內容', cx, cy);
cy += 24;
bars(6, 0.45);
cy += 8;
ctx.fillStyle = C.primary;
roundRect(ctx, cx, cy, 150, 46, 12);
ctx.fill();
ctx.fillStyle = '#ffffff';
ctx.font = '21px JhengHeiBold';
ctx.fillText('複製全部', cx + 33, cy + 30);
ctx.restore();

// 卡片上的「AI 整理」貼紙
ctx.save();
ctx.translate(788, 64);
ctx.rotate((-8 * Math.PI) / 180);
ctx.fillStyle = C.accent;
roundRect(ctx, 0, 0, 132, 48, 24);
ctx.fill();
ctx.fillStyle = '#ffffff';
ctx.font = '24px JhengHeiBold';
ctx.fillText('AI 整理', 26, 33);
ctx.restore();

writeFileSync(resolve(ROOT, 'og-image.png'), og.toBuffer('image/png'));
console.log('✓ 已產生 favicon.ico / favicon.svg / apple-touch-icon.png / assets/icon-* / og-image.png');
