/* MHG - original procedural 3D Morion mask (Three.js, MIT).
 * Everything here is generated in code: no downloaded model, photo or museum object was used.
 * Style follows the general descriptions cited in the app (scowling Roman-soldier face, only two
 * small eye holes, human-hair lashes, helmet with horsehair crest, optional Mogpog "bulaklakan" flowers).
 * Exposes window.MHGMask = { supported(), create(container, options) }. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, PlaneGeometry, SphereGeometry,
  TorusGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial,
  DirectionalLight, HemisphereLight, Color, Vector3, Matrix4, Quaternion, CanvasTexture, SRGBColorSpace,
  ACESFilmicToneMapping, PCFSoftShadowMap, BackSide, DoubleSide, PMREMGenerator, CatmullRomCurve3,
  MathUtils, Object3D, LinearFilter, RepeatWrapping
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

/* ---------- face shape: one height-field used for geometry, paint and for placing hair ---------- */
var Y0 = -1.22, Y1 = 0.52;               // chin .. top edge (under the helmet)
function sFall(y) { return clamp((0.45 - y) / 1.67, 0, 1); }
function halfW(y) {
  var w = 0.9 * (1 - 0.52 * Math.pow(sFall(y), 1.7));
  return w * Math.pow(clamp((y - Y0) / 0.5, 0, 1), 0.45); // rounded chin
}
function mouthY(x) { return -0.76 - 0.3 * x * x; } // corners turned down: a scowl

function baseZ(x, y) {
  var w = Math.max(halfW(y), 0.0001);
  var q = clamp(x / w, -1, 1);
  var depth = 0.62 * (1 - 0.28 * sFall(y) * sFall(y));
  var under = Math.pow(clamp((y - Y0) / 0.4, 0, 1), 0.55); // wraps under the chin
  return depth * Math.pow(Math.max(1 - q * q, 0), 0.62) * under;
}

function features(x, y) { // carved details added to the base shell
  var z = 0, s, ax = Math.abs(x), sx = x < 0 ? -1 : 1, d;
  // heavy scowling brows, slanting down toward the nose
  d = segDist(ax, y, 0.72, 0.4, 0.08, 0.17);
  z += 0.17 * Math.exp(-Math.pow(d.d / 0.085, 2)) * (0.75 + 0.25 * (1 - d.t));
  // brow shadow and eye sockets
  z += gauss(ax, y, 0.37, 0.05, 0.17, 0.085, -0.07);
  z += gauss(ax, y, 0.37, 0.065, 0.1, 0.034, -0.05); // the eye hole itself
  // nose: bridge, tip, wings, nostrils
  d = segDist(ax, y, 0, 0.2, 0, -0.3);
  z += 0.2 * Math.exp(-Math.pow(d.d / (0.06 + 0.04 * d.t), 2));
  z += gauss(ax, y, 0, -0.34, 0.12, 0.1, 0.14);
  z += gauss(ax, y, 0.15, -0.37, 0.07, 0.06, 0.07);
  z += gauss(ax, y, 0.075, -0.45, 0.035, 0.025, -0.05);
  // cheekbones and hollows, nose-to-mouth lines
  z += gauss(ax, y, 0.52, -0.2, 0.26, 0.2, 0.1);
  z += gauss(ax, y, 0.5, -0.58, 0.2, 0.2, -0.045);
  d = segDist(ax, y, 0.2, -0.42, 0.44, -0.78);
  z -= 0.04 * Math.exp(-Math.pow(d.d / 0.03, 2));
  // lips, mouth line, chin
  z += gauss(ax, y, 0, -0.62, 0.24, 0.05, 0.05);
  var my = mouthY(ax);
  z -= 0.05 * Math.exp(-Math.pow((y - my) / 0.02, 2)) * clamp(1 - Math.pow(ax / 0.46, 4), 0, 1);
  z += gauss(ax, y, 0, my - 0.1, 0.2, 0.05, 0.05);
  z += gauss(ax, y, 0, -1.0, 0.22, 0.17, 0.1);
  // frown furrow between the brows
  z -= gauss(ax, y, 0.045, 0.34, 0.03, 0.14, 0.04);
  return z;
}
function zAt(x, y) { return baseZ(x, y) + features(x, y) * clamp(baseZ(x, y) / 0.18, 0, 1); }

var C = {
  wood: new Color('#c2824f'), woodDark: new Color('#7a4a28'), brow: new Color('#1d130d'),
  lips: new Color('#8e2a1f'), black: new Color('#0b0705'), beard: new Color('#2b1c14'), blush: new Color('#b5543a')
};
var tmp = new Color();
function paint(x, y, z, out) {
  var ax = Math.abs(x), w = Math.max(halfW(y), 0.001), t;
  out.copy(C.wood);
  // blush on the cheekbones
  t = gauss(ax, y, 0.52, -0.22, 0.24, 0.2, 0.32); out.lerp(C.blush, clamp(t, 0, 1));
  // cavities get darker (cheap ambient occlusion)
  var carve = z - baseZ(x, y);
  if (carve < 0) out.lerp(C.woodDark, clamp(-carve * 6, 0, 0.55));
  // brows
  var d = segDist(ax, y, 0.72, 0.4, 0.08, 0.17);
  t = 1 - smooth(0.05, 0.095, d.d); out.lerp(C.brow, t);
  // lips and mouth line
  var my = mouthY(ax);
  t = Math.exp(-Math.pow((y - (my - 0.02)) / 0.062, 2)) * clamp(1 - Math.pow(ax / 0.4, 4), 0, 1);
  out.lerp(C.lips, clamp(t * 0.9, 0, 1));
  t = Math.exp(-Math.pow((y - my) / 0.012, 2)) * clamp(1 - Math.pow(ax / 0.46, 4), 0, 1);
  out.lerp(C.black, clamp(t, 0, 0.85));
  // beard area under the mouth, and sideburns
  t = smooth(my - 0.06, my - 0.16, y); out.lerp(C.beard, t * 0.92);
  t = smooth(0.74, 0.93, ax / w) * smooth(0.12, -0.35, y); out.lerp(C.beard, t * 0.9);
  // nostrils
  t = gauss(ax, y, 0.075, -0.45, 0.04, 0.03, 1); out.lerp(C.black, clamp(t, 0, 0.9));
  // the two small eye holes (slanted)
  var ex = ax - 0.37, ey = y - 0.065 - ex * -0.25;
  t = 1 - smooth(0.8, 1.05, Math.sqrt(Math.pow(ex / 0.1, 2) + Math.pow(ey / 0.03, 2)));
  out.lerp(C.black, t);
  return out;
}

/* ---------- textures ---------- */
function woodTexture(seed) {
  var c = document.createElement('canvas'); c.width = 512; c.height = 512;
  var g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = '#e9d8c4'; g.fillRect(0, 0, 512, 512);
  for (var i = 0; i < 520; i++) { // long vertical grain streaks
    var x = r() * 512, w = 0.8 + r() * 3, a = 0.015 + r() * 0.045;
    g.strokeStyle = 'rgba(70,38,14,' + a.toFixed(3) + ')'; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, 0);
    g.bezierCurveTo(x + (r() - 0.5) * 30, 170, x + (r() - 0.5) * 30, 340, x + (r() - 0.5) * 18, 512); g.stroke();
  }
  var tx = new CanvasTexture(c);
  tx.colorSpace = SRGBColorSpace; tx.wrapS = tx.wrapT = RepeatWrapping; tx.anisotropy = 4; tx.minFilter = LinearFilter;
  return tx;
}

/* ---------- builders ---------- */
function buildFaceGeometry() {
  var g = new PlaneGeometry(1, 1, 150, 190);
  var pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3), o = new Color();
  for (var i = 0; i < n; i++) {
    var u = pos.getX(i) * 2, v = pos.getY(i) + 0.5;
    var y = Y0 + v * (Y1 - Y0), x = u * halfW(y), z = zAt(x, y);
    pos.setXYZ(i, x, y, z);
    paint(x, y, z, o);
    col[i * 3] = o.r; col[i * 3 + 1] = o.g; col[i * 3 + 2] = o.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function onFace(x, y, lift) { // a point just above the carved surface
  var lim = 0.9 * halfW(y);
  x = clamp(x, -lim, lim);
  return new Vector3(x, y, zAt(x, y) + lift);
}

function taperTube(points, radiusFn, seg, radial) {
  var curve = new CatmullRomCurve3(points);
  var fr = curve.computeFrenetFrames(seg, false);
  var pos = [], idx = [], i, j;
  for (i = 0; i <= seg; i++) {
    var t = i / seg, p = curve.getPointAt(t), r = radiusFn(t);
    for (j = 0; j < radial; j++) {
      var a = j / radial * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(p.x + (fr.normals[i].x * ca + fr.binormals[i].x * sa) * r,
        p.y + (fr.normals[i].y * ca + fr.binormals[i].y * sa) * r,
        p.z + (fr.normals[i].z * ca + fr.binormals[i].z * sa) * r);
    }
  }
  for (i = 0; i < seg; i++) for (j = 0; j < radial; j++) {
    var a0 = i * radial + j, b0 = i * radial + (j + 1) % radial, c0 = (i + 1) * radial + (j + 1) % radial, d0 = (i + 1) * radial + j;
    idx.push(a0, b0, d0, b0, c0, d0);
  }
  var g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* many thin tapered hairs as one InstancedMesh. list = [{p:Vector3, dir:Vector3, len:Number, color:Color}] */
function hairMesh(list, material, baseR, tipR) {
  var geo = new CylinderGeometry(tipR, baseR, 1, 5, 1, true);
  geo.translate(0, 0.5, 0); // base at the origin, tip at +y
  var m = new InstancedMesh(geo, material, list.length);
  var o = new Object3D(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  list.forEach(function (h, i) {
    q.setFromUnitVectors(up, h.dir.clone().normalize());
    o.position.copy(h.p); o.quaternion.copy(q); o.scale.set(1, h.len, 1); o.updateMatrix();
    m.setMatrixAt(i, o.matrix); m.setColorAt(i, h.color);
  });
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false;
  return m;
}

function build() {
  var R = rng(20261105), disposables = [], parts = { mask: [], crest: [] };
  var root = new Group(), maskGroup = new Group(), helmetGroup = new Group(), flowerGroup = new Group();
  root.add(maskGroup, helmetGroup, flowerGroup);
  function track(o) { disposables.push(o); return o; }

  var wood = track(woodTexture(7));
  var faceGeo = track(buildFaceGeometry());
  var faceMat = track(new MeshStandardMaterial({ vertexColors: true, map: wood, bumpMap: wood, bumpScale: 0.35, roughness: 0.6, metalness: 0 }));
  var face = new Mesh(faceGeo, faceMat); face.castShadow = face.receiveShadow = true;
  var inner = new Mesh(faceGeo, track(new MeshStandardMaterial({ color: '#3a2314', roughness: 0.95, side: BackSide })));
  maskGroup.add(face, inner); parts.mask.push(faceMat);

  /* moustache: two tapered tubes sweeping out and down */
  var hairMat = track(new MeshStandardMaterial({ color: '#241812', roughness: 0.75, metalness: 0, side: DoubleSide }));
  var hairMatV = track(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0, side: DoubleSide }));
  [-1, 1].forEach(function (s) {
    var pts = [onFace(0, -0.585, 0.045), onFace(s * 0.12, -0.6, 0.06), onFace(s * 0.3, -0.69, 0.075), onFace(s * 0.46, -0.84, 0.075),
      onFace(s * 0.56, -0.99, 0.065), onFace(s * 0.58, -1.08, 0.055)];
    var m = new Mesh(track(taperTube(pts, function (t) { return 0.006 + 0.068 * Math.sin(Math.min(1, 0.22 + t * 3)) * Math.pow(1 - t, 0.55); }, 40, 10)), hairMat);
    m.castShadow = true; maskGroup.add(m);
  });
  parts.mask.push(hairMat);

  /* beard bristles hanging from the chin and jaw */
  var beard = [], bc = [new Color('#2b1c14'), new Color('#1d130d'), new Color('#3b2a1e'), new Color('#4d4038')];
  for (var i = 0; i < 1500; i++) {
    var y = -0.9 - Math.pow(R(), 0.8) * 0.3 + R() * 0.02, x, tries = 0;
    var yy = mouthY(0) - 0.14 - R() * (1.1 + Y0 + 0.22) * 0.9 - 0.0;
    y = Math.max(yy, Y0 + 0.03);
    var lim = 0.88 * halfW(y);
    x = (R() * 2 - 1) * lim;
    if (y > mouthY(x) - 0.12) { i--; if (++tries > 50) break; continue; }
    var p = new Vector3(x, y, zAt(x, y) + 0.01);
    var along = clamp((mouthY(0) - y) / 0.5, 0, 1);
    var dir = new Vector3((R() - 0.5) * 0.5 + x * 0.35, -1, 0.35 + R() * 0.55);
    beard.push({ p: p, dir: dir, len: 0.2 + along * 0.22 + R() * 0.16, color: bc[Math.floor(R() * bc.length)] });
  }
  var beardMesh = hairMesh(beard, hairMatV, 0.02, 0.004);
  maskGroup.add(beardMesh); parts.mask.push(hairMatV);

  /* eyelashes of "human hair" around the two eye holes */
  var lashes = [], lc = new Color('#120c09');
  [-1, 1].forEach(function (s) {
    for (var k = 0; k < 30; k++) {
      var a = Math.PI * (0.08 + 0.84 * k / 29), ex = 0.1 * Math.cos(a), ey = 0.034 * Math.sin(a);
      // eye hole centre (0.37, 0.065), slanted like the paint
      var cx = 0.37 + ex, cy = 0.065 + ey + (ex * 0.25);
      var p = onFace(s * cx, cy, 0.004);
      lashes.push({ p: p, dir: new Vector3(s * Math.cos(a) * 0.5, 0.9 * Math.sin(a) + 0.15, 0.6), len: 0.06 + R() * 0.05, color: lc });
    }
  });
  maskGroup.add(hairMesh(lashes, hairMatV, 0.007, 0.002));

  /* helmet dome, brass rim and rivets */
  var cy = 0.48, Rx = 1.0, Ry = 0.95, Rz = 0.92, cz = -0.05;
  var domeGeo = track(new SphereGeometry(1, 72, 40, 0, Math.PI * 2, 0, Math.PI / 2));
  var helmMat = track(new MeshStandardMaterial({ color: '#8a2618', roughness: 0.42, metalness: 0.25 }));
  var dome = new Mesh(domeGeo, helmMat); dome.scale.set(Rx, Ry, Rz); dome.position.set(0, cy, cz);
  dome.castShadow = dome.receiveShadow = true;
  var domeIn = new Mesh(domeGeo, track(new MeshStandardMaterial({ color: '#2a1810', roughness: 0.9, side: BackSide })));
  domeIn.scale.copy(dome.scale); domeIn.position.copy(dome.position);
  var brassMat = track(new MeshStandardMaterial({ color: '#c9a24a', roughness: 0.3, metalness: 0.9 }));
  var rim = new Mesh(track(new TorusGeometry(1, 0.05, 14, 96)), brassMat);
  rim.rotation.x = Math.PI / 2; rim.scale.set(Rx * 1.005, Rz * 1.005, 1); rim.position.set(0, cy, cz); rim.castShadow = true;
  helmetGroup.add(dome, domeIn, rim);
  var rivetGeo = track(new SphereGeometry(0.045, 12, 8));
  for (var r = 0; r < 13; r++) {
    var ang = -Math.PI * 0.42 + (Math.PI * 0.84) * r / 12; // across the front of the rim
    var rv = new Mesh(rivetGeo, brassMat);
    rv.position.set(Math.sin(ang) * Rx * 0.985, cy + 0.14, cz + Math.cos(ang) * Rz * 0.985 * Math.sqrt(1 - 0.02));
    // lift onto the dome surface above the rim
    var el = Math.asin(0.14 / Ry); rv.position.set(Math.sin(ang) * Rx * Math.cos(el), cy + 0.14, cz + Math.cos(ang) * Rz * Math.cos(el));
    helmetGroup.add(rv);
  }
  parts.crest.push(helmMat);

  /* crest: brass holder along the top and a dense brush of horsehair bristles */
  var arc = function (phi) { return new Vector3(0, cy + Ry * Math.sin(phi) * 1.0, cz + Rz * Math.cos(phi)); };
  var holderPts = []; for (var a2 = 0; a2 <= 20; a2++) holderPts.push(arc(0.16 + (Math.PI - 0.5) * a2 / 20));
  var holder = new Mesh(track(taperTube(holderPts, function () { return 0.055; }, 60, 10)), brassMat);
  holder.castShadow = true; helmetGroup.add(holder);
  var crestHair = [], cc = [new Color('#16100d'), new Color('#1d1411'), new Color('#4a1511'), new Color('#2a1a14')];
  for (var k2 = 0; k2 < 2600; k2++) {
    var phi = 0.2 + R() * (Math.PI - 0.55), base = arc(phi);
    var nrm = new Vector3(0, Math.sin(phi) / Ry, Math.cos(phi) / Rz).normalize();
    var height = (0.32 + 0.4 * Math.sin(clamp((phi - 0.1) / 2.9, 0, 1) * Math.PI)) * (0.8 + R() * 0.4);
    base.x += (R() - 0.5) * 0.12;
    var dir = nrm.clone().add(new Vector3((R() - 0.5) * 0.22, (R() - 0.5) * 0.12, -0.45 - R() * 0.25)).normalize();
    crestHair.push({ p: base, dir: dir, len: height, color: cc[Math.floor(R() * cc.length)] });
  }
  var crestMat = track(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: DoubleSide }));
  helmetGroup.add(hairMesh(crestHair, crestMat, 0.016, 0.003));
  parts.crest.push(crestMat, brassMat);

  /* optional Mogpog "bulaklakan" flowers: silver tinfoil on the helmet */
  var silver = track(new MeshStandardMaterial({ color: '#d7dbe2', roughness: 0.22, metalness: 0.95, side: DoubleSide }));
  var gold = track(new MeshStandardMaterial({ color: '#d9b45a', roughness: 0.3, metalness: 0.9 }));
  var petalGeo = track(new SphereGeometry(1, 14, 10)), coreGeo = track(new SphereGeometry(0.03, 12, 8));
  var spots = [[-0.55, 0.9], [-0.3, 0.55], [0.35, 0.6], [0.6, 0.95], [-0.85, 0.55], [0.9, 0.5], [-0.62, 0.3], [0.7, 0.3],
    [-1.1, 0.8], [1.15, 0.85], [-0.2, 1.25], [0.25, 1.1], [-1.5, 0.6], [1.5, 0.65], [2.4, 0.7], [-2.5, 0.8], [3.1, 0.9]];
  spots.forEach(function (sp, fi) {
    var az = sp[0], el = sp[1]; // azimuth around the dome (0 = front), elevation above the rim
    var nx = Math.sin(az) * Math.cos(el), ny = Math.sin(el), nz = Math.cos(az) * Math.cos(el);
    var f = new Group(), n = new Vector3(nx / Rx, ny / Ry, nz / Rz).normalize();
    f.position.set(nx * Rx, cy + ny * Ry, cz + nz * Rz).addScaledVector(n, 0.012);
    f.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), n);
    var sc = 0.85 + (fi % 4) * 0.12;
    for (var p2 = 0; p2 < 7; p2++) {
      var pa = p2 / 7 * Math.PI * 2, pm = new Mesh(petalGeo, silver);
      pm.scale.set(0.085 * sc, 0.038 * sc, 0.015); pm.position.set(Math.cos(pa) * 0.075 * sc, Math.sin(pa) * 0.075 * sc, 0);
      pm.rotation.z = pa; f.add(pm);
    }
    var core = new Mesh(coreGeo, gold); core.position.z = 0.012; core.scale.setScalar(sc); f.add(core);
    flowerGroup.add(f);
  });
  parts.crest.push(silver);
  flowerGroup.visible = false;

  root.position.y = 0.05;
  return { root: root, parts: parts, helmetGroup: helmetGroup, flowerGroup: flowerGroup, dispose: function () {
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

var YAW_MAX = 1.9, PITCH_MIN = -0.5, PITCH_MAX = 0.6, Z_MIN = 4.0, Z_MAX = 9.5, Z_DEF = 6.4;

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
  scene.environment = envTex; scene.environmentIntensity = 0.55;
  var camera = new PerspectiveCamera(30, 1, 0.1, 50);
  var key = new DirectionalLight('#fff1dc', 2.6); key.position.set(-3.2, 4.2, 5.5);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.2; key.shadow.camera.right = 2.2; key.shadow.camera.top = 2.2; key.shadow.camera.bottom = -2.2;
  key.shadow.camera.near = 1; key.shadow.camera.far = 14; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  var fill = new HemisphereLight('#ffe9cf', '#3a2a22', 0.55);
  var rimL = new DirectionalLight('#9bb4ff', 0.9); rimL.position.set(4, 1.5, -4);
  scene.add(key, fill, rimL);

  var model = build();
  var pivot = new Group(); pivot.add(model.root); scene.add(pivot);

  /* view state */
  var zDef = options.zoom || Z_DEF;
  var yaw = 0, pitch = 0.08, zoom = zDef, tYaw = 0, tPitch = 0.08, tZoom = zDef;
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
    var sway = auto ? Math.sin(phase) * 0.55 : 0;
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
    setHelmet: function (v) { model.helmetGroup.visible = !!v; if (!v) model.flowerGroup.visible = false; wake(); },
    setFlowers: function (v) { model.flowerGroup.visible = !!v && model.helmetGroup.visible; wake(); },
    setAuto: setAuto,
    isAuto: function () { return auto; },
    highlight: function (part) {
      setEmissive(model.parts.mask, part === 'mask'); setEmissive(model.parts.crest, part === 'crest');
      if (part === 'mask') { tYaw = 0; tPitch = 0.02; tZoom = 5.2; }
      else if (part === 'crest') { tYaw = 0.7; tPitch = -0.28; tZoom = 6.0; }
      if (part && auto) setAuto(false);
      wake();
    },
    reset: function () { tYaw = 0; tPitch = 0.08; tZoom = zDef; vYaw = vPitch = 0; wake(); },
    zoom: function (dir) { tZoom = clamp(tZoom + (dir > 0 ? -0.6 : 0.6), Z_MIN, Z_MAX); wake(); },
    rotate: function (dx, dy) { tYaw = clamp(tYaw + dx, -YAW_MAX, YAW_MAX); tPitch = clamp(tPitch + dy, PITCH_MIN, PITCH_MAX); if (auto) setAuto(false); wake(); },
    state: function () { return { yaw: yaw, pitch: pitch, zoom: zoom, auto: auto, helmet: model.helmetGroup.visible, flowers: model.flowerGroup.visible }; },
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

window.MHGMask = { supported: supported, create: create, version: '1' };
