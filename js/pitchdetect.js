import { ui } from './ui.js';
import pitchData from '../data/notes-with-midi.js';
import ham from 'https://hamilsauce.github.io/hamhelper/hamhelper1.0.0.js';

const { template, download } = ham;

window.AudioContext = window.AudioContext || window.webkitAudioContext;

const pitchArray = pitchData.notes;
console.log('pitchArray', pitchArray)

const midiPitchMap = new Map(pitchArray.map(_ => [_.midi, _]))

const demoPitchesGrouped = {}

let audioContext = null;
let isPlaying = false;
let sourceNode = null;
let analyser = null;
let theBuffer = null;
let mediaStreamSource = null;
let
  detectorElem,
  pitchElem,
  noteElem,
  detuneElem,
  detuneAmount;

let detectToggle;
let demoToggle;

window.onload = function() {
  audioContext = new AudioContext();

  let MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000)); // corresponds to a 5kHz signal

  detectorElem = document.getElementById("detector");
  pitchElem = document.getElementById("pitch");
  noteElem = document.getElementById("note");
  detuneElem = document.getElementById("detune");
  detuneAmount = document.getElementById("detune_amt");

  detectToggle = document.getElementById("detect-toggle");
  demoToggle = document.getElementById("demo-toggle");
}

export async function startPitchDetect() {
  audioContext = new AudioContext();

  const stream = await navigator.mediaDevices.getUserMedia({
    "audio": {
      "mandatory": {
        "googEchoCancellation": "false",
        "googAutoGainControl": "false",
        "googNoiseSuppression": "false",
        "googHighpassFilter": "false"
      },
      "optional": []
    },
  })



  mediaStreamSource = audioContext.createMediaStreamSource(stream);

  // Connect it to the destination.
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  mediaStreamSource.connect(analyser);
  updatePitch();
  ui.detectToggle.classList.add('active')



  // .then((stream) => {
  //   mediaStreamSource = audioContext.createMediaStreamSource(stream);

  //   // Connect it to the destination.
  //   analyser = audioContext.createAnalyser();
  //   analyser.fftSize = 2048;
  //   mediaStreamSource.connect(analyser);
  //   updatePitch();
  //   ui.detectToggle.classList.add('active')}).catch((err) => {
  //   console.error(`${err.name}: ${err.message}`);
  //   alert('Stream generation failed.');
  // });
}

function toggleLiveInput() {
  if (isPlaying) {
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
  }
  getUserMedia({
    "audio": {
      "mandatory": {
        "googEchoCancellation": "false",
        "googAutoGainControl": "false",
        "googNoiseSuppression": "false",
        "googHighpassFilter": "false"
      },
      "optional": []
    },
  }, gotStream);
}

function togglePlayback() {
  if (isPlaying) {
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;

    ui.demoToggle.classList.remove('active');

    return "start";
  }

  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = theBuffer;
  sourceNode.loop = true;

  const isLiveInput = false;
  const gain1 = audioContext.createGain();

  gain1.gain.value = 1

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  analyser.connect(gain1);
  gain1.connect(audioContext.destination);
  sourceNode.start(0);
  isPlaying = true;

  updatePitch();

  ui.demoToggle.classList.add('active');

  return "stop";
}

let rafID = null;
let tracks = null;
let buflen = 2048;
let buf = new Float32Array(buflen);

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const noteFromPitch = async (frequency) => {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

const frequencyFromNoteNumber = async (note) => 440 * Math.pow(2, (note - 69) / 12);

const centsOffFromPitch = async (frequency, note) => Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));

function autoCorrelate(buf, sampleRate) {
  // Implements the ACF2+ algorithm
  let SIZE = buf.length;
  let rms = 0;
  let a;
  let b;

  for (var i = 0; i < SIZE; i++) {
    var val = buf[i];
    rms += val * val;
  }

  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.01) // not enough signal
    return -1;

  let r1 = 0,
    r2 = SIZE - 1,
    thres = 0.2;

  for (let i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }

  for (let i = 1; i < SIZE / 2; i++)
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

  buf = buf.slice(r1, r2);

  SIZE = buf.length;

  var c = new Array(SIZE).fill(0);
  for (var i = 0; i < SIZE; i++)
    for (var j = 0; j < SIZE - i; j++)
      c[i] = c[i] + buf[j] * buf[j + i];

  var d = 0;

  while (c[d] > c[d + 1]) d++;

  var maxval = -1,
    maxpos = -1;

  for (var i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  var T0 = maxpos;

  var x1 = c[T0 - 1],
    x2 = c[T0],
    x3 = c[T0 + 1];
  a = (x1 + x3 - 2 * x2) / 2;
  b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

async function updatePitch(time) {
  analyser.getFloatTimeDomainData(buf);

  var ac = autoCorrelate(buf, audioContext.sampleRate);

  const pitchInformation = {
    detection: null, // vague | confident | null
    frequency: 0,
    note: null,
    detune: {
      quality: null, // flat | sharp | null
      amount: 0,
    }
  };

  if (ac == -1) {
    ui.detector.className = "vague";
    ui.pitch.innerText = "--";
    ui.note.innerText = "-";
    ui.detune.className = "";
    ui.detune.innerText = "--";
  } else {
    let pitch = ac;

    ui.detector.className = "confident";
    ui.pitch.innerText = Math.round(pitch);


    var noteMidiNumber = await noteFromPitch(pitch);
console.log('noteMidiNumber', noteMidiNumber)
    const pitchObj = midiPitchMap.get(noteMidiNumber)

    demoPitchesGrouped[pitchObj.pitch] = (demoPitchesGrouped[pitchObj.pitch] ? [...demoPitchesGrouped[pitchObj.pitch], pitchObj] : [demoPitchesGrouped[pitchObj]]).filter(_ => _)

    ui.note.innerHTML = pitchObj.pitch;

    var detune = centsOffFromPitch(pitch, noteMidiNumber);

    // console  0.warn({ ac, pitch, noteMidiNumber, detune });

    if (detune == 0) {
      ui.detune.className = "";
      ui.detune.innerHTML = "--";
    }
    else {
      if (detune < 0)
        ui.detune.className = "flat";
      else
        ui.detune.className = "sharp";

      ui.detune.innerHTML = Math.abs(detune);
    }
  }

  rafID = window.requestAnimationFrame(updatePitch);
}




ui.demoToggle.addEventListener('click', e => {
  fetch('trans-reunion.mp3')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error, status = ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then((buffer) => audioContext.decodeAudioData(buffer)).then((decodedData) => {
      theBuffer = decodedData;
      togglePlayback()

      // setTimeout(() => {
      //   download('demoPitchesGrouped.json', JSON.stringify(demoPitchesGrouped, null, 2))
      //   console.log('DOWNLOAD', );
      // }, 10000)
    });


});

ui.detectToggle.addEventListener('click', e => {
  startPitchDetect()
});