import { h } from 'preact'

import { UIPlugin } from '@uppy/core'

import { MediaRecorder, register } from 'extendable-media-recorder'
import { connect } from 'extendable-media-recorder-wav-encoder'
import supportsMediaRecorder from './supportsMediaRecorder.js'
import RecordingScreen from './RecordingScreen.jsx'
import PermissionsScreen from './PermissionsScreen.jsx'
import locale from './locale.js'

import packageJson from '../package.json'

// Share registration across recordings and plugin instances; retry failed initialization.
let wavEncoder
function initializeWavEncoder () {
  if (!wavEncoder) {
    wavEncoder = connect().then(register).catch((err) => {
      wavEncoder = null
      throw err
    })
  }
  return wavEncoder
}

/**
 * Audio recording plugin
 */
export default class Audio extends UIPlugin {
  static VERSION = packageJson.version

  #startRequest = null

  #recordingStartPending = false

  #recordingStopPromise = null

  #stream = null

  #audioActive = false

  #recordingChunks = null

  #recorder = null

  #capturedMediaFile = null

  #mediaDevices = null

  #supportsUserMedia = null

  constructor (uppy, opts) {
    super(uppy, opts)
    this.#mediaDevices = navigator.mediaDevices
    this.#supportsUserMedia = this.#mediaDevices != null
    this.id = this.opts.id || 'Audio'
    this.type = 'acquirer'
    this.icon = () => (
      <svg aria-hidden="true" focusable="false" width="32px" height="32px" viewBox="0 0 32 32">
        <g fill="none" fill-rule="evenodd">
          <rect fill="#9B59B6" width="32" height="32" rx="16" />
          <path d="M16 20c-2.21 0-4-1.71-4-3.818V9.818C12 7.71 13.79 6 16 6s4 1.71 4 3.818v6.364C20 18.29 18.21 20 16 20zm-6.364-7h.637c.351 0 .636.29.636.65v1.95c0 3.039 2.565 5.477 5.6 5.175 2.645-.264 4.582-2.692 4.582-5.407V13.65c0-.36.285-.65.636-.65h.637c.351 0 .636.29.636.65v1.631c0 3.642-2.544 6.888-6.045 7.382v1.387h2.227c.351 0 .636.29.636.65v.65c0 .36-.285.65-.636.65h-6.364a.643.643 0 0 1-.636-.65v-.65c0-.36.285-.65.636-.65h2.227v-1.372C11.637 22.2 9 19.212 9 15.6v-1.95c0-.36.285-.65.636-.65z" fill="#FFF" fill-rule="nonzero" />
        </g>
      </svg>
    )

    this.defaultLocale = locale

    this.opts = { preferredAudioMimeType: 'audio/wav', ...opts }

    this.i18nInit()
    this.title = this.i18n('pluginNameAudio')

    this.setPluginState({
      hasAudio: false,
      audioReady: false,
      cameraError: null,
      recordingLengthSeconds: 0,
      audioSources: [],
      currentDeviceId: null,
    })
  }

  #hasAudioCheck () {
    if (!this.#mediaDevices) {
      return Promise.resolve(false)
    }

    return this.#mediaDevices.enumerateDevices().then(devices => {
      return devices.some(device => device.kind === 'audioinput')
    })
  }

  // eslint-disable-next-line consistent-return
  #start = (options = null) => {
    if (!this.#supportsUserMedia) {
      return Promise.reject(new Error('Microphone access not supported'))
    }

    this.#audioActive = true
    const request = this.#startRequest = {}

    return this.#hasAudioCheck().then(hasAudio => {
      if (request !== this.#startRequest) return
      this.setPluginState({
        hasAudio,
      })

      // ask user for access to their camera
      return this.#mediaDevices.getUserMedia({ audio: options?.deviceId ? { deviceId: { exact: options.deviceId } } : true })
        .then((stream) => {
          if (request !== this.#startRequest) {
            stream.getTracks().forEach(track => track.stop())
            return
          }
          this.#stream = stream

          let currentDeviceId = null
          const tracks = stream.getAudioTracks()

          if (!options || !options.deviceId) {
            currentDeviceId = tracks[0].getSettings().deviceId
          } else {
            tracks.forEach((track) => {
              if (track.getSettings().deviceId === options.deviceId) {
                currentDeviceId = track.getSettings().deviceId
              }
            })
          }

          // Update the sources now, so we can access the names.
          this.#updateSources()

          this.setPluginState({
            currentDeviceId,
            audioReady: true,
          })
        })
        .catch((err) => {
          if (request !== this.#startRequest) return
          this.setPluginState({
            audioReady: false,
            cameraError: err,
          })
          this.uppy.info(err.message, 'error')
        })
    })
  }

  #getMediaRecorderMimeType = () => {
    const options = {}
    // Safari doesn't have the `isTypeSupported` API.
    if (MediaRecorder.isTypeSupported) {
      if (this.opts.preferredAudioMimeType && MediaRecorder.isTypeSupported(this.opts.preferredAudioMimeType)) {
        options.mimeType = this.opts.preferredAudioMimeType
      }
    }
    options.mimeType = this.opts.preferredAudioMimeType
    return options
  }

  #startRecording = async () => {
    if (this.#recordingStartPending || this.#recorder || !this.#stream) return
    this.#recordingStartPending = true
    const stream = this.#stream
    try {
      await initializeWavEncoder()
    } catch (err) {
      this.uppy.log(err, 'error')
      this.uppy.info(err.message, 'error')
      return
    } finally {
      this.#recordingStartPending = false
    }
    // The view may have closed or changed source while the encoder initialized.
    if (stream !== this.#stream) return

    this.#recorder = new MediaRecorder(this.#stream, this.#getMediaRecorderMimeType())
    this.#recordingChunks = []
    let stoppingBecauseOfMaxSize = false
    this.#recorder.addEventListener('dataavailable', (event) => {
      this.#recordingChunks.push(event.data)

      const { restrictions } = this.uppy.opts
      if (this.#recordingChunks.length > 1
        && restrictions.maxFileSize != null
        && !stoppingBecauseOfMaxSize) {
        const totalSize = this.#recordingChunks.reduce((acc, chunk) => acc + chunk.size, 0)
        // Exclude the initial chunk from the average size calculation because it is likely to be a very small outlier
        const averageChunkSize = (totalSize - this.#recordingChunks[0].size) / (this.#recordingChunks.length - 1)
        const expectedEndChunkSize = averageChunkSize * 3
        const maxSize = Math.max(0, restrictions.maxFileSize - expectedEndChunkSize)

        if (totalSize > maxSize) {
          stoppingBecauseOfMaxSize = true
          this.uppy.info(this.i18n('recordingStoppedMaxSize'), 'warning', 4000)
          this.#stopRecording()
        }
      }
    })

    // use a "time slice" of 500ms: ondataavailable will be called each 500ms
    // smaller time slices mean we can more accurately check the max file size restriction
    this.#recorder.start(500)

    // Start the recordingLengthTimer if we are showing the recording length.
    this.recordingLengthTimer = setInterval(() => {
      const currentRecordingLength = this.getPluginState().recordingLengthSeconds
      this.setPluginState({ recordingLengthSeconds: currentRecordingLength + 1 })
    }, 1000)

    this.setPluginState({
      isRecording: true,
    })
  }

  #stopRecording = () => {
    if (this.#recordingStopPromise) return this.#recordingStopPromise
    if (!this.#recorder || this.#recorder.state === 'inactive') return Promise.resolve()
    const stream = this.#stream
    const stopped = new Promise((resolve) => {
      this.#recorder.addEventListener('stop', () => {
        resolve()
      })
      this.#recorder.stop()

      clearInterval(this.recordingLengthTimer)
      this.setPluginState({ recordingLengthSeconds: 0 })
    })

    this.#recordingStopPromise = stopped.then(() => {
      if (!stream || stream !== this.#stream) return
      this.setPluginState({
        isRecording: false,
      })
      return this.#getAudio()
    }).then((file) => {
      if (!stream || stream !== this.#stream) return
      try {
        this.#capturedMediaFile = file
        // create object url for capture result preview
        this.setPluginState({
          recordedAudio: URL.createObjectURL(file.data),
        })
      } catch (err) {
        // Logging the error, except restrictions, which is handled in Core
        if (!err.isRestriction) {
          this.uppy.log(err)
        }
      }
    }).then(() => {
      this.#recordingChunks = null
      this.#recorder = null
    }, (error) => {
      this.#recordingChunks = null
      this.#recorder = null
      throw error
    }).finally(() => {
      this.#recordingStopPromise = null
    })
    return this.#recordingStopPromise
  }

  #discardRecordedAudio = () => {
    this.setPluginState({ recordedAudio: null })
    this.#capturedMediaFile = null
  }

  #submit = () => {
    try {
      if (this.#capturedMediaFile) {
        this.uppy.addFile(this.#capturedMediaFile)
      }
    } catch (err) {
      // Logging the error, except restrictions, which is handled in Core
      if (!err.isRestriction) {
        this.uppy.log(err, 'error')
      }
    }
  }

  #stop = async () => {
    this.#startRequest = {}
    const stream = this.#stream
    this.#stream = null
    clearInterval(this.recordingLengthTimer)
    if (stream) {
      const audioTracks = stream.getAudioTracks()
      audioTracks.forEach((track) => track.stop())
    }

    await this.#stopRecording()

    this.#recordingChunks = null
    this.#recorder = null
    this.#audioActive = false
    this.#stream = null

    if (!this.uppy.getPlugin(this.id)) return
    this.setPluginState({
      recordedAudio: null,
      isRecording: false,
      recordingLengthSeconds: 0,
    })
  }

  #getAudio () {
    // Sometimes in iOS Safari, Blobs (especially the first Blob in the recordingChunks Array)
    // have empty 'type' attributes (e.g. '') so we need to find a Blob that has a defined 'type'
    // attribute in order to determine the correct MIME type.
    const mimeType = this.#recordingChunks.find(blob => blob.type?.length > 0).type

    const fileExtension = this.getFileTypeExtension(mimeType)

    if (!fileExtension) {
      return Promise.reject(new Error(`Could not retrieve recording: Unsupported media type "${mimeType}"`))
    }

    const name = `audio-${Date.now()}.${fileExtension}`
    const blob = new Blob(this.#recordingChunks, { type: mimeType })
    const file = {
      source: this.id,
      name,
      data: new Blob([blob], { type: mimeType }),
      type: mimeType,
    }

    return Promise.resolve(file)
  }

  #changeSource = async (deviceId) => {
    const stopped = this.#stop()
    const request = this.#startRequest
    await stopped
    if (request === this.#startRequest) await this.#start({ deviceId })
  }

  #updateSources = () => {
    this.#mediaDevices.enumerateDevices().then(devices => {
      this.setPluginState({
        audioSources: devices.filter((device) => device.kind === 'audioinput'),
      })
    })
  }

  render () {
    if (!this.#audioActive) {
      this.#start()
    }

    const audioState = this.getPluginState()

    if (!audioState.audioReady || !audioState.hasAudio) {
      return (
        <PermissionsScreen
          icon={this.icon}
          i18n={this.i18n}
          hasAudio={audioState.hasAudio}
        />
      )
    }

    return (
      <RecordingScreen
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...audioState}
        audioActive={this.#audioActive}
        onChangeSource={this.#changeSource}
        onStartRecording={this.#startRecording}
        onStopRecording={this.#stopRecording}
        onDiscardRecordedAudio={this.#discardRecordedAudio}
        onSubmit={this.#submit}
        onStop={this.#stop}
        i18n={this.i18n}
        showAudioSourceDropdown={this.opts.showAudioSourceDropdown}
        supportsRecording={supportsMediaRecorder()}
        recording={audioState.isRecording}
        stream={this.#stream}
      />
    )
  }

  install () {
    this.setPluginState({
      audioReady: false,
      recordingLengthSeconds: 0,
    })

    const { target } = this.opts
    if (target) {
      this.mount(target, this)
    }

    if (this.#mediaDevices) {
      this.#updateSources()

      this.#mediaDevices.ondevicechange = () => {
        this.#updateSources()

        if (this.#stream) {
          let restartStream = true

          const { audioSources, currentDeviceId } = this.getPluginState()

          audioSources.forEach((audioSource) => {
            if (currentDeviceId === audioSource.deviceId) {
              restartStream = false
            }
          })

          if (restartStream) {
            this.#stop()
            this.#start()
          }
        }
      }
    }
  }

  getFileTypeExtension = (mimeType) => {
    const ext = {
      'audio/mp3': 'mp3',
      'audio/mp4': 'mp4',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
    }
    return ext[mimeType] || null
  }

  uninstall () {
    this.#stop()
    this.unmount()
  }
}
