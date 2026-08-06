/**
 * A zip writer, stored (uncompressed), in about eighty lines.
 *
 * The context pack is a *folder* — `docs/README.md`, `docs/DESIGN.md`, … — and
 * a browser download cannot carry a path: whatever `a.download` says, the file
 * lands flat in Downloads. Handing over eight separate files and asking the
 * user to rebuild the tree by hand is the thing this app exists to avoid.
 *
 * Stored rather than deflated because these are a few kilobytes of markdown
 * and `CompressionStream` is not everywhere yet; a stored entry is valid zip in
 * every unpacker, and the whole pack is smaller than one screenshot either way.
 */

/** Standard CRC-32 (IEEE 802.3), table built once on first use. */
let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Path inside the archive, forward slashes: `docs/DESIGN.md`. */
  path: string;
  content: string;
}

interface Prepared {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

/**
 * MS-DOS date/time, which is what the zip format stores — two 16-bit fields
 * with a two-second resolution and 1980 as year zero. Unpackers only ever show
 * this, so getting it wrong is cosmetic, but a 1980 timestamp on every file
 * reads as a corrupt archive.
 */
function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
// Bit 11 promises UTF-8 filenames. Without it an unpacker is entitled to read
// the name as CP437, which mangles any non-ASCII agent name.
const FLAG_UTF8 = 0x0800;
const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const EOCD_SIZE = 22;

export function zipBlob(entries: ZipEntry[], at = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosTime(at);

  let offset = 0;
  const prepared: Prepared[] = entries.map((entry) => {
    const name = encoder.encode(entry.path);
    const data = encoder.encode(entry.content);
    const item = { name, data, crc: crc32(data), offset };
    offset += LOCAL_HEADER + name.length + data.length;
    return item;
  });

  const centralSize = prepared.reduce((sum, p) => sum + CENTRAL_HEADER + p.name.length, 0);
  const buffer = new ArrayBuffer(offset + centralSize + EOCD_SIZE);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // ---- local file headers + data ----
  let at32 = 0;
  const put = (n: number, size: 2 | 4) => {
    if (size === 2) view.setUint16(at32, n, true);
    else view.setUint32(at32, n, true);
    at32 += size;
  };

  for (const p of prepared) {
    put(LOCAL_SIG, 4);
    put(20, 2); // version needed: 2.0, the floor for a stored entry
    put(FLAG_UTF8, 2);
    put(0, 2); // method 0 — stored
    put(time, 2);
    put(date, 2);
    put(p.crc, 4);
    put(p.data.length, 4); // compressed size == uncompressed, stored
    put(p.data.length, 4);
    put(p.name.length, 2);
    put(0, 2); // no extra field
    bytes.set(p.name, at32);
    at32 += p.name.length;
    bytes.set(p.data, at32);
    at32 += p.data.length;
  }

  // ---- central directory ----
  const centralStart = at32;
  for (const p of prepared) {
    put(CENTRAL_SIG, 4);
    put(20, 2); // version made by
    put(20, 2); // version needed
    put(FLAG_UTF8, 2);
    put(0, 2);
    put(time, 2);
    put(date, 2);
    put(p.crc, 4);
    put(p.data.length, 4);
    put(p.data.length, 4);
    put(p.name.length, 2);
    put(0, 2); // extra
    put(0, 2); // comment
    put(0, 2); // disk number
    put(0, 2); // internal attributes
    put(0, 4); // external attributes
    put(p.offset, 4);
    bytes.set(p.name, at32);
    at32 += p.name.length;
  }

  // ---- end of central directory ----
  // Measured before the EOCD is written: `put` moves the cursor, so reading
  // `at32` inside the block below would count the EOCD's own fields as part of
  // the directory and send every unpacker to the wrong offset.
  const centralEnd = at32;

  put(EOCD_SIG, 4);
  put(0, 2); // this disk
  put(0, 2); // disk with the central directory
  put(prepared.length, 2);
  put(prepared.length, 2);
  put(centralEnd - centralStart, 4);
  put(centralStart, 4);
  put(0, 2); // no archive comment

  return new Blob([buffer], { type: "application/zip" });
}
