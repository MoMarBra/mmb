/** User-supplied quizshow recordings. Original 18 MP3 files are preserved byte-for-byte.
 * Three explicit loop derivatives use an offline 80-ms crossfade. See assets/audio/wwm-credits.json.
 * No license grant is inferred. Gains are linear multipliers before the shared music bus.
 * Use loopAsset/loopGain and runtimeLoopStart/End for question beds; original IDs remain available. */
const tracks = {
  "theme": {
    "id": "wwm_theme",
    "duration": 34.220417,
    "gain": 0.4365,
    "sourceFilename": "01 Main Theme.mp3",
    "sha256": "efcfc247e4470a83619c91a37397d8006a1f9afe8fe02de789020b04dae6a4d7",
    "cameraMarkers": [
      {
        "time": 0,
        "shot": "portal"
      },
      {
        "time": 4.74,
        "shot": "studio-reveal"
      },
      {
        "time": 9.66,
        "shot": "crane"
      },
      {
        "time": 12.16,
        "shot": "audience"
      },
      {
        "time": 16.66,
        "shot": "host"
      },
      {
        "time": 20.66,
        "shot": "candidate"
      },
      {
        "time": 24.46,
        "shot": "duo"
      },
      {
        "time": 29.08,
        "shot": "question-push"
      },
      {
        "time": 30.2,
        "shot": "natural-tail"
      }
    ]
  },
  "opening": {
    "id": "wwm_opening",
    "duration": 83.565708,
    "gain": 0.2512,
    "sourceFilename": "02 Opening Titles & Walk Down.mp3",
    "sha256": "4dc3eb3c2252a7a8bcb7bf9bc4b912f261fc2fbc4012a0543fd16a32bd71fa48",
    "excerptStart": 0.18,
    "excerptEnd": 11.18,
    "fadeIn": 0.3,
    "fadeOut": 0.7
  },
  "correctReveal": {
    "id": "wwm_correct_reveal",
    "duration": 5.27675,
    "gain": 0.5433,
    "sourceFilename": "09 Who's Was Correct-.mp3",
    "sha256": "57c9722fd18f36dc65974f63aae99275f5a81b45eefab2c986668c9a9977f0f0"
  },
  "questionsEarly": {
    "id": "wwm_questions_early",
    "duration": 34.011417,
    "gain": 0.3199,
    "sourceFilename": "11 $100-$1,000 Questions.mp3",
    "sha256": "bc3aa671d12ab65b94c9745831a939818522b0bc29532b8b11b6d03561d7d4dd",
    "loopStart": 5.496,
    "loopEnd": 19.41,
    "loopCrossfade": 0.08,
    "loopAsset": "wwm_loop_early",
    "loopDuration": 13.83399093,
    "runtimeLoopStart": 0,
    "runtimeLoopEnd": 13.83399093,
    "loopGain": 0.3236,
    "loopSHA256": "831fe86f5fa12fc1785c544d2755b11b32df8928c014d2f37fc7d7bac24e4d9c"
  },
  "win1000": {
    "id": "wwm_win1000",
    "duration": 8.150208,
    "gain": 0.4416,
    "sourceFilename": "12 Win $1,000.mp3",
    "sha256": "2af6e98cb66183bd8ec6794fae4334289dcc9c018b46af469c3ff3e16f4f657e"
  },
  "play2000": {
    "id": "wwm_play2000",
    "duration": 11.154292,
    "gain": 0.4416,
    "sourceFilename": "13 Let's Play $2,000.mp3",
    "sha256": "71fd261583de0d0db2f983882b1dc710d2d7b5b75e58d848e0bd14c15cdcf3db"
  },
  "question2000": {
    "id": "wwm_question2000",
    "duration": 75.206542,
    "gain": 0.5129,
    "sourceFilename": "14 $2,000 Question.mp3",
    "sha256": "f392b953758158533034da406593b7cca608458e685c2120014060801f56bf7e",
    "loopStart": 4.112,
    "loopEnd": 60.114,
    "loopCrossfade": 0.08,
    "loopAsset": "wwm_loop_2000",
    "loopDuration": 55.921995465,
    "runtimeLoopStart": 0,
    "runtimeLoopEnd": 55.921995465,
    "loopGain": 0.5188,
    "loopSHA256": "475648c98f2ab8d8e8da0c7e2dcb5391128231656b4d27cc340d3b5805ce904c"
  },
  "final2000": {
    "id": "wwm_final2000",
    "duration": 18.129,
    "gain": 0.7852,
    "sourceFilename": "15 $2,000 Final Answer-.mp3",
    "sha256": "34311bbdabae16ccd9aeb1d49b12b8f9ca949163fc302e0a1edc5aa9131275d3"
  },
  "lose2000": {
    "id": "wwm_lose2000",
    "duration": 6.321625,
    "gain": 0.5495,
    "sourceFilename": "16 $2,000 Lose.mp3",
    "sha256": "24a2734f53fdfdda8afabb0d50cda643bee0de8457897bd9e96686f570a510af"
  },
  "win2000": {
    "id": "wwm_win2000",
    "duration": 6.191042,
    "gain": 0.4898,
    "sourceFilename": "17 $2,000 Win.mp3",
    "sha256": "ad94adb0e5b8926b5ab67089e46e012a74b6728b0339123b66505b4050bcd6c8"
  },
  "play4000": {
    "id": "wwm_play4000",
    "duration": 11.284917,
    "gain": 0.4677,
    "sourceFilename": "18 Let's Play $4,000.mp3",
    "sha256": "34b3386b7522e7fff5285730c38b38ce5977dc70816b5f69967f43e3a53fe8a9"
  },
  "play64000": {
    "id": "wwm_play64000",
    "duration": 11.180417,
    "gain": 0.4416,
    "sourceFilename": "38 Let's Play $64,000.mp3",
    "sha256": "108d0dabdc9c1cdba4649dab79e39a4349c3c48c2e0be2d6152fa1b51197ff33"
  },
  "playMillion": {
    "id": "wwm_play_million",
    "duration": 11.206542,
    "gain": 0.4467,
    "sourceFilename": "58 Let's Play $1,000,000.mp3",
    "sha256": "c8ab18de7c45cb983d84c2955d77d81c373cb27b7a99d94df378b09143a7f104"
  },
  "questionMillion": {
    "id": "wwm_question_million",
    "duration": 75.180417,
    "gain": 0.389,
    "sourceFilename": "59 $1,000,000 Question.mp3",
    "sha256": "e24ea75b86e79cf837479882392e965050cd20f93c5107f7181911979ef1dc61",
    "loopStart": 4,
    "loopEnd": 60.002,
    "loopCrossfade": 0.08,
    "loopAsset": "wwm_loop_million",
    "loopDuration": 55.921995465,
    "runtimeLoopStart": 0,
    "runtimeLoopEnd": 55.921995465,
    "loopGain": 0.3935,
    "loopSHA256": "63af4d3c27799454d0837ad60d09cb2256310d7dcdb108b7021323701e11a90a"
  },
  "finalMillion": {
    "id": "wwm_final_million",
    "duration": 17.266958,
    "gain": 0.6998,
    "sourceFilename": "60 $1,000,000 Final Answer-.mp3",
    "sha256": "bed2fad942fd3546efd4294b9d1218f66623fcdde97d4f32aa3fde6df881ca67"
  },
  "loseMillion": {
    "id": "wwm_lose_million",
    "duration": 10.39675,
    "gain": 0.335,
    "sourceFilename": "61 $1,000,000 Lose.mp3",
    "sha256": "4f6a117476fe7d5d74f025def387932a10ac6a9d0a62ceb36e8fc362fe75897d"
  },
  "winMillion": {
    "id": "wwm_win_million",
    "duration": 26.148583,
    "gain": 0.4121,
    "sourceFilename": "62 $1,000,000 Win.mp3",
    "sha256": "6b2394ff73a3b8ec83c57aa84c89506104463a00845933b1c3ae0b83c11b9336"
  },
  "closing": {
    "id": "wwm_closing",
    "duration": 34.481625,
    "gain": 0.257,
    "sourceFilename": "63 Closing Theme.mp3",
    "sha256": "0910b9033e40e9b1ea8f7fbf71b65060ee8e056551b79bd74d59d29582931b4a"
  }
};
for (const track of Object.values(tracks)) {
  if (track.cameraMarkers) { for (const marker of track.cameraMarkers) Object.freeze(marker); Object.freeze(track.cameraMarkers); }
  Object.freeze(track);
}
export const WWM_TRACKS = Object.freeze(tracks);
export const WWM_AUDIO_ASSETS = Object.freeze(Object.fromEntries(Object.values(WWM_TRACKS).flatMap(track => {
  const result = [[track.id, Object.freeze({ path: './assets/audio/' + track.id + '.mp3', group: 'music', duration: track.duration })]];
  if (track.loopAsset) result.push([track.loopAsset, Object.freeze({ path: './assets/audio/' + track.loopAsset + '.mp3', group: 'music', duration: track.loopDuration })]);
  return result;
})));
