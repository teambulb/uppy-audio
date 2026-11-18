import Uppy from '@uppy/core'
import Audio from './index.js'

{
  const uppy = new Uppy()
  uppy.use(Audio, { target: 'body', preferredAudioMimeType: 'audio/wav' })
}

{
  const uppy = new Uppy<{ tenant: string }, { url: string }>()
  uppy.use(Audio, {
    target: document.body,
    showAudioSourceDropdown: true,
    locale: { strings: { startAudioRecording: 'Record' } },
  })
  const audio: Audio<{ tenant: string }, { url: string }> | undefined = uppy.getPlugin('Audio')
  void audio
}
