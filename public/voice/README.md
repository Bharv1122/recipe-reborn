# On-device voice model

`vosk-model-small-en-us-0.15-commands.tar.gz` is used by the hands-free kitchen modes (/kitchen/…) for voice commands when the browser has no
Web Speech API (for example, Meta Quest Browser). It is fetched only when the user turns voice on, is recognised
entirely on the device, and is cached in the browser's IndexedDB after the first download.

- **Source:** `vosk-model-small-en-us-0.15` by Alpha Cephei Inc, https://alphacephei.com/vosk/models
  (mirrored as .tar.gz by the vosk-browser project, https://github.com/ccoreilly/vosk-browser).
- **License:** Apache License 2.0, see `LICENSE-Apache-2.0.txt`. "US English model for mobile Vosk applications.
  Copyright 2020 Alpha Cephei Inc."
- **Modification (Apache 2.0 §4b notice):** `graph/Gr.fst` has been changed. The n-gram language model was replaced
  with a one-state FST that keeps the original word symbol tables unchanged. The app only runs Vosk with a restricted
  command grammar, which never uses that language model. All other files are unchanged. macOS `._*` metadata files
  from the mirror were dropped. Copied unchanged from the Hardware Anatomy Lab project (Bharv1122/Hardware-Anatomy-Lab, `public/voice`), where `scripts/build-voice-model.py` rebuilds it.
- **Recogniser:** `vosk-browser` 0.0.8 (Apache 2.0, Ciaran O'Reilly), a WASM build of Vosk and Kaldi (both
  Apache 2.0), bundled into the app's lazily-loaded `vosk-*.js` chunk.

If you replace the model, give it a new file name. The worker caches the unpacked model under its URL.
