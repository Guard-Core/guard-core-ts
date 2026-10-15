import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

/* Client identity text rules shared by IP extraction and the list matchers.
   Twin of _canonical_ip_text / _canonicalize_ip / _ip_in_list in the
   reference (guard_core/_utils/ip_extraction.py, access_control.py). The
   address text is validated with node:net (strict, like Python's
   ip_address) and never with ipaddr.js, whose parser accepts hex, octal and
   long IPv4 forms. */

function expandIPv6(body: string): number[] {
  let text = body;
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const [a, b, c, d] = tail.split('.').map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = text.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = rest === undefined || rest === '' ? [] : rest.split(':');
  const fill = rest === undefined ? [] : new Array<string>(8 - left.length - right.length).fill('0');
  return [...left, ...fill, ...right].map((group) => parseInt(group, 16));
}

function compressIPv6(groups: readonly number[]): string {
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8;) {
    if (groups[i] !== 0) { i += 1; continue; }
    let j = i;
    while (j < 8 && groups[j] === 0) j += 1;
    if (j - i > bestLen) { bestStart = i; bestLen = j - i; }
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (bestLen < 2) return hex.join(':');
  return `${hex.slice(0, bestStart).join(':')}::${hex.slice(bestStart + bestLen).join(':')}`;
}

/* _canonical_ip_text: an IPv4-mapped IPv6 address without a scope id maps to
   its IPv4 text; everything else gets the compressed lowercase form. Returns
   null when the text is not an IP address. */
export function canonicalIpText(value: string): string | null {
  const family = isIP(value);
  if (family === 0) return null;
  if (family === 4) return value;
  const percent = value.indexOf('%');
  const zone = percent === -1 ? '' : value.slice(percent);
  const groups = expandIPv6(percent === -1 ? value : value.slice(0, percent));
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) {
    const v4 = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return zone === '' ? v4 : `::ffff:${v4}${zone}`;
  }
  return compressIPv6(groups) + zone;
}

/* _strip_ip_brackets + _canonicalize_ip: unparseable values come back as given. */
export function canonicalizeIp(value: string): string {
  const unbracketed = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  return canonicalIpText(unbracketed) ?? value;
}

function parseCanonical(text: string): ipaddr.IPv4 | ipaddr.IPv6 {
  const canonical = canonicalIpText(text);
  if (canonical === null) throw new Error(`invalid IP address: ${text}`);
  return ipaddr.parse(canonical);
}

/* _ip_in_list: a CIDR entry matches by network membership of the canonical
   client address (an IPv4 network therefore matches a client that connected
   as IPv4-mapped IPv6); a plain entry matches by canonical text. Throws on an
   unparseable client or CIDR entry, like the reference ValueError. */
export function ipInList(ip: string, entries: readonly string[] | null | undefined): boolean {
  if (!entries || entries.length === 0) return false;
  const canonical = canonicalizeIp(ip);
  for (const entry of entries) {
    if (entry.includes('/')) {
      const parsed = parseCanonical(ip);
      const [addr, prefixLen] = ipaddr.parseCIDR(entry);
      if (parsed.kind() === addr.kind() && parsed.match([addr, prefixLen])) return true;
    } else if (canonical === canonicalizeIp(entry)) {
      return true;
    }
  }
  return false;
}
