export type ClientAddressSources = {
  socketAddress: string | null
  forwardedFor: string | null
  trustsProxyHeaders: boolean
}

const unknownClientAddress = 'unknown'

const lastForwardedHop = (forwardedFor: string | null): string | null => {
  const forwardedHops = (forwardedFor ?? '').split(',').map(hop => hop.trim()).filter(hop => hop !== '')
  return forwardedHops.at(-1) ?? null
}

export const resolveClientAddress = ({ socketAddress, forwardedFor, trustsProxyHeaders }: ClientAddressSources): string =>
  (trustsProxyHeaders ? lastForwardedHop(forwardedFor) : null) ?? socketAddress ?? unknownClientAddress
