import { isForbiddenAddress } from '../../../server/domain/scan/is-forbidden-address.ts'

describe('isForbiddenAddress', () => {
  it.each([
    ['loopback', '127.0.0.1'],
    ['loopback range', '127.255.255.254'],
    ['unspecified', '0.0.0.0'],
    ['this network', '0.1.2.3'],
    ['private 10/8', '10.0.0.1'],
    ['private 172.16/12 start', '172.16.0.1'],
    ['private 172.16/12 end', '172.31.255.255'],
    ['private 192.168/16', '192.168.1.1'],
    ['CGNAT start', '100.64.0.1'],
    ['CGNAT end', '100.127.255.255'],
    ['link-local metadata', '169.254.169.254'],
    ['multicast', '224.0.0.1'],
    ['broadcast', '255.255.255.255'],
    ['IPv6 loopback', '::1'],
    ['IPv6 unspecified', '::'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv6 link-local upper', 'febf::1'],
    ['IPv6 ULA fc', 'fc00::1'],
    ['IPv6 ULA fd', 'fd12:3456::1'],
    ['IPv6 multicast', 'ff02::1'],
    ['IPv4-mapped loopback', '::ffff:127.0.0.1'],
    ['IPv4-mapped loopback hex', '::ffff:7f00:1'],
    ['IPv4-mapped private', '::ffff:10.0.0.1'],
    ['IPv4-mapped metadata', '::ffff:a9fe:a9fe'],
    ['NAT64 loopback', '64:ff9b::7f00:1'],
    ['IPv4-compatible', '::7f00:1'],
  ])('forbids %s (%s)', (_label, address) => {
    expect(isForbiddenAddress(address)).toBe(true)
  })

  it.each([
    ['public IPv4', '93.184.216.34'],
    ['just below 172.16/12', '172.15.255.255'],
    ['just above 172.16/12', '172.32.0.1'],
    ['just below CGNAT', '100.63.255.255'],
    ['just above CGNAT', '100.128.0.1'],
    ['just below 192.168', '192.167.1.1'],
    ['public IPv6', '2606:4700:4700::1111'],
    ['IPv4-mapped public', '::ffff:93.184.216.34'],
    ['IPv4-mapped public hex', '::ffff:5db8:d822'],
  ])('allows %s (%s)', (_label, address) => {
    expect(isForbiddenAddress(address)).toBe(false)
  })

  it('forbids anything that is not an IP address', () => {
    expect(isForbiddenAddress('example.com')).toBe(true)
  })
})
