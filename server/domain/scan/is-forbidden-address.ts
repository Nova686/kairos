import { isIPv4, isIPv6 } from 'node:net'

const parseIpv4 = (address: string): number[] => address.split('.').map(Number)

const isForbiddenIpv4 = (address: string): boolean => {
  const [first, second, third] = parseIpv4(address) as [number, number, number, number]
  return (
    first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 192 && second === 0 && third === 0)
    || (first === 198 && (second === 18 || second === 19))
    || first >= 224
  )
}

const expandIpv6Groups = (address: string): number[] => {
  const withoutZone = address.split('%')[0]!
  const lastColon = withoutZone.lastIndexOf(':')
  const trailingText = withoutZone.slice(lastColon + 1)
  const normalisedAddress = isIPv4(trailingText)
    ? `${withoutZone.slice(0, lastColon + 1)}${parseIpv4(trailingText)
      .reduce<string[]>((groups, octet, index, octets) => (index % 2 === 0 ? [...groups, ((octet << 8) | octets[index + 1]!).toString(16)] : groups), [])
      .join(':')}`
    : withoutZone
  const [headText, tailText] = normalisedAddress.split('::')
  const headGroups = headText ? headText.split(':') : []
  const tailGroups = tailText === undefined ? [] : tailText ? tailText.split(':') : []
  const missingGroupCount = tailText === undefined ? 0 : 8 - headGroups.length - tailGroups.length
  return [...headGroups, ...Array<string>(missingGroupCount).fill('0'), ...tailGroups].map(group => Number.parseInt(group, 16))
}

const embeddedIpv4 = (highGroup: number, lowGroup: number): string =>
  `${highGroup >> 8}.${highGroup & 0xff}.${lowGroup >> 8}.${lowGroup & 0xff}`

const isForbiddenIpv6 = (address: string): boolean => {
  const groups = expandIpv6Groups(address)
  const leadingZeroGroupCount = groups.findIndex(group => group !== 0)
  const isZeroPrefix = (length: number) => leadingZeroGroupCount === -1 || leadingZeroGroupCount >= length
  if (isZeroPrefix(5) && groups[5] === 0xffff) {
    return isForbiddenIpv4(embeddedIpv4(groups[6]!, groups[7]!))
  }
  if (isZeroPrefix(6)) {
    return true
  }
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every(group => group === 0)) {
    return isForbiddenIpv4(embeddedIpv4(groups[6]!, groups[7]!))
  }
  const firstGroup = groups[0]!
  return (firstGroup & 0xffc0) === 0xfe80 || (firstGroup & 0xfe00) === 0xfc00 || (firstGroup & 0xff00) === 0xff00
}

export const isForbiddenAddress = (address: string): boolean => {
  if (isIPv4(address)) {
    return isForbiddenIpv4(address)
  }
  if (isIPv6(address)) {
    return isForbiddenIpv6(address)
  }
  return true
}
