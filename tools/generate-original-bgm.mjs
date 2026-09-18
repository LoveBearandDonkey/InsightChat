import fs from 'node:fs';
import path from 'node:path';

// Original, sample-free music generator for the MS Insight launch video.
// Every sound below is synthesized from oscillators or deterministic noise.

const SAMPLE_RATE = 48_000;
const DURATION = 48;
const IS_V2 = process.argv.includes('--v2');
const IS_V3 = process.argv.includes('--v3');
const IS_V4 = process.argv.includes('--v4');
const IS_V5 = process.argv.includes('--v5');
const IS_CYBER = IS_V3 || IS_V4 || IS_V5;
const BPM = IS_V4 || IS_V5 ? 138 : IS_V3 ? 128 : IS_V2 ? 124 : 120;
const BEAT = 60 / BPM;
const TOTAL = SAMPLE_RATE * DURATION;
const left = new Float64Array(TOTAL);
const right = new Float64Array(TOTAL);

let randomState = 0x4d53494e;
const random = () => {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) / 0xffffffff;
};

const midiHz = (note) => 440 * 2 ** ((note - 69) / 12);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const panGains = (pan) => {
  const angle = (pan + 1) * Math.PI / 4;
  return [Math.cos(angle), Math.sin(angle)];
};

const addVoice = (start, duration, pan, sampleAt) => {
  const startSample = Math.max(0, Math.floor(start * SAMPLE_RATE));
  const sampleCount = Math.min(
    Math.floor(duration * SAMPLE_RATE),
    TOTAL - startSample,
  );
  const [gainL, gainR] = panGains(pan);
  for (let i = 0; i < sampleCount; i++) {
    const value = sampleAt(i / SAMPLE_RATE, i, sampleCount);
    left[startSample + i] += value * gainL;
    right[startSample + i] += value * gainR;
  }
};

const addPluck = (time, note, velocity = 1, pan = 0) => {
  const frequency = midiHz(note);
  const phaseOffset = random() * Math.PI * 2;
  addVoice(time, 1.35, pan, (t) => {
    const attack = Math.min(1, t / 0.006);
    const envelope = attack * Math.exp(-4.7 * t);
    const shimmer =
      Math.sin(2 * Math.PI * frequency * t + phaseOffset) * 0.66 +
      Math.sin(2 * Math.PI * frequency * 2.01 * t + 0.3) * 0.21 +
      Math.sin(2 * Math.PI * frequency * 3.98 * t + 1.1) * 0.09;
    const transient = Math.sin(2 * Math.PI * frequency * 6.03 * t) * Math.exp(-35 * t);
    return (shimmer + transient * 0.2) * envelope * velocity * 0.19;
  });
};

const addMallet = (time, note, velocity = 1, pan = 0) => {
  const frequency = midiHz(note);
  addVoice(time, 0.9, pan, (t) => {
    const envelope = Math.min(1, t / 0.0025) * Math.exp(-7.4 * t);
    const wooden =
      Math.sin(2 * Math.PI * frequency * t) * 0.72 +
      Math.sin(2 * Math.PI * frequency * 3.01 * t) * 0.2 +
      Math.sin(2 * Math.PI * frequency * 5.07 * t) * 0.08;
    return wooden * envelope * velocity * 0.16;
  });
};

const addPad = (start, duration, notes, gain = 1) => {
  for (let voice = 0; voice < notes.length; voice++) {
    const frequency = midiHz(notes[voice]);
    const pan = -0.48 + (voice / Math.max(1, notes.length - 1)) * 0.96;
    const phase = random() * Math.PI * 2;
    addVoice(start, duration, pan, (t) => {
      const edge = Math.min(1, t / 0.55, (duration - t) / 0.75);
      const drift = 1 + Math.sin(2 * Math.PI * 0.11 * t + phase) * 0.0018;
      const tone =
        Math.sin(2 * Math.PI * frequency * drift * t + phase) * 0.7 +
        Math.sin(2 * Math.PI * frequency * 2 * drift * t + phase * 0.7) * 0.18;
      return tone * clamp(edge, 0, 1) * gain * 0.035;
    });
  }
};

const addBass = (time, note, duration = 0.43, gain = 1) => {
  const frequency = midiHz(note);
  addVoice(time, duration, 0, (t) => {
    const envelope = Math.min(1, t / 0.012) * Math.exp(-2.7 * t);
    const tone =
      Math.sin(2 * Math.PI * frequency * t) * 0.82 +
      Math.sin(2 * Math.PI * frequency * 2 * t) * 0.12;
    return tone * envelope * gain * 0.13;
  });
};

const addKick = (time, gain = 1) => {
  addVoice(time, 0.32, 0, (t) => {
    const frequency = 48 + 92 * Math.exp(-28 * t);
    const phase = 2 * Math.PI * frequency * t;
    return Math.sin(phase) * Math.exp(-14 * t) * gain * 0.34;
  });
};

const addSnare = (time, gain = 1) => {
  let lastNoise = 0;
  addVoice(time, 0.2, 0.06, (t) => {
    const noise = random() * 2 - 1;
    const highPassed = noise - lastNoise * 0.72;
    lastNoise = noise;
    const body = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-24 * t);
    return (highPassed * 0.36 + body * 0.45) * Math.exp(-19 * t) * gain * 0.17;
  });
};

const addHat = (time, gain = 1, pan = 0) => {
  let smooth = 0;
  addVoice(time, 0.085, pan, (t) => {
    const noise = random() * 2 - 1;
    smooth += (noise - smooth) * 0.18;
    return (noise - smooth) * Math.exp(-48 * t) * gain * 0.075;
  });
};

const addClap = (time, gain = 1) => {
  for (const offset of [0, 0.012, 0.026]) {
    let smooth = 0;
    addVoice(time + offset, 0.14, offset === 0.012 ? -0.18 : 0.18, (t) => {
      const noise = random() * 2 - 1;
      smooth += (noise - smooth) * 0.08;
      return (noise - smooth) * Math.exp(-30 * t) * gain * 0.055;
    });
  }
};

const addTom = (time, frequency = 112, gain = 1, pan = 0) => {
  addVoice(time, 0.34, pan, (t) => {
    const pitch = frequency * (1 + 0.28 * Math.exp(-22 * t));
    const tone =
      Math.sin(2 * Math.PI * pitch * t) * 0.8 +
      Math.sin(2 * Math.PI * pitch * 1.52 * t) * 0.14;
    return tone * Math.exp(-11 * t) * gain * 0.18;
  });
};

const addShaker = (time, gain = 1, pan = 0) => {
  let low = 0;
  addVoice(time, 0.105, pan, (t) => {
    const noise = random() * 2 - 1;
    low += (noise - low) * 0.1;
    const pulse = Math.min(1, t / 0.006) * Math.exp(-35 * t);
    return (noise - low) * pulse * gain * 0.052;
  });
};

const addRiser = (start, duration, gain = 1) => {
  let smooth = 0;
  addVoice(start, duration, 0, (t) => {
    const progress = t / duration;
    const noise = random() * 2 - 1;
    smooth += (noise - smooth) * (0.012 + progress * 0.07);
    const envelope = progress ** 2.2 * Math.min(1, (duration - t) / 0.08);
    return smooth * envelope * gain * 0.08;
  });
};

const addChime = (time, note, gain = 1) => {
  const frequency = midiHz(note);
  addVoice(time, 2.8, 0, (t) => {
    const envelope = Math.min(1, t / 0.008) * Math.exp(-1.65 * t);
    const tone =
      Math.sin(2 * Math.PI * frequency * t) * 0.62 +
      Math.sin(2 * Math.PI * frequency * 2.005 * t) * 0.2 +
      Math.sin(2 * Math.PI * frequency * 4.02 * t) * 0.08;
    return tone * envelope * gain * 0.16;
  });
};

const addCyberPulse = (time, note, duration = 0.28, gain = 1, pan = 0, brightness = 1) => {
  const frequency = midiHz(note);
  const phase = random() * Math.PI * 2;
  addVoice(time, duration, pan, (t) => {
    const attack = Math.min(1, t / 0.004);
    const release = Math.min(1, (duration - t) / 0.045);
    const envelope = attack * clamp(release, 0, 1) * Math.exp(-1.8 * t);
    let tone = 0;
    const harmonicCount = Math.max(2, Math.round(3 + brightness * 5));
    for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
      tone += Math.sin(2 * Math.PI * frequency * harmonic * t + phase) / harmonic;
    }
    const metallic = Math.sin(2 * Math.PI * frequency * 2.013 * t + phase * 0.4) * 0.14;
    return (tone * 0.42 + metallic) * envelope * gain * 0.13;
  });
};

const addReeseBass = (time, note, duration = 0.45, gain = 1) => {
  const frequency = midiHz(note);
  addVoice(time, duration, 0, (t) => {
    const attack = Math.min(1, t / 0.014);
    const release = Math.min(1, (duration - t) / 0.07);
    const wobble = 1 + Math.sin(2 * Math.PI * 1.8 * t) * 0.003;
    const tone =
      Math.sin(2 * Math.PI * frequency * 0.997 * t) * 0.62 +
      Math.sin(2 * Math.PI * frequency * 1.006 * wobble * t) * 0.5 +
      Math.sin(2 * Math.PI * frequency * 2.01 * t) * 0.16;
    return Math.tanh(tone * 1.55) * attack * clamp(release, 0, 1) * gain * 0.17;
  });
};

const addIndustrialHit = (time, gain = 1, pan = 0) => {
  let low = 0;
  addVoice(time, 0.42, pan, (t) => {
    const noise = random() * 2 - 1;
    low += (noise - low) * 0.035;
    const metal =
      Math.sin(2 * Math.PI * 347 * t) * 0.38 +
      Math.sin(2 * Math.PI * 521 * t) * 0.22 +
      Math.sin(2 * Math.PI * 739 * t) * 0.13;
    return ((noise - low) * 0.2 + metal) * Math.exp(-12 * t) * gain * 0.13;
  });
};

const addCyberSweep = (start, duration, gain = 1) => {
  let low = 0;
  addVoice(start, duration, 0, (t) => {
    const progress = t / duration;
    const noise = random() * 2 - 1;
    low += (noise - low) * (0.006 + progress * 0.13);
    const pulse = Math.sin(2 * Math.PI * (90 + 420 * progress ** 2) * t) * 0.16;
    const envelope = progress ** 1.7 * Math.min(1, (duration - t) / 0.06);
    return ((noise - low) * 0.42 + pulse) * envelope * gain * 0.11;
  });
};

// D major: Dadd9, A/C#, Bm7, Gmaj7.
const chords = [
  {pad: [50, 57, 64, 66], root: 38, tones: [62, 66, 69, 76]},
  {pad: [49, 57, 61, 64], root: 37, tones: [61, 64, 69, 73]},
  {pad: [47, 54, 57, 62], root: 35, tones: [59, 62, 66, 71]},
  {pad: [43, 50, 54, 59], root: 31, tones: [59, 62, 66, 69]},
];

const motifPatterns = [
  [0, 1, 2, 1, 3, 2, 1, 2],
  [0, 2, 1, 3, 2, 1, 3, 2],
  [0, 1, 3, 2, 1, 2, 3, 1],
  [0, 2, 3, 1, 2, 3, 1, 2],
];

if (!IS_CYBER) {
for (let bar = 0; bar < 24; bar++) {
  const start = bar * 4 * BEAT;
  const chord = chords[bar % chords.length];
  const isOpening = bar < 2;
  const isReasoning = bar >= 10 && bar < 16;
  const isQueue = bar >= 15 && bar < 19;
  const isOutro = bar >= 20;

  addPad(start, 2.08, chord.pad, isOpening ? 0.58 : isOutro ? 1.03 : 0.82);

  // The half-beat hesitation at 3.0s leaves room for the needle hitting the wall.
  const activeSteps = bar === 1 ? 4 : 8;
  for (let step = 0; step < activeSteps; step++) {
    const t = start + step * BEAT / 2;
    const index = motifPatterns[bar % motifPatterns.length][step];
    const octave = isOutro && (step === 3 || step === 7) ? 12 : 0;
    const accent = step === 0 ? 1 : step % 2 ? 0.7 : 0.82;
    addPluck(t, chord.tones[index] + octave, accent * (isOpening ? 0.76 : 1), -0.22 + (step % 3) * 0.22);
    if (!isOpening && (step === 2 || step === 6 || (isQueue && step % 2 === 1))) {
      addMallet(t, chord.tones[(index + 1) % 4] - 12, isQueue ? 0.72 : 0.52, 0.22);
    }
  }

  if (bar >= 2) {
    for (let beat = 0; beat < 4; beat++) {
      const t = start + beat * BEAT;
      addBass(t, chord.root, 0.44, isOutro ? 0.95 : 0.82);
      if (beat === 0 || beat === 2 || (isQueue && beat === 3)) addKick(t, beat === 0 ? 0.88 : 0.7);
      if (beat === 1 || beat === 3) addSnare(t, isReasoning ? 0.62 : 0.78);
      addHat(t + BEAT / 2, isReasoning ? 0.48 : isOutro ? 0.75 : 0.6, beat % 2 ? 0.3 : -0.3);
      if (isQueue) addHat(t + BEAT / 4, 0.3, -0.15);
    }
  } else {
    addHat(start + BEAT, 0.38, -0.25);
    addHat(start + BEAT * 2, 0.42, 0.25);
  }
}

if (IS_V2) {
  // A more pronounced verse-to-chorus lift. The fixed time positions stay
  // aligned to the 48-second storyboard even though the tempo is faster.
  // 18–30.5s: pre-chorus gains forward motion without crowding the narration.
  for (let t = 18; t < 30.5; t += BEAT / 2) {
    const step = Math.round((t - 18) / (BEAT / 2));
    if (step % 2 === 1) addShaker(t, 0.46, step % 4 === 1 ? -0.4 : 0.4);
    if (step % 8 === 6) addTom(t, 124, 0.3, 0.2);
  }

  // 30.5s fill: an unmistakable cue that the chorus/highlight is arriving.
  addTom(30.48, 138, 0.62, -0.4);
  addTom(30.64, 122, 0.68, -0.15);
  addTom(30.80, 106, 0.76, 0.18);
  addTom(30.96, 90, 0.86, 0.42);

  // 31–43s chorus: four-on-the-floor kick, layered clap/snare, double-time
  // hats, and a higher answering pluck phrase create the main rhythmic peak.
  for (let beatIndex = 0, t = 31; t < 43; beatIndex++, t += BEAT) {
    addKick(t, beatIndex % 4 === 0 ? 0.92 : 0.74);
    if (beatIndex % 4 === 1 || beatIndex % 4 === 3) {
      addClap(t, 0.7);
      addSnare(t, 0.58);
    }
    for (let division = 0; division < 4; division++) {
      const hatTime = t + division * BEAT / 4;
      addHat(hatTime, division % 2 ? 0.48 : 0.32, division % 2 ? 0.46 : -0.46);
    }
    if (beatIndex % 2 === 1) addShaker(t + BEAT / 2, 0.42, 0.3);
  }

  const chorusNotes = [74, 78, 81, 78, 76, 81, 83, 81];
  for (let step = 0, t = 31; t < 43; step++, t += BEAT / 2) {
    const phraseNote = chorusNotes[step % chorusNotes.length];
    addPluck(t, phraseNote, step % 4 === 0 ? 0.7 : 0.52, step % 2 ? 0.36 : -0.36);
    if (step % 4 === 2) addMallet(t, phraseNote - 12, 0.52, -0.12);
  }

  // Final percussion fill hands the energy over to the logo cadence.
  for (let i = 0; i < 6; i++) {
    addTom(43.25 + i * 0.105, 145 - i * 11, 0.54 + i * 0.04, -0.5 + i * 0.2);
  }
}

// Transition accents aligned to the storyboard.
addRiser(3.5, 0.5, 0.75);
addKick(4.0, 1.08);
addChime(4.0, 74, 0.48);
addChime(18.0, 78, 0.24); // send interaction
addRiser(30.5, 0.5, 0.48);
addChime(31.0, 81, 0.25); // queue begins
addRiser(40.0, 1.0, 0.52);

// Clean three-note logo cadence, with the rhythmic bed thinning underneath it.
addChime(44.0, 66, 0.48);
addChime(44.5, 69, 0.5);
addChime(45.0, 74, 0.72);
addChime(46.0, 78, 0.42);
} else {
  // V3 takes its production vocabulary from the reference track's broad
  // traits: cold sequenced synths, dominant sub pulse, electronic drums,
  // industrial transients, and a filtered build. Melody and harmony are new.
  const roots = [42, 38, 45, 40]; // F# minor, D, A, E
  const pulseChords = [
    [54, 57, 61, 64],
    [50, 54, 57, 61],
    [57, 61, 64, 69],
    [52, 56, 59, 64],
  ];
  const totalBeats = Math.ceil(DURATION / BEAT);

  for (let beatIndex = 0; beatIndex < totalBeats; beatIndex++) {
    const time = beatIndex * BEAT;
    const bar = Math.floor(beatIndex / 4);
    const chordIndex = bar % 4;
    const beatInBar = beatIndex % 4;
    const root = roots[chordIndex];
    const chord = pulseChords[chordIndex];
    const intro = !IS_V5 && time < 4;
    const verse = IS_V5 ? time < 31 : time >= 4 && time < 18;
    const breakSection = !IS_V5 && time >= 18 && time < 21;
    const build = !IS_V5 && time >= 21 && time < 31;
    const chorus = time >= 31 && time < 43.2;
    const logo = time >= 43.2;

    if (!breakSection && !logo) {
      addReeseBass(time, root, chorus ? BEAT * 0.9 : BEAT * 0.72, intro ? 0.42 : chorus ? 0.9 : 0.68);
    }

    if (intro) {
      if (beatInBar === 0 || beatInBar === 2) addKick(time, 0.42);
      addCyberPulse(time + BEAT / 2, chord[(beatIndex + 1) % chord.length], BEAT * 0.3, 0.38, beatInBar % 2 ? 0.34 : -0.34, 0.28 + time / 14);
    } else if (verse) {
      if (beatInBar === 0 || beatInBar === 2) addKick(time, IS_V5 ? 0.65 : 0.72);
      if (beatInBar === 1 || beatInBar === 3) addSnare(time, IS_V5 ? 0.55 : 0.66);
      addHat(time + BEAT / 2, IS_V5 ? 0.43 : 0.5, beatInBar % 2 ? 0.42 : -0.42);
      for (let division = 0; division < 2; division++) {
        const step = beatIndex * 2 + division;
        const gradualBrightness = IS_V5 ? 0.48 + Math.min(0.32, time / 100) : 0.68;
        const gradualGain = IS_V5 && time < 4 ? 0.34 + time * 0.025 : 0.46;
        addCyberPulse(time + division * BEAT / 2, chord[step % 4] + (step % 8 === 7 ? 12 : 0), BEAT * 0.34, gradualGain, division ? 0.28 : -0.28, gradualBrightness);
      }
      if (beatInBar === 3) addIndustrialHit(time + BEAT * 0.72, 0.25, 0.38);
    } else if (breakSection) {
      if (beatInBar === 0) addKick(time, 0.56);
      addCyberPulse(time, chord[(beatIndex + 2) % 4] - 12, BEAT * 0.7, 0.32, 0, 0.32);
    } else if (build) {
      addKick(time, beatInBar === 0 ? 0.82 : 0.62);
      if (beatInBar === 1 || beatInBar === 3) {
        addSnare(time, 0.72);
        addClap(time, 0.38);
      }
      addHat(time + BEAT / 2, 0.58, beatInBar % 2 ? 0.45 : -0.45);
      for (let division = 0; division < 2; division++) {
        const step = beatIndex * 2 + division;
        addCyberPulse(time + division * BEAT / 2, chord[(step + 1) % 4], BEAT * 0.36, 0.55, division ? 0.32 : -0.32, 0.9);
      }
    } else if (chorus) {
      addKick(time, IS_V5 ? (beatInBar === 0 || beatInBar === 2 ? 0.78 : 0.34) : beatInBar === 0 ? 1 : 0.78);
      if (beatInBar === 1 || beatInBar === 3) {
        addSnare(time, IS_V5 ? 0.62 : 0.78);
        addClap(time, IS_V5 ? 0.34 : 0.62);
      }
      const hatDivisions = IS_V5 ? 2 : 4;
      for (let division = 0; division < hatDivisions; division++) {
        addHat(time + division * BEAT / hatDivisions, IS_V5 ? (division ? 0.46 : 0.26) : division % 2 ? 0.54 : 0.34, division % 2 ? 0.5 : -0.5);
      }
      if (IS_V5) addShaker(time + BEAT * 0.75, 0.22, beatInBar % 2 ? 0.32 : -0.32);
      const syncopations = IS_V5 ? [0, 0.5] : [0, 0.25, 0.75];
      for (let division = 0; division < syncopations.length; division++) {
        const step = beatIndex * 3 + division;
        addCyberPulse(time + syncopations[division] * BEAT, chord[(step + 1) % 4] + (division === 2 ? 12 : 0), BEAT * 0.21, division === 2 ? 0.56 : 0.48, division === 1 ? 0.38 : -0.26, 1.18);
      }
      if (beatInBar === 3 && (!IS_V5 || bar % 2 === 1)) addIndustrialHit(time + BEAT * 0.5, IS_V5 ? 0.25 : 0.52, beatIndex % 8 ? 0.42 : -0.42);
    }
  }

  // Storyboard-specific transitions: hesitation, send, chorus launch, logo.
  if (!IS_V5) {
    addCyberSweep(3.45, 0.55, 0.62);
    addIndustrialHit(4, 0.72, -0.15);
    addCyberSweep(17.45, 0.55, 0.42);
    addIndustrialHit(18, 0.5, 0.18);
    addCyberSweep(19.3, 1.7, 0.62);
    addIndustrialHit(21, 0.72, -0.2);
    addCyberSweep(29.65, 1.35, 0.96);
    addTom(30.44, 142, 0.62, -0.45);
    addTom(30.62, 121, 0.74, -0.12);
    addTom(30.80, 101, 0.84, 0.18);
    addTom(30.96, 82, 0.96, 0.45);
    addIndustrialHit(31, 0.9, 0);
    for (let i = 0; i < 6; i++) addTom(42.72 + i * 0.1, 148 - i * 12, 0.5 + i * 0.05, -0.5 + i * 0.2);
  }
  addCyberPulse(43.4, 66, 0.46, 0.56, -0.22, 0.9);
  addCyberPulse(43.88, 69, 0.46, 0.58, 0.2, 0.9);
  addCyberPulse(44.36, 73, 0.7, 0.72, 0, 1.05);
  addReeseBass(44.36, 42, 1.5, 0.68);
  addChime(44.36, 78, 0.28);

  if (IS_V4) {
    // Percussion-forward overlay: drums remain audible as the continuous
    // background grid, while the synth sequence sits behind them.
    const beatCount = Math.ceil(DURATION / BEAT);
    for (let beatIndex = 0; beatIndex < beatCount; beatIndex++) {
      const time = beatIndex * BEAT;
      const beatInBar = beatIndex % 4;
      const breakSection = time >= 18 && time < 21;
      const chorus = time >= 31 && time < 43;
      const ending = time >= 43;

      if (!ending) {
        if (!breakSection || beatInBar === 0 || beatInBar === 2) {
          addKick(time, chorus ? 0.82 : breakSection ? 0.36 : 0.58);
        }
        if (!breakSection && (beatInBar === 1 || beatInBar === 3)) {
          addSnare(time, chorus ? 0.68 : 0.5);
          addClap(time, chorus ? 0.56 : 0.3);
        }
        for (let division = 0; division < (chorus ? 4 : 2); division++) {
          const subdivisions = chorus ? 4 : 2;
          addHat(
            time + division * BEAT / subdivisions,
            chorus ? (division % 2 ? 0.48 : 0.3) : division ? 0.4 : 0.24,
            division % 2 ? 0.52 : -0.52,
          );
        }
        addShaker(time + BEAT * 0.75, chorus ? 0.42 : breakSection ? 0.16 : 0.28, beatInBar % 2 ? 0.34 : -0.34);
      }

      if ((beatIndex + 1) % 8 === 0 && time < 42.5) {
        addTom(time + BEAT * 0.5, 128, chorus ? 0.5 : 0.34, -0.18);
        addTom(time + BEAT * 0.75, 96, chorus ? 0.62 : 0.42, 0.25);
      }
    }

    // Extra fills clearly mark the build and the full-beat chorus.
    for (let i = 0; i < 6; i++) {
      addTom(20.35 + i * 0.105, 150 - i * 10, 0.36 + i * 0.04, -0.45 + i * 0.18);
      addTom(30.35 + i * 0.105, 154 - i * 12, 0.52 + i * 0.06, -0.5 + i * 0.2);
    }
    addIndustrialHit(21, 0.82, 0);
    addIndustrialHit(31, 1.02, 0);
  }
}

// Short stereo delays provide space without using an impulse response or sample.
const dryL = left.slice();
const dryR = right.slice();
const delays = [
  {seconds: 0.1875, gain: 0.17},
  {seconds: 0.3125, gain: 0.1},
  {seconds: 0.5625, gain: 0.055},
];
for (const delay of delays) {
  const offset = Math.round(delay.seconds * SAMPLE_RATE);
  for (let i = offset; i < TOTAL; i++) {
    left[i] += dryR[i - offset] * delay.gain;
    right[i] += dryL[i - offset] * delay.gain;
  }
}

// Gentle high-pass approximation, master fade, and transparent soft limiting.
let previousInputL = 0;
let previousInputR = 0;
let previousOutputL = 0;
let previousOutputR = 0;
const hpCoefficient = 0.995;
let peak = 0;
for (let i = 0; i < TOTAL; i++) {
  const hpL = left[i] - previousInputL + hpCoefficient * previousOutputL;
  const hpR = right[i] - previousInputR + hpCoefficient * previousOutputR;
  previousInputL = left[i];
  previousInputR = right[i];
  previousOutputL = hpL;
  previousOutputR = hpR;
  const time = i / SAMPLE_RATE;
  const fadeIn = Math.min(1, time / 0.025);
  const fadeOut = time > 46.6 ? Math.max(0, (DURATION - time) / 1.4) : 1;
  left[i] = Math.tanh(hpL * 1.32) * fadeIn * fadeOut;
  right[i] = Math.tanh(hpR * 1.32) * fadeIn * fadeOut;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}

const targetPeak = 10 ** (-1 / 20);
const normalization = targetPeak / peak;
const dataSize = TOTAL * 2 * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let i = 0; i < TOTAL; i++) {
  wav.writeInt16LE(Math.round(clamp(left[i] * normalization, -1, 1) * 32767), offset);
  wav.writeInt16LE(Math.round(clamp(right[i] * normalization, -1, 1) * 32767), offset + 2);
  offset += 4;
}

const outputName = IS_V5
  ? 'ms-insight-original-bgm-v5-smooth-percussion.wav'
  : IS_V4
    ? 'ms-insight-original-bgm-v4-fast-percussion.wav'
    : IS_V3
      ? 'ms-insight-original-bgm-v3-cyber-reference.wav'
      : IS_V2
        ? 'ms-insight-original-bgm-v2-fast-chorus.wav'
        : 'ms-insight-original-bgm-v1.wav';
const outputPath = path.resolve('public', outputName);
fs.writeFileSync(outputPath, wav);
console.log(`Generated ${outputPath}`);
console.log(`${DURATION}s | ${BPM} BPM | 48 kHz | stereo | 16-bit PCM`);
console.log(`Peak normalized to -1.0 dBFS | ${(wav.length / 1024 / 1024).toFixed(2)} MiB`);
