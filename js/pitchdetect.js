import { ui } from './ui.js';
window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var mediaStreamSource = null;
var
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

  fetch('recorder1.wav')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error, status = ${response.status}`);
      }
      return response.arrayBuffer();
    }).then((buffer) => audioContext.decodeAudioData(buffer)).then((decodedData) => {
      theBuffer = decodedData;
    });

}

export function startPitchDetect() {
  // grab an audio context
  audioContext = new AudioContext();

  // Attempt to get audio input
  navigator.mediaDevices.getUserMedia(
  {
    "audio": {
      "mandatory": {
        "googEchoCancellation": "false",
        "googAutoGainControl": "false",
        "googNoiseSuppression": "false",
        "googHighpassFilter": "false"
      },
      "optional": []
    },
  }).then((stream) => {
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect(analyser);
    updatePitch();

    ui.detectToggle.classList.add('active')

  }).catch((err) => {
    console.error(`${err.name}: ${err.message}`);
    alert('Stream generation failed.');
  });
}


function toggleLiveInput() {
  if (isPlaying) {
    //stop playing and return
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
  }

  getUserMedia(
  {
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
    //stop playing and return
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

  const gain1 = audioContext.createGain();
  gain1.gain.value = 0.3

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  analyser.connect(gain1);
  gain1.connect(audioContext.destination);
  sourceNode.start(0);
  isPlaying = true;
  let isLiveInput = false;

  updatePitch();

  ui.demoToggle.classList.add('active');

  return "stop";
}

var rafID = null;
var tracks = null;
var buflen = 2048;
var buf = new Float32Array(buflen);

var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromPitch(frequency) {
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency, note) {
  return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
}

function autoCorrelate(buf, sampleRate) {
  // Implements the ACF2+ algorithm
  var SIZE = buf.length;
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

  var r1 = 0,
    r2 = SIZE - 1,
    thres = 0.2;

  for (var i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }

  for (var i = 1; i < SIZE / 2; i++)
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

function updatePitch(time) {
  analyser.getFloatTimeDomainData(buf);

  var ac = autoCorrelate(buf, audioContext.sampleRate);

  if (ac == -1) {
    detectorElem.className = "vague";
    pitchElem.innerText = "--";
    noteElem.innerText = "-";
    detuneElem.className = "";
    detuneAmount.innerText = "--";
  } else {
    let pitch = ac;
    
    detectorElem.className = "confident";
    pitchElem.innerText = Math.round(pitch);

    var note = noteFromPitch(pitch);

    noteElem.innerHTML = noteStrings[note % 12];

    var detune = centsOffFromPitch(pitch, note);

    if (detune == 0) {
      detuneElem.className = "";
      detuneAmount.innerHTML = "--";
    } else {
      if (detune < 0)
        detuneElem.className = "flat";
      else
        detuneElem.className = "sharp";

      detuneAmount.innerHTML = Math.abs(detune);
    }
  }

  rafID = window.requestAnimationFrame(updatePitch);
}


ui.demoToggle.addEventListener('click', e => {
  togglePlayback()
});

ui.detectToggle.addEventListener('click', e => {
  startPitchDetect()
});