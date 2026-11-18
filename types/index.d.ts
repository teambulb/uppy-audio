import type { Body, Meta, UIPluginOptions, Uppy } from '@uppy/core'
import { UIPlugin } from '@uppy/core'
import type AudioLocale from './generatedLocale.js'

export interface AudioOptions extends UIPluginOptions {
  showAudioSourceDropdown?: boolean
  locale?: AudioLocale
  preferredAudioMimeType?: string
}

declare module '@uppy/core' {
  interface PluginTypeRegistry<M extends Meta, B extends Body> {
    Audio: Audio<M, B>
  }
}

declare class Audio<M extends Meta = Meta, B extends Body = Body> extends UIPlugin<AudioOptions, M, B> {
  constructor(uppy: Uppy<M, B>, opts?: AudioOptions)
}

export default Audio
