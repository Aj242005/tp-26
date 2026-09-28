# Prooflane film

An editable, 120-second Remotion composition at 1920 × 1080, 30 fps. It introduces Prooflane first, then explains its use case, evidence, reviewed format adaptation, architecture and declared scope.

**Current status:** timing preview. The reference narration is synthetic en-IN speech, clearly labelled in the film. The final voice is pending the creator's recording for VoiceStudio. No voice has been cloned yet.

- `NARRATION.md`: plain-English script with scene timings.
- `script.json`: single source for scene durations and spoken copy.
- `src/Film.tsx`: animation, diagrams, source example and product footage.
- `public/prooflane-en-IN.srt`: timed English subtitles.
- `../docs/deliverables/prooflane-timing-preview.mp4`: review copy after rendering.
- `build/scene-*.png`: full-resolution frame checks.

## Edit and render

```powershell
npm ci
npm run studio
```

To regenerate the temporary narration and original music:

```powershell
uv run --with edge-tts --with imageio-ffmpeg --with numpy --with pillow python scripts/prepare.py
npm run check
node scripts/render.mjs --stills
npm run render
```

The preview speech uses Microsoft's Edge TTS service, receiving only the authored script. The score is generated locally from original tones and transitions; no commercial music, stock images or Pinterest assets are included. Fonts are bundled Geist and Geist Mono. Icons use Lucide. Product captures are existing local recordings/screenshots with synthetic records.

## Evidence and editorial choices

The SSH example is from `../fixtures/ios-review.cfg`, line 5. Rule AC-04 is in `../service/policies.py`. Counts and coverage follow `../docs/coverage.md`. Qualification figures follow `../docs/verification.md`: the one-hour local synthetic soak had 180,000 metadata reads and 60 completed audit/PDF jobs. These are documented prior results, not tests performed as part of video production.

Twenty checks and Cisco/Junos/FortiOS support are explicitly scoped. Framework crosswalks are not certification. Investigation produces drafts; approval remains human. The product never changes live equipment. The 3D capture shows recorded provenance. It is not a network topology or an execution-time measurement.

## Your voice recording

Provide 30–60 seconds of your normal speaking voice in English, recorded in a quiet room. WAV, M4A or MP3 is fine. Use one speaker, no music or sound effects, and avoid noise reduction that makes the voice sound metallic. Include the exact words spoken, or read the passage below so its transcript is already known. Keep the original recording; a clean excerpt will be selected for the reference.

> Hello. Today I am presenting Prooflane, a project that helps network teams understand security findings. When we review a router or firewall, we should be able to see what was found, what was expected, and where the evidence came from. Our approach keeps each decision clear, allows a person to review new interpretations, and preserves the history of every audit. Let me show you how it works.

Speak naturally in your own Indian English accent. This reference is for voice matching; it is separate from the timed final narration in `NARRATION.md`.

## Tool sources

VoiceStudio source: https://github.com/debpalash/VoiceStudio, checked out at `08a1592e3cb9b4c36beef5fa3185ec2313bb1fea`. Installed release: v0.5.6, Windows x64 Electron; installer SHA-256 `3d7ac1d6b54e7854ca7fff4dda838e402d1c5d31acc9656b1838432e29a97624`, verified against its release manifest.

Source discovery used `webcmd web fetch` (GitHub returned `FETCH_BLOCKED`), then the successfully cloned primary repository and GitHub's release API. Browser fallback was unnecessary for source retrieval. The Webcmd browser health check timed out; the installed app's local diagnostic interface is used for setup verification. Private voice references and tool checkout are ignored by Git.
