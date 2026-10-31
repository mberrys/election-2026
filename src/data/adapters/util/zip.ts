import { inflateRawSync } from "node:zlib";

/**
 * Minimal ZIP reader (no dependencies) sufficient for Clarity's
 * `reports/detailxml.zip` (one `detail.xml` entry, deflate or stored).
 * Walks the central directory so sizes are correct even when the local
 * header uses a data descriptor.
 */
export function readZipEntry(buf: Uint8Array, wantedName: string | RegExp): Uint8Array | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (o: number) => dv.getUint32(o, true);
  const u16 = (o: number) => dv.getUint16(o, true);

  // End of central directory record: signature 0x06054b50, min 22 bytes, comment ≤ 65535.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_535); i--) {
    if (u32(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip: end of central directory not found");
  const entries = u16(eocd + 10);
  let p = u32(eocd + 16); // central directory offset

  const dec = new TextDecoder();
  for (let e = 0; e < entries; e++) {
    if (u32(p) !== 0x02014b50) throw new Error("zip: bad central directory entry");
    const method = u16(p + 10);
    const csize = u32(p + 20);
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const commentLen = u16(p + 32);
    const localOff = u32(p + 42);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    const matches = typeof wantedName === "string" ? name === wantedName : wantedName.test(name);
    if (!matches) continue;

    if (u32(localOff) !== 0x04034b50) throw new Error("zip: bad local header");
    const lNameLen = u16(localOff + 26);
    const lExtraLen = u16(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + csize);
    if (method === 0) return data;
    if (method === 8) return new Uint8Array(inflateRawSync(data));
    throw new Error(`zip: unsupported compression method ${method}`);
  }
  return null;
}
