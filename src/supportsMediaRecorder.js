import { MediaRecorder } from 'extendable-media-recorder'

export default function supportsMediaRecorder () {
  /* eslint-disable compat/compat */
  return typeof MediaRecorder === 'function'
    && typeof MediaRecorder.prototype?.start === 'function'
  /* eslint-enable compat/compat */
}
