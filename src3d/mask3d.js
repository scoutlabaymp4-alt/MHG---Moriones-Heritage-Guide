/* MHG - original procedural 3D Morion mask (Three.js, MIT).
 * Everything here is generated in code. No photo, scan or 3D file is embedded or traced.
 * v2 (Nov 2026): proportions, face and helmets were reworked after the group studied photographs of three
 * Moriones masks on the Mask Museum website (maskmuseum.org: "moriones-1", "moriones-2", "moriones-longino")
 * and the descriptions cited in the app. The three STYLES below are simplified, original interpretations of
 * what those photos show in common (wide-eyed painted face, beard, ears, helmet with brim band, cheek
 * plates, crest or flowers). They are not exact copies of any one object.
 * Exposes window.MHGMask = { supported(), create(container, options), styles }. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, SphereGeometry,
  TorusGeometry, CylinderGeometry, ConeGeometry, BoxGeometry, BufferGeometry, Float32BufferAttribute,
  MeshStandardMaterial, DirectionalLight, HemisphereLight, Color, Vector3, Quaternion, CanvasTexture,
  SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, BackSide, DoubleSide, PMREMGenerator,
  CatmullRomCurve3, Object3D, LinearFilter, RepeatWrapping, Shape, Path, ExtrudeGeometry, LatheGeometry, Vector2
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* ---------- small helpers ---------- */
function rng(seed) { // mulberry32: deterministic, so the model looks the same every time
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
function gauss(x, y, cx, cy, rx, ry, amp) {
  var dx = (x - cx) / rx, dy = (y - cy) / ry;
  return amp * Math.exp(-(dx * dx + dy * dy));
}
function segDist(px, py, ax, ay, bx, by) { // distance to segment + position along it (0..1)
  var vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  var t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
  var dx = px - (ax + vx * t), dy = py - (ay + vy * t);
  return { d: Math.sqrt(dx * dx + dy * dy), t: t };
}
function lerp(a, b, t) { return a + (b - a) * t; }
var PI = Math.PI, TAU = Math.PI * 2;

/* ---------- head: a closed shell, wide at the cheeks, narrowing to the chin ---------- */
var Y0 = -1.05, YT = 0.95;               // chin .. top of the skull (hidden under the helmet)
function rnd(y) { return Math.sqrt(clamp((y - Y0) / 0.34, 0, 1)) * Math.sqrt(clamp((YT - y) / 0.35, 0, 1)); }
function halfW(y) { return 0.70 * (1 - 0.66 * Math.pow(clamp((-0.02 - y) / 1.0, 0, 1), 1.5)) * rnd(y); }
function zFront(y) { return (0.60 - 0.2 * Math.pow(clamp((-y - 0.15) / 0.9, 0, 1), 1.4)) * rnd(y); }
function zBack(y) { return 0.62 * rnd(y); }
function headPt(phi, y) { // phi = 0 is straight ahead; returns the plain shell point (no carving)
  var c = Math.cos(phi), s = Math.sin(phi), e = Math.pow(Math.abs(c), 1.24);
  return { x: halfW(y) * s, z: (c >= 0 ? zFront(y) : -zBack(y)) * e };
}
function mouthY(ax) { return -0.69 - 0.45 * ax * ax; }

function baseZ(x, y) {
  var w = Math.max(halfW(y), 0.0001), q = clamp(x / w, -1, 1);
  return zFront(y) * Math.pow(Math.max(1 - q * q, 0), 0.62);
}
function beardMask(x, y) {
  var ax = Math.abs(x), w = Math.max(halfW(y), 0.001), my = mouthY(ax);
  var jaw = smooth(my - 0.05, my - 0.15, y);
  var side = smooth(0.78, 0.97, ax / w) * smooth(0.12, -0.3, y) * smooth(-0.95, -0.7, y + 0.2) ;
  return clamp(Math.max(jaw, side * 0.9), 0, 1);
}
function curl(x, y) { return Math.abs(Math.sin(15 * x + 2.6 * Math.sin(12 * y)) * Math.sin(17 * y + 2.4 * Math.sin(10 * x))); }

function features(x, y) { // carved details added to the plain shell
  var ax = Math.abs(x), z = 0, d, my = mouthY(ax);
  // brows: a heavy ridge, inner end low (a scowl), arching over the eye
  d = segDist(ax, y, 0.06, 0.14, 0.30, 0.215); var d2 = segDist(ax, y, 0.30, 0.215, 0.56, 0.18);
  var bd = Math.min(d.d, d2.d);
  z += 0.095 * Math.exp(-Math.pow(bd / 0.058, 2));
  // eye sockets (the eyeballs sit in them)
  z += gauss(ax, y, 0.30, 0.04, 0.2, 0.115, -0.075);
  // nose: bridge, tip, wings, nostrils
  d = segDist(ax, y, 0, 0.13, 0, -0.38);
  z += 0.13 * Math.exp(-Math.pow(d.d / (0.042 + 0.032 * d.t), 2));
  z += gauss(ax, y, 0, -0.43, 0.1, 0.082, 0.12);
  z += gauss(ax, y, 0.125, -0.43, 0.058, 0.052, 0.085);
  z += gauss(ax, y, 0.068, -0.495, 0.034, 0.022, -0.06);
  // cheekbones, hollows, nose-to-mouth lines
  z += gauss(ax, y, 0.46, -0.17, 0.22, 0.15, 0.085);
  z += gauss(ax, y, 0.44, -0.58, 0.19, 0.17, -0.04);
  d = segDist(ax, y, 0.17, -0.4, 0.36, -0.66);
  z -= 0.03 * Math.exp(-Math.pow(d.d / 0.024, 2));
  // lips, open mouth, chin
  var lipW = clamp(1 - Math.pow(ax / 0.23, 3), 0, 1);
  z += gauss(ax, y, 0, my + 0.055, 0.2, 0.035, 0.05) * lipW;
  z += gauss(ax, y, 0, my - 0.07, 0.17, 0.04, 0.055) * lipW;
  z -= 0.085 * Math.exp(-Math.pow((y - my) / 0.03, 2)) * clamp(1 - Math.pow(ax / 0.17, 4), 0, 1);
  z += gauss(ax, y, 0, -0.93, 0.2, 0.12, 0.085);
  z -= gauss(ax, y, 0, my - 0.17, 0.12, 0.025, 0.025);
  // frown furrow between the brows
  z -= gauss(ax, y, 0.05, 0.22, 0.025, 0.1, 0.035);
  // carved curls in the beard
  z += beardMask(x, y) * (0.012 + 0.03 * curl(x, y));
  return z;
}
function zAt(x, y) { return baseZ(x, y) + features(x, y) * clamp(baseZ(x, y) / 0.18, 0, 1); }

/* ---------- the three styles (simplified, original interpretations of what the reference photos show) ---------- */
var STYLES = {
  red: {
    id: 'red', skin: '#e3a47c', shade: '#9a5a38', blush: '#cf4f38', lip: '#b3221b', brow: '#120b08', beard: '#0d0908',
    iris: '#2c1b11', white: '#f6f2ea', rough: 0.3, dome: '#8c150e', domeRough: 0.3, domeMetal: 0.1, zoom: 1.0, lift: -0.18
  },
  black: {
    id: 'black', skin: '#f0c9a8', shade: '#a8704f', blush: '#e08278', lip: '#cf3b34', brow: '#17100d', beard: '#241813',
    iris: '#4b86a6', white: '#f7f3ea', rough: 0.26, dome: '#0b0a0c', domeRough: 0.16, domeMetal: 0.3, zoom: 1.05, lift: -0.3
  },
  woven: {
    id: 'woven', skin: '#e8cf98', shade: '#9a7a4a', blush: '#e0a088', lip: '#d98a74', brow: '#1a120e', beard: '#2f241c',
    iris: '#4a2f1e', white: '#f1ebd8', rough: 0.5, dome: '#5a3f29', domeRough: 0.85, domeMetal: 0, zoom: 1.14, lift: -0.5, ownFlowers: true
  }
};
var HAIR = new Color('#15100e');

var tmpC = new Color(), cSkin = new Color(), cShade = new Color(), cBlush = new Color(), cLip = new Color(), cBrow = new Color(), cBeard = new Color();
function paint(x, y, z, S, out) {
  var ax = Math.abs(x), w = Math.max(halfW(y), 0.001), t, my = mouthY(ax);
  cSkin.set(S.skin); cShade.set(S.shade); cBlush.set(S.blush); cLip.set(S.lip); cBrow.set(S.brow); cBeard.set(S.beard);
  out.copy(cSkin);
  // very subtle mottling so the paint does not look flat
  out.multiplyScalar(0.97 + 0.05 * Math.sin(x * 37 + Math.sin(y * 23) * 2));
  // blush on the cheekbones, a little on the nose tip and brow bone
  t = gauss(ax, y, 0.47, -0.2, 0.21, 0.16, 0.55); out.lerp(cBlush, clamp(t, 0, 0.8));
  t = gauss(ax, y, 0, -0.43, 0.09, 0.07, 0.3); out.lerp(cBlush, clamp(t, 0, 0.5));
  // cavities get darker (cheap ambient occlusion)
  var carve = z - baseZ(x, y);
  if (carve < 0) out.lerp(cShade, clamp(-carve * 5, 0, 0.6));
  // eyelid shadow
  t = gauss(ax, y, 0.3, 0.1, 0.2, 0.06, 0.45); out.lerp(cShade, clamp(t, 0, 0.5));
  // brows
  var d1 = segDist(ax, y, 0.06, 0.14, 0.30, 0.215), d2 = segDist(ax, y, 0.30, 0.215, 0.56, 0.18);
  t = 1 - smooth(0.04, 0.085, Math.min(d1.d, d2.d)); out.lerp(cBrow, t);
  // lips
  var lipW = clamp(1 - Math.pow(ax / 0.23, 3), 0, 1);
  t = Math.exp(-Math.pow((y - (my - 0.0)) / 0.075, 2)) * lipW; out.lerp(cLip, clamp(t * 0.95, 0, 1));
  // inside of the mouth
  t = Math.exp(-Math.pow((y - my) / 0.03, 2)) * clamp(1 - Math.pow(ax / 0.17, 4), 0, 1); out.lerp(tmpC.set('#1b0807'), clamp(t * 1.2, 0, 0.97));
  // nostrils
  t = gauss(ax, y, 0.068, -0.495, 0.036, 0.024, 1); out.lerp(tmpC.set('#1a0c08'), clamp(t, 0, 0.9));
  // beard, sideburns
  t = beardMask(x, y); out.lerp(cBeard, t * 0.97);
  // curl highlights in the beard
  if (t > 0.5) out.multiplyScalar(0.8 + 0.5 * curl(x, y));
  // hair above the forehead (visible only when the helmet is switched off)
  t = smooth(0.4, 0.58, y + 0.04 * Math.sin(x * 9)); out.lerp(HAIR, t);
  return out;
}

/* ---------- textures ---------- */
function canvasTex(w, h, draw, rx, ry) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  var tx = new CanvasTexture(c);
  tx.colorSpace = SRGBColorSpace; tx.wrapS = tx.wrapT = RepeatWrapping; tx.anisotropy = 4; tx.minFilter = LinearFilter;
  if (rx) tx.repeat.set(rx, ry || rx);
  return tx;
}
function weaveTexture(seed, base, tones) {
  return canvasTex(256, 256, function (g, W, H) {
    var r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (var y = 0; y < H; y += 5) {
      for (var x = -8; x < W; x += 9) {
        g.strokeStyle = tones[Math.floor(r() * tones.length)]; g.lineWidth = 2 + r() * 1.6;
        var o = (y / 5) % 2 ? 4 : 0, sl = (r() - 0.5) * 2.4;
        g.beginPath(); g.moveTo(x + o, y); g.lineTo(x + o + 8, y + sl); g.stroke();
      }
    }
  }, 1, 1);
}
function goldScrollTexture() { // gold scrolls on black, used on the brim band and cheek plates of the black style
  return canvasTex(1024, 192, function (g, W, H) {
    g.fillStyle = '#0c0a09'; g.fillRect(0, 0, W, H);
    function spiral(cx, cy, r0, dir, turns, wd) {
      var n = 90, prev = null;
      for (var i = 0; i <= n; i++) {
        var t = i / n, a = dir * t * turns * TAU, r = r0 * (1 - 0.92 * t), p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        if (prev) {
          g.lineWidth = wd * (1 - 0.8 * t) + 1; g.strokeStyle = '#c4a24b'; g.lineCap = 'round';
          g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke();
          g.lineWidth = Math.max(1, wd * 0.28 * (1 - t)); g.strokeStyle = '#f0dc9a';
          g.beginPath(); g.moveTo(prev[0] - 1, prev[1] - 1); g.lineTo(p[0] - 1, p[1] - 1); g.stroke();
        }
        prev = p;
      }
    }
    for (var k = 0; k < 4; k++) {
      var cx = k * 256 + 128;
      spiral(cx - 52, 96, 62, 1, 1.35, 22); spiral(cx + 52, 96, 62, -1, 1.35, 22);
      g.fillStyle = '#c4a24b'; g.beginPath(); g.ellipse(cx, 96, 22, 38, 0, 0, TAU); g.fill();
      g.fillStyle = '#f0dc9a'; g.beginPath(); g.ellipse(cx - 4, 88, 7, 18, 0, 0, TAU); g.fill();
      g.strokeStyle = '#c4a24b'; g.lineWidth = 8; g.beginPath(); g.arc(cx, 190, 70, PI * 1.1, PI * 1.9); g.stroke();
      g.beginPath(); g.arc(cx, 2, 70, PI * 0.1, PI * 0.9); g.stroke();
    }
  }, 1, 1);
}

/* ---------- geometry builders ---------- */
function headGeometry(S) {
  var NJ = 150, side = 14, front = 120, phis = [], i, j;
  for (i = 0; i < side; i++) phis.push(-PI + (PI / 2) * i / side);
  for (i = 0; i < front; i++) phis.push(-PI / 2 + PI * i / front);
  for (i = 0; i < side; i++) phis.push(PI / 2 + (PI / 2) * i / side);
  var NI = phis.length, n = (NJ + 1) * NI, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), o = new Color();
  for (j = 0; j <= NJ; j++) {
    var y = Y0 + (YT - Y0) * j / NJ;
    for (i = 0; i < NI; i++) {
      var phi = phis[i], c = Math.cos(phi), p = headPt(phi, y), x = p.x, z = p.z, k = j * NI + i;
      if (c > 0) z += features(x, y) * clamp(z / 0.18, 0, 1);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = i / NI; uv[k * 2 + 1] = j / NJ;
      if (c > 0) paint(x, y, z, S, o); else o.copy(HAIR);
      col[k * 3] = o.r; col[k * 3 + 1] = o.g; col[k * 3 + 2] = o.b;
    }
  }
  var idx = [];
  for (j = 0; j < NJ; j++) for (i = 0; i < NI; i++) {
    var a = j * NI + i, b = j * NI + (i + 1) % NI, cc = (j + 1) * NI + i, d = (j + 1) * NI + (i + 1) % NI;
    idx.push(a, b, cc, b, d, cc);
  }
  var g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function onFace(x, y, lift) { var lim = 0.92 * halfW(y); x = clamp(x, -lim, lim); return new Vector3(x, y, zAt(x, y) + lift); }

function taperTube(points, radiusFn, seg, radial) {
  var curve = new CatmullRomCurve3(points), fr = curve.computeFrenetFrames(seg, false);
  var pos = [], idx = [], i, j;
  for (i = 0; i <= seg; i++) {
    var t = i / seg, p = curve.getPointAt(t), r = radiusFn(t);
    for (j = 0; j < radial; j++) {
      var a = j / radial * TAU, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(p.x + (fr.normals[i].x * ca + fr.binormals[i].x * sa) * r, p.y + (fr.normals[i].y * ca + fr.binormals[i].y * sa) * r,
        p.z + (fr.normals[i].z * ca + fr.binormals[i].z * sa) * r);
    }
  }
  for (i = 0; i < seg; i++) for (j = 0; j < radial; j++) {
    var a0 = i * radial + j, b0 = i * radial + (j + 1) % radial, c0 = (i + 1) * radial + (j + 1) % radial, d0 = (i + 1) * radial + j;
    idx.push(a0, b0, d0, b0, c0, d0);
  }
  var g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* many thin tapered hairs as one InstancedMesh. list = [{p, dir, len, color}] */
function hairMesh(list, material, baseR, tipR) {
  var geo = new CylinderGeometry(tipR, baseR, 1, 5, 1, true);
  geo.translate(0, 0.5, 0);
  var m = new InstancedMesh(geo, material, list.length), o = new Object3D(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  list.forEach(function (h, i) {
    q.setFromUnitVectors(up, h.dir.clone().normalize());
    o.position.copy(h.p); o.quaternion.copy(q); o.scale.set(1, h.len, 1); o.updateMatrix();
    m.setMatrixAt(i, o.matrix); m.setColorAt(i, h.color);
  });
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false;
  return m;
}
/* the same idea for solid little shapes (scallops, teeth, rivets): list = [{p, n (up direction), s (scale)}] */
function shapesAt(geo, material, list) {
  var m = new InstancedMesh(geo, material, list.length), o = new Object3D(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  list.forEach(function (h, i) {
    q.setFromUnitVectors(up, h.n.clone().normalize());
    o.position.copy(h.p); o.quaternion.copy(q); o.scale.setScalar(h.s || 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
  });
  m.instanceMatrix.needsUpdate = true; m.castShadow = true; m.frustumCulled = false;
  return m;
}

/* ---------- helmet dome: an ellipsoid whose lower edge dips at the back to cover the nape ---------- */
var D = { cy: 0.12, cz: -0.04, rx: 0.88, ry: 0.93, rz: 0.84 };
function thetaEdge(phi) { var c = Math.cos(phi); return 0.04 + 0.2 * Math.max(c, 0) - 0.42 * Math.pow(Math.max(-c, 0), 1.3); }
function dnorm(phi, th) { var c = Math.cos(th); return new Vector3(c * Math.sin(phi) / D.rx, Math.sin(th) / D.ry, c * Math.cos(phi) / D.rz).normalize(); }
function dpos(phi, th, off) {
  var c = Math.cos(th), p = new Vector3(D.rx * c * Math.sin(phi), D.cy + D.ry * Math.sin(th), D.cz + D.rz * c * Math.cos(phi));
  if (off) p.addScaledVector(dnorm(phi, th), off);
  return p;
}
function domeGeometry() {
  var NI = 120, NJ = 44, pos = [], uv = [], idx = [], i, j;
  for (j = 0; j <= NJ; j++) for (i = 0; i < NI; i++) {
    var phi = -PI + TAU * i / NI, te = thetaEdge(phi), th = te + (PI / 2 - te) * (j / NJ), p = dpos(phi, th, 0);
    pos.push(p.x, p.y, p.z); uv.push(i / NI * 3, j / NJ * 2);
  }
  for (j = 0; j < NJ; j++) for (i = 0; i < NI; i++) {
    var a = j * NI + i, b = j * NI + (i + 1) % NI, c = (j + 1) * NI + i, d = (j + 1) * NI + (i + 1) % NI;
    idx.push(a, b, c, b, d, c);
  }
  var g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* a ribbon lying on the dome between two heights: lo(phi), hi(phi) are elevation angles, off(phi) the lift */
function bandGeometry(pA, pB, lo, hi, off, nU, nV, uRep) {
  var pos = [], uv = [], idx = [], i, j;
  for (j = 0; j <= nV; j++) for (i = 0; i <= nU; i++) {
    var phi = lerp(pA, pB, i / nU), th = lerp(lo(phi), hi(phi), j / nV), p = dpos(phi, th, off(phi));
    pos.push(p.x, p.y, p.z); uv.push(i / nU * (uRep || 1), j / nV);
  }
  for (j = 0; j < nV; j++) for (i = 0; i < nU; i++) {
    var a = j * (nU + 1) + i, b = a + 1, c = a + nU + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  var g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* a cheek plate: a ribbon that hugs the face in front of the ear, from the helmet edge down along the jaw */
function plateGeometry(side, y0, y1, ph0, ph1, hw0, hw1, lift, nU, nV) {
  var pos = [], uv = [], idx = [], i, j;
  for (j = 0; j <= nV; j++) for (i = 0; i <= nU; i++) {
    var t = i / nU, y = lerp(y0, y1, t), phc = lerp(ph0, ph1, t), hw = lerp(hw0, hw1, Math.pow(t, 0.8));
    var phi = side * (phc + hw * (j / nV - 0.5) * 2), p = headPt(phi, y);
    var n = new Vector3(Math.sin(phi), 0, Math.cos(phi) * 0.95).normalize();
    pos.push(p.x + n.x * lift, y, p.z + n.z * lift); uv.push(j / nV, t);
  }
  for (j = 0; j < nV; j++) for (i = 0; i < nU; i++) {
    var a = j * (nU + 1) + i, b = a + 1, c = a + nU + 1, d = c + 1;
    if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  var g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* the crest comb: a flat plate standing on the dome from front to back, with an arch-shaped opening */
var CR = { a0: 0.66, a1: PI + 0.02 };
function mer(a) { return new Vector3(0, D.cy + D.ry * Math.sin(a), D.cz + D.rz * Math.cos(a)); }
function merN(a) { return new Vector3(0, Math.sin(a) / D.ry, Math.cos(a) / D.rz).normalize(); }
function merT(a) { return new Vector3(0, D.ry * Math.cos(a), -D.rz * Math.sin(a)).normalize(); }
function combGeometry(hmax, hole) {
  // arclength table
  var N = 160, tab = [0], i, L = 0, prev = mer(CR.a0);
  for (i = 1; i <= N; i++) { var p = mer(lerp(CR.a0, CR.a1, i / N)); L += p.distanceTo(prev); tab.push(L); prev = p; }
  function alphaAt(u) { var k = 0; while (k < N - 1 && tab[k + 1] < u) k++; var f = (u - tab[k]) / Math.max(tab[k + 1] - tab[k], 1e-6); return lerp(CR.a0, CR.a1, (k + f) / N); }
  function hAt(u) { var s = u / L; return 0.07 + hmax * Math.pow(Math.sin(PI * clamp(s, 0, 1)), 0.7); }
  var sh = new Shape(), steps = 90;
  sh.moveTo(0, 0);
  for (i = 1; i <= steps; i++) sh.lineTo(L * i / steps, 0);
  for (i = steps; i >= 0; i--) { var u = L * i / steps; sh.lineTo(u, hAt(u)); }
  if (hole) {
    var h = new Path(), cu = L * hole.u, rw = L * hole.w, base = 0.045, top = hAt(cu) * hole.h;
    h.moveTo(cu - rw, base);
    for (i = 0; i <= 24; i++) { var a = PI - PI * i / 24; h.lineTo(cu + Math.cos(a) * rw, base + (top - base) * Math.sin(a)); }
    h.lineTo(cu + rw, base); h.lineTo(cu - rw, base);
    sh.holes.push(h);
  }
  var g = new ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false, curveSegments: 4, steps: 1 });
  var pa = g.attributes.position, v = new Vector3();
  for (i = 0; i < pa.count; i++) {
    var u2 = pa.getX(i), h2 = pa.getY(i), w2 = pa.getZ(i), al = alphaAt(u2);
    v.copy(mer(al)).addScaledVector(merN(al), h2 - 0.02); v.x = w2 - 0.03;
    pa.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.userData = { L: L, alphaAt: alphaAt, hAt: hAt };
  return g;
}

/* ---------- the model ---------- */
function build(styleKey) {
  var S = STYLES[styleKey] || STYLES.red, R = rng(20261111 + styleKey.length * 7), disposables = [], parts = { mask: [], crest: [] };
  var root = new Group(), maskGroup = new Group(), helmetGroup = new Group(), flowerGroup = new Group();
  root.add(maskGroup, helmetGroup, flowerGroup);
  function track(o) { disposables.push(o); return o; }
  function std(opts) { return track(new MeshStandardMaterial(opts)); }
  var i, s;

  /* head shell */
  var faceMat = std({ vertexColors: true, roughness: S.rough, metalness: 0 });
  var face = new Mesh(track(headGeometry(S)), faceMat); face.castShadow = face.receiveShadow = true;
  maskGroup.add(face); parts.mask.push(faceMat);

  /* ears */
  var skinMat = std({ color: S.skin, roughness: S.rough + 0.1 }), earInMat = std({ color: S.shade, roughness: 0.7 });
  var earGeo = track(new SphereGeometry(1, 24, 16));
  [-1, 1].forEach(function (sd) {
    var ear = new Mesh(earGeo, skinMat); ear.scale.set(0.055, 0.2, 0.12);
    ear.position.set(sd * (halfW(-0.02) + 0.02), -0.04, -0.08); ear.rotation.set(0, sd * 0.45, sd * 0.1); ear.castShadow = true;
    var inner = new Mesh(earGeo, earInMat); inner.scale.set(0.035, 0.12, 0.07);
    inner.position.set(sd * (halfW(-0.02) + 0.045), -0.04, -0.07); inner.rotation.copy(ear.rotation);
    var lobe = new Mesh(earGeo, skinMat); lobe.scale.set(0.05, 0.05, 0.05); lobe.position.set(sd * (halfW(-0.02) + 0.02), -0.2, -0.04);
    maskGroup.add(ear, inner, lobe);
  });
  parts.mask.push(skinMat);

  /* eyes: wet-looking eyeballs with painted iris and pupil, lids, lashes */
  var whiteMat = std({ color: S.white, roughness: 0.14, metalness: 0 });
  var irisMat = std({ color: S.iris, roughness: 0.12 }), pupilMat = std({ color: '#050303', roughness: 0.1 });
  var lidMat = std({ color: S.shade, roughness: S.rough + 0.15 }), lashLine = std({ color: S.brow, roughness: 0.5 });
  var ballGeo = track(new SphereGeometry(1, 32, 24)), ER = 0.108;
  var irisGeo = track(new SphereGeometry(ER * 1.003, 28, 8, 0, TAU, 0, Math.asin(0.62))), pupGeo = track(new SphereGeometry(ER * 1.006, 24, 6, 0, TAU, 0, Math.asin(0.3)));
  var lidGeo = track(new TorusGeometry(1, 0.13, 10, 40)), upperLidGeo = track(new TorusGeometry(1, 0.17, 10, 24, PI));
  var lashes = [];
  [-1, 1].forEach(function (sd) {
    var ex = 0.3, ey = 0.04, ez = zAt(ex, ey), ball = new Mesh(ballGeo, whiteMat);
    ball.scale.setScalar(ER); ball.position.set(sd * ex, ey, ez - 0.03); maskGroup.add(ball);
    var iris = new Mesh(irisGeo, irisMat), pup = new Mesh(pupGeo, pupilMat);
    [iris, pup].forEach(function (m) { m.rotation.x = PI / 2; m.position.copy(ball.position); m.rotation.y = -sd * 0.05; maskGroup.add(m); });
    var lid = new Mesh(lidGeo, lidMat); lid.scale.set(0.15, 0.1, 0.1); lid.position.set(sd * ex, ey - 0.004, ez + 0.012); lid.rotation.z = sd * -0.1; maskGroup.add(lid);
    var up = new Mesh(upperLidGeo, lashLine); up.scale.set(0.155, 0.105, 0.1); up.position.set(sd * ex, ey + 0.002, ez + 0.016); up.rotation.z = sd * -0.1; maskGroup.add(up);
    for (var k = 0; k < 26; k++) { // lashes along the upper lid
      var a = PI * (0.04 + 0.92 * k / 25), px = sd * (ex + Math.cos(a) * 0.158 * (sd > 0 ? 1 : 1)), py = ey + 0.004 + Math.sin(a) * 0.108 - Math.cos(a) * 0.01 * sd * -1;
      lashes.push({ p: new Vector3(sd * ex + sd * Math.cos(a) * 0.158 * (sd > 0 ? 1 : 1) * 1, py, ez + 0.03), dir: new Vector3(sd * Math.cos(a) * 0.7, Math.sin(a) + 0.2, 0.45), len: 0.06 + R() * 0.05, color: new Color(S.brow) });
    }
  });
  parts.mask.push(whiteMat, lidMat);
  var hairMat = std({ color: '#ffffff', roughness: 0.6, metalness: 0, side: DoubleSide });
  maskGroup.add(hairMesh(lashes, hairMat, 0.006, 0.002));
  /* brow hair: short bristles along the carved brow */
  var brows = [];
  [-1, 1].forEach(function (sd) {
    for (var k = 0; k < 110; k++) {
      var t = R(), seg2 = t < 0.45, tt = seg2 ? t / 0.45 : (t - 0.45) / 0.55;
      var ax = seg2 ? lerp(0.06, 0.30, tt) : lerp(0.30, 0.56, tt), ay = seg2 ? lerp(0.14, 0.215, tt) : lerp(0.215, 0.18, tt);
      ax += (R() - 0.5) * 0.02; ay += (R() - 0.5) * 0.05;
      brows.push({ p: onFace(sd * ax, ay, 0.04), dir: new Vector3(sd * (0.35 + R() * 0.3), 0.55 + R() * 0.3, 0.45), len: 0.05 + R() * 0.045, color: new Color(S.brow) });
    }
  });
  maskGroup.add(hairMesh(brows, hairMat, 0.008, 0.002));

  /* open mouth: two rows of teeth */
  var toothMat = std({ color: '#f4efe4', roughness: 0.2 }), toothGeo = track(new SphereGeometry(1, 12, 8));
  var teeth = []; [1, -1].forEach(function (row) {
    for (var t = -3; t <= 3; t++) {
      var tx = t * 0.043, my2 = mouthY(Math.abs(tx)), ty = my2 + row * 0.014 + (row > 0 ? 0.006 : -0.004);
      var tm = new Mesh(toothGeo, toothMat); tm.scale.set(0.02, 0.019, 0.012); tm.position.set(tx, ty, zAt(tx, my2) + 0.004); maskGroup.add(tm);
    }
  });
  parts.mask.push(toothMat);

  /* moustache: two tapered tubes sweeping out and down */
  var staMat = std({ color: S.beard, roughness: 0.35, metalness: 0.1 });
  [-1, 1].forEach(function (sd) {
    var pts = [onFace(0.0, -0.575, 0.05), onFace(sd * 0.09, -0.585, 0.065), onFace(sd * 0.22, -0.625, 0.07), onFace(sd * 0.33, -0.7, 0.07),
      onFace(sd * 0.39, -0.8, 0.06), onFace(sd * 0.39, -0.9, 0.045)];
    var m = new Mesh(track(taperTube(pts, function (t) { return 0.012 + 0.04 * Math.sin(Math.min(1, 0.25 + t * 3)) * Math.pow(1 - t, 0.5); }, 36, 10)), staMat);
    m.castShadow = true; maskGroup.add(m);
  });
  parts.mask.push(staMat);

  /* ---------- helmet ---------- */
  var domeMat = std({ color: S.dome, roughness: S.domeRough, metalness: S.domeMetal, side: DoubleSide });
  var domeInMat = std({ color: '#241812', roughness: 0.95, side: BackSide });
  var domeGeo = track(domeGeometry());
  var weaveTex = null;
  if (S.id === 'woven') {
    weaveTex = track(weaveTexture(11, '#5c4029', ['#6e4d30', '#4a3321', '#7d5a38', '#3e2a1a']));
    weaveTex.repeat.set(9, 7); domeMat.map = weaveTex; domeMat.bumpMap = weaveTex; domeMat.bumpScale = 2.2; domeMat.color.set('#ffffff');
  }
  var dome = new Mesh(domeGeo, domeMat); dome.castShadow = dome.receiveShadow = true;
  var domeIn = new Mesh(domeGeo, domeInMat);
  helmetGroup.add(dome, domeIn); parts.crest.push(domeMat);
  var gold = std({ color: '#c9a24a', roughness: 0.28, metalness: 0.9 });
  var oliveGold = std({ color: '#9a8a3c', roughness: 0.4, metalness: 0.7, side: DoubleSide });
  var whiteMat2 = std({ color: '#f3efe6', roughness: 0.4, side: DoubleSide });
  var frontLift = function (phi) { return 0.032 + 0.03 * Math.max(Math.cos(phi), 0); };

  if (S.id === 'red') {
    /* brim band: broad gold plate with a white scalloped top edge and a white lower line (photos: moriones-1) */
    var lo1 = function (phi) { return thetaEdge(phi) + 0.01; }, hi1 = function (phi) { return thetaEdge(phi) + 0.37; };
    var band = new Mesh(track(bandGeometry(-2.0, 2.0, lo1, hi1, frontLift, 80, 8, 1)), oliveGold); band.castShadow = true;
    var lowLine = new Mesh(track(bandGeometry(-2.0, 2.0, function (p) { return lo1(p) - 0.012; }, function (p) { return lo1(p) + 0.05; }, function (p) { return frontLift(p) + 0.008; }, 80, 2, 1)), whiteMat2);
    var upLine = new Mesh(track(bandGeometry(-2.0, 2.0, function (p) { return hi1(p) - 0.035; }, function (p) { return hi1(p) + 0.03; }, function (p) { return frontLift(p) + 0.008; }, 80, 2, 1)), whiteMat2);
    helmetGroup.add(band, lowLine, upLine); parts.crest.push(oliveGold, whiteMat2);
    var scal = []; for (i = 0; i < 64; i++) { var ph = -2.0 + 4.0 * i / 63, th = hi1(ph) + 0.03; scal.push({ p: dpos(ph, th, frontLift(ph) + 0.014), n: dnorm(ph, th), s: 1 }); }
    helmetGroup.add(shapesAt(track(new ConeGeometry(0.036, 0.075, 6)), whiteMat2, scal));
  }

  if (S.id === 'black') {
    var scrollTex = track(goldScrollTexture());
    var scrollMat = std({ color: '#ffffff', map: scrollTex, bumpMap: scrollTex, bumpScale: 3, roughness: 0.28, metalness: 0.55, side: DoubleSide });
    var lo2 = function (phi) { return thetaEdge(phi) + 0.01; }, hi2 = function (phi) { return thetaEdge(phi) + 0.34; };
    var band2 = new Mesh(track(bandGeometry(-1.75, 1.75, lo2, hi2, frontLift, 100, 10, 2.2)), scrollMat); band2.castShadow = true;
    var edge2 = new Mesh(track(bandGeometry(-1.75, 1.75, function (p) { return hi2(p) - 0.012; }, function (p) { return hi2(p) + 0.02; }, function (p) { return frontLift(p) + 0.006; }, 100, 2, 1)), gold);
    helmetGroup.add(band2, edge2); parts.crest.push(scrollMat, gold);
    /* gold C-scroll on each side of the dome (as on the photographed black helmet) */
    [-1, 1].forEach(function (sd) {
      var pts = [dpos(sd * 1.75, 0.05, 0.04), dpos(sd * 1.95, -0.22, 0.045), dpos(sd * 2.3, -0.4, 0.045), dpos(sd * 2.62, -0.25, 0.045), dpos(sd * 2.6, -0.02, 0.045), dpos(sd * 2.38, 0.02, 0.04)];
      var sc = new Mesh(track(taperTube(pts, function (t) { return 0.045 * (1 - 0.7 * t * t) + 0.012; }, 50, 8)), gold); sc.castShadow = true; helmetGroup.add(sc);
    });
  }

  if (S.id === 'woven') {
    /* crown band with a zig-zag top edge, rope trim, and chin straps (photos: moriones-2) */
    var ropeMat = std({ color: '#c8a76c', roughness: 0.9, metalness: 0 });
    var wovenMat = std({ color: '#ffffff', map: weaveTex, bumpMap: weaveTex, bumpScale: 2.5, roughness: 0.9, side: DoubleSide });
    var zig = function (phi) { var A = 0.1 + 0.2 * Math.exp(-phi * phi / 0.12), tw = Math.abs(((phi * 3.1) % 1 + 1) % 1 - 0.5) * 2; return A * (1 - tw) ; };
    var loW = function (phi) { return thetaEdge(phi) + 0.0; }, hiW = function (phi) { return thetaEdge(phi) + 0.1 + zig(phi) + 0.12; };
    var bandW = new Mesh(track(bandGeometry(-2.5, 2.5, loW, hiW, function (p) { return 0.03 + 0.02 * Math.max(Math.cos(p), 0); }, 220, 8, 6)), wovenMat); bandW.castShadow = true;
    var ptsT = [], ptsB = [];
    for (i = 0; i <= 110; i++) { var pp = -2.5 + 5 * i / 110; ptsT.push(dpos(pp, hiW(pp), 0.045)); ptsB.push(dpos(pp, loW(pp), 0.045)); }
    var ropeT = new Mesh(track(taperTube(ptsT, function () { return 0.017; }, 330, 6)), ropeMat), ropeB = new Mesh(track(taperTube(ptsB, function () { return 0.02; }, 220, 6)), ropeMat);
    helmetGroup.add(bandW, ropeT, ropeB); parts.crest.push(wovenMat, ropeMat);
    /* rope loop on top with a blue strip */
    var loopPts = [new Vector3(0.0, D.cy + D.ry * 0.97, D.cz + 0.1), new Vector3(0.02, D.cy + D.ry + 0.42, D.cz - 0.02), new Vector3(0.03, D.cy + D.ry + 0.68, D.cz - 0.14), new Vector3(0.03, D.cy + D.ry + 0.4, D.cz - 0.3), new Vector3(0.0, D.cy + D.ry * 0.8, D.cz - 0.42)];
    var loop = new Mesh(track(taperTube(loopPts, function () { return 0.02; }, 40, 6)), ropeMat);
    var strip = new Mesh(track(taperTube(loopPts.map(function (p) { return p.clone().add(new Vector3(0.025, 0, 0)); }), function () { return 0.012; }, 40, 6)), std({ color: '#2f7fb8', roughness: 0.6 }));
    helmetGroup.add(loop, strip);
    /* woven ear flaps hanging behind the ears */
    var flapGeo = track(new BoxGeometry(0.1, 0.46, 0.02));
    [-1, 1].forEach(function (sd) {
      for (var f = 0; f < 4; f++) {
        var ph3 = sd * (1.75 + f * 0.28), th3 = thetaEdge(ph3), p3 = dpos(ph3, th3, 0.02), fm = new Mesh(flapGeo, wovenMat);
        fm.position.copy(p3).add(new Vector3(0, -0.2, 0)); fm.rotation.y = ph3; fm.rotation.x = 0.1; fm.rotation.z = sd * 0.05 * f; fm.castShadow = true; helmetGroup.add(fm);
      }
    });
    /* flowers on tall stalks: woven brown trumpets with curled leather petals */
    var petalMat = std({ color: '#6a4528', roughness: 0.55, side: DoubleSide }), trumpMat = std({ color: '#ffffff', map: weaveTex, bumpMap: weaveTex, bumpScale: 2, roughness: 0.9, side: DoubleSide });
    var latheGeo = track(new LatheGeometry([new Vector2(0.012, 0), new Vector2(0.022, 0.1), new Vector2(0.05, 0.2), new Vector2(0.095, 0.3), new Vector2(0.125, 0.36)], 18));
    var petalGeo2 = track(new SphereGeometry(1, 14, 10));
    var stalkMat = std({ color: '#6d5334', roughness: 0.9 });
    var fl = [ // azimuth, elevation on the dome, stalk reach (out, up), tilt
      [-1.15, 0.95, -0.62, 0.9], [-0.55, 1.05, -0.28, 1.02], [0.2, 1.18, -0.05, 0.84], [0.65, 1.0, 0.3, 0.98], [1.2, 0.92, 0.62, 0.92], [2.2, 1.0, 0.3, 0.78], [-2.1, 1.0, -0.3, 0.8]
    ];
    fl.forEach(function (f2) {
      var base = dpos(f2[0], f2[1], -0.02), nrm = dnorm(f2[0], f2[1]);
      var out = new Vector3(f2[2], 0, f2[2] * 0.15), tip = base.clone().addScaledVector(nrm, f2[3] * 0.3).add(new Vector3(out.x * 0.55, f2[3] * 0.5, out.z * 0.8));
      var mid = base.clone().lerp(tip, 0.5).add(new Vector3(out.x * 0.15, 0, 0));
      var st = new Mesh(track(taperTube([base, mid, tip], function (t) { return 0.022 - 0.008 * t; }, 20, 6)), stalkMat); st.castShadow = true; helmetGroup.add(st);
      var dir = tip.clone().sub(mid).normalize(), tr = new Mesh(latheGeo, trumpMat);
      tr.position.copy(tip).addScaledVector(dir, -0.02); tr.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir); tr.castShadow = true; helmetGroup.add(tr);
      var mouth = tip.clone().addScaledVector(dir, 0.34), qd = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
      for (var pi = 0; pi < 6; pi++) {
        var pa = pi / 6 * TAU, pm = new Mesh(petalGeo2, petalMat), radial = new Vector3(Math.cos(pa), 0, Math.sin(pa)).applyQuaternion(qd);
        pm.scale.set(0.05, 0.15, 0.014); pm.position.copy(mouth).addScaledVector(radial, 0.1).addScaledVector(dir, 0.05);
        var qq = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().addScaledVector(radial, 1.1).normalize());
        pm.quaternion.copy(qq); pm.castShadow = true; helmetGroup.add(pm);
      }
    });
    parts.crest.push(petalMat, trumpMat, stalkMat);
  }

  /* cheek plates in front of the ears */
  var plateMat, plateEdge = null;
  if (S.id === 'red') { plateMat = oliveGold; plateEdge = whiteMat2; }
  else if (S.id === 'black') { plateMat = std({ color: '#0b0a0c', roughness: 0.2, metalness: 0.3, side: DoubleSide }); plateEdge = gold; parts.crest.push(plateMat); }
  else { plateMat = std({ color: '#ffffff', map: weaveTex, bumpMap: weaveTex, bumpScale: 2, roughness: 0.9, side: DoubleSide }); plateEdge = std({ color: '#c8a76c', roughness: 0.9, side: DoubleSide }); parts.crest.push(plateMat); }
  var narrow = S.id === 'woven';
  [-1, 1].forEach(function (sd) {
    var back = plateEdge ? new Mesh(track(plateGeometry(sd, 0.3, -0.82, 1.18, 0.9, narrow ? 0.13 : 0.2, narrow ? 0.07 : 0.1, 0.058, 20, 6)), plateEdge) : null;
    var pl = new Mesh(track(plateGeometry(sd, 0.3, -0.82, 1.18, 0.9, narrow ? 0.1 : 0.16, narrow ? 0.05 : 0.08, 0.07, 20, 6)), plateMat);
    pl.castShadow = true; if (back) helmetGroup.add(back); helmetGroup.add(pl);
    if (S.id !== 'woven') {
      var rv = []; [0.24, -0.4].forEach(function (yy, ri) { var pt = headPt(sd * lerp(1.18, 0.9, (0.3 - yy) / 1.12), yy); rv.push({ p: new Vector3(pt.x * 1.0 + sd * 0.1, yy, pt.z + 0.07), n: new Vector3(sd, 0, 0.3), s: 1 }); });
      helmetGroup.add(shapesAt(track(new SphereGeometry(0.032, 12, 8)), gold, rv));
    }
  });
  if (S.id === 'black') { /* gold scroll leaf on the black plates */ }

  /* crest: comb + fibre or horsehair (red and black styles) */
  if (S.id === 'red' || S.id === 'black') {
    var hole = S.id === 'red' ? { u: 0.58, w: 0.13, h: 0.7 } : { u: 0.55, w: 0.11, h: 0.6 };
    var comb = track(combGeometry(S.id === 'red' ? 0.3 : 0.34, hole));
    var combMat = S.id === 'red' ? oliveGold : std({ color: '#0b0a0c', roughness: 0.18, metalness: 0.3, side: DoubleSide });
    var combMesh = new Mesh(comb, combMat); combMesh.castShadow = true; helmetGroup.add(combMesh);
    parts.crest.push(combMat);
    var info = comb.userData, strands = [], cols, count, lenBase;
    if (S.id === 'red') { cols = ['#e8a23c', '#f0b24e', '#d98a2c', '#f4c068'].map(function (c) { return new Color(c); }); count = 2600; lenBase = 0.34; }
    else { cols = ['#120d0b', '#1b1210', '#3e1a12', '#241712', '#4a2216'].map(function (c) { return new Color(c); }); count = 3800; lenBase = 0.5; }
    for (i = 0; i < count; i++) {
      var u = info.L * (0.03 + 0.95 * R()), al = info.alphaAt(u), hh = info.hAt(u);
      var N = merN(al), T = merT(al), p4 = mer(al).addScaledVector(N, hh * (0.82 + R() * 0.18));
      p4.x += (R() - 0.5) * (S.id === 'red' ? 0.17 : 0.12);
      var swing = S.id === 'red' ? 0.45 : 0.95;
      var dir4 = N.clone().multiplyScalar(0.9).addScaledVector(T, swing * (0.5 + R() * 0.7)).add(new Vector3((R() - 0.5) * 0.3, (R() - 0.5) * 0.15, 0));
      if (S.id === 'black') dir4.y -= 0.12 * (u / info.L);
      var sc2 = Math.sin(PI * clamp(u / info.L, 0, 1));
      strands.push({ p: p4, dir: dir4, len: lenBase * (0.55 + 0.7 * sc2) * (0.7 + R() * 0.5), color: cols[Math.floor(R() * cols.length)] });
    }
    var crestHair = std({ color: '#ffffff', roughness: S.id === 'red' ? 0.75 : 0.5, side: DoubleSide });
    helmetGroup.add(hairMesh(strands, crestHair, S.id === 'red' ? 0.018 : 0.014, 0.003)); parts.crest.push(crestHair);
    /* rivets along the comb */
    var rvs = []; for (i = 0; i < 9; i++) { var uu = info.L * (0.08 + 0.84 * i / 8), a5 = info.alphaAt(uu); rvs.push({ p: mer(a5).addScaledVector(merN(a5), 0.045).add(new Vector3(0.034, 0, 0)), n: new Vector3(1, 0, 0), s: 1 }); }
    if (S.id === 'red') helmetGroup.add(shapesAt(track(new SphereGeometry(0.034, 12, 8)), gold, rvs));
    parts.crest.push(gold);
  }

  /* optional Mogpog "bulaklakan" flowers: silver tinfoil on the helmet (red and black styles) */
  if (!S.ownFlowers) {
    var silver = std({ color: '#d7dbe2', roughness: 0.22, metalness: 0.95, side: DoubleSide });
    var goldF = std({ color: '#d9b45a', roughness: 0.3, metalness: 0.9 });
    var petalGeo = track(new SphereGeometry(1, 14, 10)), coreGeo = track(new SphereGeometry(0.03, 12, 8));
    var spots = [[-0.62, 1.0], [0.55, 1.05], [-1.1, 0.9], [1.1, 0.85], [-1.6, 0.8], [1.6, 0.8], [-2.2, 0.75], [2.2, 0.75], [-2.7, 0.6], [2.7, 0.6], [-0.95, 0.62], [0.95, 0.6]];
    spots.forEach(function (sp, fi) {
      var th = sp[1], ph = sp[0], f = new Group(), n = dnorm(ph, th);
      f.position.copy(dpos(ph, th, 0.014)); f.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), n);
      var sc = 0.9 + (fi % 4) * 0.12;
      for (var p2 = 0; p2 < 7; p2++) {
        var pa = p2 / 7 * TAU, pm = new Mesh(petalGeo, silver);
        pm.scale.set(0.085 * sc, 0.038 * sc, 0.015); pm.position.set(Math.cos(pa) * 0.075 * sc, Math.sin(pa) * 0.075 * sc, 0); pm.rotation.z = pa; f.add(pm);
      }
      var core = new Mesh(coreGeo, goldF); core.position.z = 0.012; core.scale.setScalar(sc); f.add(core);
      flowerGroup.add(f);
    });
    parts.crest.push(silver);
  }
  flowerGroup.visible = false;

  root.position.y = S.lift;
  return { root: root, parts: parts, helmetGroup: helmetGroup, flowerGroup: flowerGroup, style: S, dispose: function () {
    disposables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
    root.traverse(function (o) { if (o.isInstancedMesh) { o.geometry.dispose(); o.dispose(); } });
  } };
}

/* ---------- viewer ---------- */
function supported() {
  try {
    var c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

var YAW_MAX = 3.2, PITCH_MIN = -0.5, PITCH_MAX = 0.6, Z_MIN = 4.0, Z_MAX = 10.5, Z_DEF = 6.4;

function create(container, options) {
  options = options || {};
  var renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
  } catch (e) { throw new Error('webgl'); }
  if (!renderer.getContext()) throw new Error('webgl');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
  var canvas = renderer.domElement;
  canvas.className = 'mask3d-canvas';
  if (options.decorative) { canvas.tabIndex = -1; canvas.setAttribute('aria-hidden', 'true'); }
  else {
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    if (options.label) canvas.setAttribute('aria-label', options.label);
  }
  container.appendChild(canvas);

  var scene = new Scene();
  var pm = new PMREMGenerator(renderer);
  var envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex; scene.environmentIntensity = 0.7;
  var camera = new PerspectiveCamera(30, 1, 0.1, 50);
  var key = new DirectionalLight('#fff1dc', 2.6); key.position.set(-3.2, 4.2, 5.5);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.6; key.shadow.camera.right = 2.6; key.shadow.camera.top = 2.6; key.shadow.camera.bottom = -2.6;
  key.shadow.camera.near = 1; key.shadow.camera.far = 14; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  var fill = new HemisphereLight('#ffe9cf', '#3a2a22', 0.6);
  var rimL = new DirectionalLight('#9bb4ff', 0.9); rimL.position.set(4, 1.5, -4);
  scene.add(key, fill, rimL);

  var pivot = new Group(); scene.add(pivot);
  var styleKey = STYLES[options.style] ? options.style : 'red', model = null, helmetOn = true, flowersOn = false;
  var baseZoom = options.zoom || Z_DEF;
  function zDefNow() { return clamp(baseZoom * model.style.zoom, Z_MIN, Z_MAX); }
  function loadStyle(k) {
    if (model) { pivot.remove(model.root); model.dispose(); }
    styleKey = k; model = build(k); pivot.add(model.root);
    model.helmetGroup.visible = helmetOn; model.flowerGroup.visible = flowersOn && helmetOn && !model.style.ownFlowers;
  }
  loadStyle(styleKey);

  /* view state */
  var yaw = 0, pitch = 0.08, zoom = zDefNow(), tYaw = 0, tPitch = 0.08, tZoom = zoom;
  var vYaw = 0, vPitch = 0, dragging = false, lastX = 0, lastY = 0;
  var auto = options.auto !== false, phase = 0, destroyed = false, visible = true, raf = 0, last = 0;
  var highlightColor = new Color('#a82219');

  function size() {
    var w = Math.max(container.clientWidth, 120), h = Math.max(container.clientHeight, 120);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    wake();
  }
  function placeCamera() {
    camera.position.set(0, 0.1, zoom); camera.lookAt(0, 0.0, 0);
    var sway = auto ? Math.sin(phase) * 0.7 : 0;
    pivot.rotation.set(pitch, yaw + sway, 0);
  }
  function needLoop() {
    return auto || dragging || Math.abs(vYaw) > 0.0005 || Math.abs(vPitch) > 0.0005 ||
      Math.abs(tYaw - yaw) > 0.0008 || Math.abs(tPitch - pitch) > 0.0008 || Math.abs(tZoom - zoom) > 0.002;
  }
  function frame(now) {
    raf = 0; if (destroyed) return;
    var dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    if (auto) phase += dt * 0.55;
    if (!dragging) {
      tYaw = clamp(tYaw + vYaw, -YAW_MAX, YAW_MAX); tPitch = clamp(tPitch + vPitch, PITCH_MIN, PITCH_MAX);
      vYaw *= Math.pow(0.04, dt); vPitch *= Math.pow(0.04, dt);
    }
    var k = 1 - Math.exp(-dt * 12);
    yaw += (tYaw - yaw) * k; pitch += (tPitch - pitch) * k; zoom += (tZoom - zoom) * k;
    placeCamera();
    renderer.render(scene, camera);
    if (visible && needLoop()) { raf = requestAnimationFrame(frame); } else { last = 0; }
  }
  function wake() { if (!raf && !destroyed) raf = requestAnimationFrame(frame); }

  /* pointer / keyboard / wheel */
  function onDown(e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY; vYaw = vPitch = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    if (auto) setAuto(false);
    canvas.classList.add('grabbing'); wake();
  }
  function onMove(e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    vYaw = dx * 0.006; vPitch = dy * 0.004;
    tYaw = clamp(tYaw + dx * 0.006, -YAW_MAX, YAW_MAX); tPitch = clamp(tPitch + dy * 0.004, PITCH_MIN, PITCH_MAX);
    wake();
  }
  function onUp(e) {
    dragging = false; canvas.classList.remove('grabbing');
    try { canvas.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    wake();
  }
  function onWheel(e) { // only after the model was clicked/focused, so normal page scrolling is never hijacked
    if (document.activeElement !== canvas) return;
    e.preventDefault(); tZoom = clamp(tZoom * (1 + e.deltaY * 0.001), Z_MIN, Z_MAX); wake();
  }
  function onKey(e) {
    var handled = true;
    if (e.key === 'ArrowLeft') tYaw = clamp(tYaw - 0.15, -YAW_MAX, YAW_MAX);
    else if (e.key === 'ArrowRight') tYaw = clamp(tYaw + 0.15, -YAW_MAX, YAW_MAX);
    else if (e.key === 'ArrowUp') tPitch = clamp(tPitch - 0.1, PITCH_MIN, PITCH_MAX);
    else if (e.key === 'ArrowDown') tPitch = clamp(tPitch + 0.1, PITCH_MIN, PITCH_MAX);
    else if (e.key === '+' || e.key === '=') tZoom = clamp(tZoom - 0.5, Z_MIN, Z_MAX);
    else if (e.key === '-' || e.key === '_') tZoom = clamp(tZoom + 0.5, Z_MIN, Z_MAX);
    else if (e.key === 'Home' || e.key === 'r' || e.key === 'R') api.reset();
    else handled = false;
    if (handled) { e.preventDefault(); if (auto) setAuto(false); wake(); }
  }
  function onLost(e) { e.preventDefault(); if (options.onContextLost) options.onContextLost(); }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  if (!options.decorative) canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('webglcontextlost', onLost);
  var ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null;
  if (ro) ro.observe(container); else window.addEventListener('resize', size);
  var io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(function (en) {
    visible = en[0].isIntersecting; if (visible) wake();
  }) : null;
  if (io) io.observe(container);

  function setAuto(v) { auto = !!v; if (options.onAutoChange) options.onAutoChange(auto); wake(); }
  function setEmissive(list, on) {
    list.forEach(function (m) {
      if (!m.emissive) return;
      m.emissive.copy(on ? highlightColor : new Color(0, 0, 0)); m.emissiveIntensity = on ? 0.32 : 0;
    });
  }

  var api = {
    canvas: canvas,
    setHelmet: function (v) { helmetOn = !!v; model.helmetGroup.visible = helmetOn; if (!helmetOn) model.flowerGroup.visible = false; else model.flowerGroup.visible = flowersOn && !model.style.ownFlowers; wake(); },
    setFlowers: function (v) { flowersOn = !!v; model.flowerGroup.visible = flowersOn && helmetOn && !model.style.ownFlowers; wake(); },
    setStyle: function (k) {
      if (!STYLES[k] || k === styleKey) return { flowers: !model.style.ownFlowers };
      loadStyle(k); tZoom = zDefNow(); wake();
      return { flowers: !model.style.ownFlowers };
    },
    style: function () { return styleKey; },
    flowersAvailable: function () { return !model.style.ownFlowers; },
    setAuto: setAuto,
    isAuto: function () { return auto; },
    highlight: function (part) {
      setEmissive(model.parts.mask, part === 'mask'); setEmissive(model.parts.crest, part === 'crest');
      if (part === 'mask') { tYaw = 0; tPitch = 0.02; tZoom = clamp(5.2 * model.style.zoom, Z_MIN, Z_MAX); }
      else if (part === 'crest') { tYaw = 0.7; tPitch = -0.28; tZoom = clamp(6.0 * model.style.zoom, Z_MIN, Z_MAX); }
      if (part && auto) setAuto(false);
      wake();
    },
    reset: function () { tYaw = 0; tPitch = 0.08; tZoom = zDefNow(); vYaw = vPitch = 0; wake(); },
    zoom: function (dir) { tZoom = clamp(tZoom + (dir > 0 ? -0.6 : 0.6), Z_MIN, Z_MAX); wake(); },
    rotate: function (dx, dy) { tYaw = clamp(tYaw + dx, -YAW_MAX, YAW_MAX); tPitch = clamp(tPitch + dy, PITCH_MIN, PITCH_MAX); if (auto) setAuto(false); wake(); },
    state: function () { return { yaw: yaw, pitch: pitch, zoom: zoom, auto: auto, helmet: model.helmetGroup.visible, flowers: model.flowerGroup.visible, style: styleKey }; },
    renderNow: function () { placeCamera(); renderer.render(scene, camera); },
    destroy: function () {
      destroyed = true; if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('webglcontextlost', onLost);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', size);
      if (io) io.disconnect();
      model.dispose(); envTex.dispose(); pm.dispose(); renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* ignore */ }
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };
  size();
  return api;
}

window.MHGMask = { supported: supported, create: create, styles: ['red', 'black', 'woven'], version: '2' };
