import { resolveClientAddress } from '../../../server/domain/accounts/resolve-client-address.ts'

describe('resolveClientAddress', () => {
  it('ignores a forged X-Forwarded-For when the app is not behind the deploy proxy', () => {
    expect(resolveClientAddress({ socketAddress: '198.51.100.20', forwardedFor: '203.0.113.7', trustsProxyHeaders: false }))
      .toBe('198.51.100.20')
    expect(resolveClientAddress({ socketAddress: '198.51.100.20', forwardedFor: '203.0.113.8, 203.0.113.9', trustsProxyHeaders: false }))
      .toBe('198.51.100.20')
  })

  it('takes the hop appended by the deploy proxy, the rightmost entry, when it trusts the proxy headers', () => {
    expect(resolveClientAddress({ socketAddress: '172.18.0.3', forwardedFor: '10.0.0.1, 203.0.113.7', trustsProxyHeaders: true }))
      .toBe('203.0.113.7')
    expect(resolveClientAddress({ socketAddress: '172.18.0.3', forwardedFor: ' 203.0.113.7 ', trustsProxyHeaders: true }))
      .toBe('203.0.113.7')
  })

  it('falls back to the socket address, then to unknown, when no usable proxy header is present', () => {
    expect(resolveClientAddress({ socketAddress: '172.18.0.3', forwardedFor: null, trustsProxyHeaders: true })).toBe('172.18.0.3')
    expect(resolveClientAddress({ socketAddress: '172.18.0.3', forwardedFor: ' , ', trustsProxyHeaders: true })).toBe('172.18.0.3')
    expect(resolveClientAddress({ socketAddress: null, forwardedFor: null, trustsProxyHeaders: false })).toBe('unknown')
  })
})
