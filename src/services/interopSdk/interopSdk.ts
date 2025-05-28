import { isValidInteropAddress, getChainId, computeChecksum } from '@defi-wonderland/interop'

export async function getChecksumAddress(address: string): Promise<string> {
  const checksum = await computeChecksum(address)
  return `${address}#${checksum}`
}

export async function toChecksumAddress(address: string): Promise<string> {
  if (address.includes('#')) return address
  return getChecksumAddress(address)
}

export async function resolveInteropAddress(address: string): Promise<string> {
  const addressToValidate = await toChecksumAddress(address)
  const isValid = await isValidInteropAddress(addressToValidate)
  return isValid ? address : ''
}

export async function getInteropAddressChain(interopAddress: string): Promise<number> {
  try {
    const chainId = await getChainId(interopAddress)
    return Number(chainId)
  } catch (error) {
    return 0
  }
}

export async function getInteropAddressChainId(address: string): Promise<number> {
  try {
    const interopAddress = await toChecksumAddress(address)
    const chainId = await getChainId(interopAddress)
    return Number(chainId)
  } catch {
    return 0
  }
}
