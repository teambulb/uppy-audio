import type { LocaleStrings } from '@uppy/utils'

type AudioLocale = LocaleStrings<{
  strings: {
    pluginNameAudio: string
    startAudioRecording: string
    stopAudioRecording: string
    allowAudioAccessTitle: string
    allowAudioAccessDescription: string
    noAudioTitle: string
    noAudioDescription: string
    recordingStoppedMaxSize: string
    recordingLength: string
    submitRecordedFile: string
    discardRecordedFile: string
  }
}>

export default AudioLocale
