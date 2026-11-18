/* eslint-disable max-classes-per-file */
import { describe, expect, it, jest } from '@jest/globals'

async function supportsRecorder (MediaRecorder) {
  jest.resetModules()
  jest.unstable_mockModule('extendable-media-recorder', () => ({ MediaRecorder }))
  const { default: supportsMediaRecorder } = await import('./supportsMediaRecorder.js')
  return supportsMediaRecorder()
}

describe('supportsMediaRecorder', () => {
  it('detects the imported recorder without relying on the browser global', async () => {
    const nativeRecorder = globalThis.MediaRecorder
    expect(await supportsRecorder(class MediaRecorder {
      start () {} // eslint-disable-line
    })).toEqual(true)
    expect(globalThis.MediaRecorder).toBe(nativeRecorder)
  })

  it('returns false if the imported recorder is not supported', async () => {
    expect(await supportsRecorder(undefined)).toEqual(false)
    expect(await supportsRecorder(class MediaRecorder {})).toEqual(false)
  })
})
