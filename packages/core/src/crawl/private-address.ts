import { isIPv4, isIPv6 } from 'node:net';

const IPV4_RANGES: Array<[number, number]> = [
  [0x00000000, 8],
  [0x0a000000, 8],
  [0x64400000, 10],
  [0x7f000000, 8],
  [0xa9fe0000, 16],
  [0xac100000, 12],
  [0xc0a80000, 16],
  [0xffffffff, 32],
];

function ipv4ToNumber(ip: string): number {
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);
}

function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToNumber(ip);
  return IPV4_RANGES.some(([base, bits]) => value >= base && value < base + 2 ** (32 - bits));
}

function expandIpv6(ip: string): number[] {
  let text = ip.split('%')[0] ?? ip;
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (isIPv4(tail)) {
    const value = ipv4ToNumber(tail);
    text = `${text.slice(0, lastColon + 1)}${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const [head = '', rest] = text.split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const restGroups = rest === undefined || rest === '' ? [] : rest.split(':');
  const missing = rest === undefined ? 0 : 8 - headGroups.length - restGroups.length;
  return [...headGroups, ...Array<string>(missing).fill('0'), ...restGroups].map((group) =>
    Number.parseInt(group, 16),
  );
}

function embeddedIpv4(groups: number[]): string | undefined {
  const zeros = (from: number, to: number) => groups.slice(from, to).every((group) => group === 0);
  const nat64 = groups[0] === 0x64 && groups[1] === 0xff9b && (zeros(2, 6) || groups[2] === 1);
  const ipv4Compatible = zeros(0, 6);
  const ipv4Mapped = zeros(0, 5) && groups[5] === 0xffff;
  const ipv4Translated = zeros(0, 4) && groups[4] === 0xffff && groups[5] === 0;
  if (!nat64 && !ipv4Compatible && !ipv4Mapped && !ipv4Translated) return undefined;
  const high = groups[6] ?? 0;
  const low = groups[7] ?? 0;
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isPrivateIpv6(ip: string): boolean {
  const groups = expandIpv6(ip);
  const first = groups[0] ?? 0;
  if (groups.every((group) => group === 0)) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true;
  const embedded = embeddedIpv4(groups);
  if (embedded) return isPrivateIpv4(embedded);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
}

export function isPrivateAddress(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIpv4(ip);
  if (isIPv6(ip)) return isPrivateIpv6(ip);
  return true;
}
