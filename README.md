# @uppy/audio (Bulb fork)

<img src="https://uppy.io/images/logos/uppy-dog-head-arrow.svg" width="120" alt="Uppy logo: a superman puppy in a pink suit" align="right">

The Audio plugin for Uppy lets you record audio using a built-in or external microphone, or any other audio device, on desktop and mobile.

This custom fork records WAV audio using `extendable-media-recorder` and `extendable-media-recorder-wav-encoder`. Version **2.0.0** requires **@uppy/core ^5.2.0** and no longer supports Uppy 3.

The recorder is imported locally and does not replace the browser's global `MediaRecorder`, keeping webcam and screen capture independent.

Uppy is being developed by the folks at [Transloadit](https://transloadit.com), a versatile file encoding service.

## Example

```js
import Uppy from '@uppy/core'
import Audio from '@uppy/audio'
import '@uppy/audio/dist/style.css'

const uppy = new Uppy()
uppy.use(Audio, {
  target: '#audio',
  preferredAudioMimeType: 'audio/wav', // Default for this fork.
  showAudioSourceDropdown: true,
})
```

The target element must exist before installing the plugin. Audio source selection, recording preview, discard, submit, and Uppy recording size restrictions are supported. Microphone access requires user permission and HTTPS or localhost.

## Installation

Keep this Git fork as the application's dependency. After committing and pushing the changes to the fork, replace `<COMMIT_SHA>` with the new full commit hash in the consuming application's `package.json`:

```json
{
  "@uppy/core": "5.2.0",
  "@uppy/audio": "git+https://github.com/teambulb/uppy-audio.git#<COMMIT_SHA>"
}
```

Then run `npm install` and commit the updated application lockfile. The old `aa36496bedc22b879f3ed3b17cf744bee246a290` pin does not include the Uppy 5 migration. Installing the official npm package or a Transloadit CDN bundle does not provide this fork's WAV integration.

## Documentation

See the [changelog](./CHANGELOG.md) for this fork's Uppy 5 migration details.

## License

[The MIT License](./LICENSE).
