import assert from 'node:assert/strict'
import { verifiedGithubCover, MAX_APPROVED_COVER_BYTES } from '../lib/approved-cover-payload.ts'

// A real, decodable 40 x 24 WebP test image, not a fabricated RIFF header.
const tiny = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvJ8AFAAfQsWqUqv+BiOh/AAA=', 'base64')
const sha = 'a'.repeat(40)
const normal = { type: 'file', encoding: 'base64', size: tiny.byteLength, sha,
  content: tiny.toString('base64') }
let rawCalls=0
const normalDecoded = await verifiedGithubCover(normal,async()=>{
  rawCalls++
  throw Error('Small WebP should not require an extra request')
})
assert.deepEqual(Buffer.from(normalDecoded?.bytes ?? []),tiny)
assert.equal(normalDecoded?.etag,sha)
assert.equal(rawCalls,0)

// The GitHub Contents API only returns inline content for <= 1 MB.
// The object representation of a larger file contains encoding: none.
const big = Buffer.alloc(1_100_000,0)
tiny.copy(big)
big.writeUInt32LE(big.byteLength - 8,4)
const largeMeta={type:'file',encoding:'none',content:'',size:big.byteLength,sha}
const bigDecoded=await verifiedGithubCover(largeMeta,async()=>{
  rawCalls++
  return new Response(new Uint8Array(big),{
    status:200,headers:{'content-type':'application/octet-stream','content-length':String(big.byteLength)},
  })
})
assert.deepEqual(Buffer.from(bigDecoded?.bytes ?? []),big)
assert.equal(bigDecoded?.etag,sha)
assert.equal(rawCalls,1,'Raw media type must be requested for large WebP')

// Invalid and oversized images must never be served.
assert.equal(await verifiedGithubCover({...normal,size:MAX_APPROVED_COVER_BYTES+1},async()=>{
  throw Error('Oversize image must not be fetched')
}),null)
assert.equal(await verifiedGithubCover({...normal,content:Buffer.from('not an image').toString('base64'),
  size:12},async()=>new Response()),null)
assert.equal(await verifiedGithubCover({...largeMeta,sha:'not-a-git-sha'},async()=>new Response()),null)
assert.equal(await verifiedGithubCover(largeMeta,async()=>new Response('Not found',{status:404})),null)
assert.equal(await verifiedGithubCover(largeMeta,async()=>new Response(new Uint8Array(big),{
  status:200,headers:{'content-length':String(MAX_APPROVED_COVER_BYTES+1)},
})),null)
console.log('Approved WebP: valid inline file, >1 MB raw-file fallback, size/type constraints and stable ETag passed.')
