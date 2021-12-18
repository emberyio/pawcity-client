const pathModule = require('path')

export const getCachedAsset = (path: string, cacheDomain: string) => {
  if (!cacheDomain) throw new Error('No cache domain found - please check the storage provider configuration')
  const url = new URL('https://' + cacheDomain)
  url.pathname = pathModule.join(url.pathname, path ?? '')
  return url.href
}
