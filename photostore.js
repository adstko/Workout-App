// photostore.js — where progress photos are kept. PRIVATE: photos only ever live in this phone's browser
// (IndexedDB). Nothing here talks to the network, and photos are never part of the normal Export or the
// online features. (The small info about each check-in is in its own localStorage key, not in `data`.)

const PHOTO_DB = "workout-photos";
const PHOTO_META_KEY = "workout-photos-meta";
const POSES = [["front", "Front"], ["side", "Side"], ["back", "Back"]];

// ---------- small info (dates, notes, ids) ----------
let photoMeta = loadPhotoMeta();

function loadPhotoMeta() {
  const base = { checkins: [], nextNumber: 1, hide: true, introSeen: false, pin: null };
  try {
    const m = JSON.parse(localStorage.getItem(PHOTO_META_KEY));
    if (m && typeof m === "object") {
      for (const k in base) if (m[k] === undefined) m[k] = base[k];
      if (!Array.isArray(m.checkins)) m.checkins = [];
      return m;
    }
  } catch (e) { /* unreadable: start empty (the old text is left alone) */ }
  return base;
}

function savePhotoMeta() {
  try { localStorage.setItem(PHOTO_META_KEY, JSON.stringify(photoMeta)); } catch (e) { return false; }
  return true;
}

// ---------- the photos themselves (IndexedDB) ----------
let photoDbPromise = null;

function photoDb() {
  if (!photoDbPromise) {
    photoDbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("This browser can't store photos."));
      const req = indexedDB.open(PHOTO_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("photos", { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Could not open photo storage."));
    });
    photoDbPromise.catch(() => { photoDbPromise = null; });
  }
  return photoDbPromise;
}

function photoTx(mode, work) {
  return photoDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction("photos", mode);
    const result = work(tx.objectStore("photos"));
    tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : undefined);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error("Photo storage failed."));
  }));
}

const putPhoto = rec => photoTx("readwrite", s => { s.put(rec); });
const getPhoto = id => photoTx("readonly", s => s.get(id));
const deletePhotos = ids => photoTx("readwrite", s => { ids.forEach(id => s.delete(id)); });
const clearPhotos = () => photoTx("readwrite", s => { s.clear(); });
const countPhotos = () => photoTx("readonly", s => s.count());

// Ask the browser not to throw our photos away when it is low on space (best effort)
function keepPhotosSafe() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* fine */ }
}

// ---------- shrinking a picked photo ----------
// Drawing onto a canvas and saving again makes a fresh JPEG: this also drops the hidden location (GPS) and camera info.
function loadBitmap(file) {
  if (window.createImageBitmap) {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => loadImg(file));
  }
  return loadImg(file);
}

function loadImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a picture this phone can open.")); };
    img.src = url;
  });
}

function canvasJpeg(source, w, h, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error("Could not shrink that photo.")), "image/jpeg", quality));
}

// -> { full: ArrayBuffer (max 1200px long side, JPEG 0.8), thumb: ArrayBuffer (max 320px) }
async function processPhoto(file) {
  const bmp = await loadBitmap(file);
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  if (!w || !h) throw new Error("That file isn't a picture this phone can open.");
  const full = await canvasJpeg(bmp, w, h, 1200, 0.8);
  const thumb = await canvasJpeg(bmp, w, h, 320, 0.7);
  if (bmp.close) bmp.close();
  return { full: await full.arrayBuffer(), thumb: await thumb.arrayBuffer() };
}

// ---------- 4-digit PIN (an app lock, not encryption) ----------
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

async function hashPin(pin, saltHex) {
  if (!(window.crypto && crypto.subtle)) throw new Error("PIN needs a secure page (https).");
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: 100000 }, key, 256));
}

async function makePinRecord(pin) {
  const saltHex = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt: saltHex, hash: await hashPin(pin, saltHex) };
}

async function pinMatches(pin) {
  return photoMeta.pin ? (await hashPin(pin, photoMeta.pin.salt)) === photoMeta.pin.hash : true;
}

// ---------- ZIP (no compression: JPEGs are already compressed) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, bytes: Uint8Array }] -> Blob
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), crc = crc32(f.bytes), size = f.bytes.length;
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); // 0x0800 = UTF-8 names
    head.setUint16(8, 0, true); head.setUint16(10, 0, true); head.setUint16(12, 0x21, true);           // stored, date 1980-01-01
    head.setUint32(14, crc, true); head.setUint32(18, size, true); head.setUint32(22, size, true);
    head.setUint16(26, name.length, true); head.setUint16(28, 0, true);
    parts.push(head.buffer, name, f.bytes);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + size;
  });
  const centralSize = central.reduce((n, p) => n + (p.byteLength !== undefined ? p.byteLength : p.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}

// Reads a ZIP made by makeZip (stored files only) -> [{ name, bytes }], or throws
function readZip(buffer) {
  const v = new DataView(buffer), bytes = new Uint8Array(buffer), dec = new TextDecoder();
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("That isn't a photo backup file.");
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("That backup file is damaged.");
    const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true), name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (method !== 0) throw new Error("That backup file isn't one made by this app.");
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const body = bytes.subarray(start, start + size);
    if (crc32(body) !== crc) throw new Error("That backup file is damaged.");
    out.push({ name: name, bytes: body });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
