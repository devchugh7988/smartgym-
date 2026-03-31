
let video = document.getElementById("video");
let camera = null;
let lastSpoken = "";
let lastSpokenTime = 0;let lastState = "";
let stateStartTime = 0;


const SPEAK_DELAY = 3000; // 3 sec gap between voices

let squatStarted = false; // detect user intent
function updateState(newState, message) {
  let now = Date.now();

  // if state changed → reset timer
  if (newState !== lastState) {
    lastState = newState;
    stateStartTime = now;
    return;
  }

  // wait for stability (1.5 sec)
  if (now - stateStartTime < 1500) return;

  // control voice frequency
  if (now - lastSpokenTime > SPEAK_DELAY) {
    speak(message);
    lastSpokenTime = now;
  }
}


function speak(text) {
  let now = Date.now();

  // avoid repeating same message quickly
  if (text === lastSpoken && now - lastSpokenTime < 2000) return;

  let speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-US";
  speech.rate = 1;

  window.speechSynthesis.cancel(); // stop previous speech
  window.speechSynthesis.speak(speech);

  lastSpoken = text;
  lastSpokenTime = now;
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: "user"   // front camera
  }
})
    .then((stream) => {
      video.srcObject = stream;

      video.onloadedmetadata = () => {
        video.play();
        startPose();   // VERY IMPORTANT
      };
    })
    .catch((err) => {
      console.log("Camera error:", err);
    });
    console.log("Camera started");
}

function stopCamera() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
}
const pose = new Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true
});
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function startPose() {

  const cam = new Camera(video, {
    onFrame: async () => {
      await pose.send({ image: video });
    },
    width: 500,
    height: 500
  });

  cam.start();
}

pose.onResults((results) => {
  if (!results.poseLandmarks) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw points
  results.poseLandmarks.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "lime";
    ctx.fill();
  });

  checkPosture(results.poseLandmarks);
  console.log("Detecting...");
});
pose.onResults((results) => {
  if (!results.poseLandmarks) return;

  checkPosture(results.poseLandmarks);
});

function checkPosture(landmarks) {

  let hip = landmarks[23];
  let knee = landmarks[25];
  let ankle = landmarks[27];

  let status = document.getElementById("status");

  let angle = calculateAngle(hip, knee, ankle);

  console.log("Knee Angle:", angle);
  let shoulder = landmarks[11];  // left shoulder
      // left hip
  
  // distance between shoulder & hip (body height indicator)
  let bodyLength = Math.sqrt(
    Math.pow(shoulder.x - hip.x, 2) +
    Math.pow(shoulder.y - hip.y, 2)
  );
  let centerX = (landmarks[11].x + landmarks[12].x) / 2;

if (centerX < 0.3 || centerX > 0.7) {
  status.innerText = "➡️ Stand in center";
  return;
}
 if (
  hip.visibility < 0.5 ||
  knee.visibility < 0.5 ||
  ankle.visibility < 0.5
) {
  status.innerText = "⚠️ Full body not visible";
  status.style.color = "yellow";
  speak("Make sure your full body is visible");
  return;
}
if (bodyLength > 0.35) {
  status.innerText = "📛 Too Close!";
  updateState("close", "Move back");
  return;
}

if (bodyLength < 0.15) {
  status.innerText = "📛 Too Far!";
  updateState("far", "Come closer");
  return;
}


// detect if user started squat
if (angle < 150) {
  squatStarted = true;
}

// if user never started → don't guide
if (!squatStarted) {
  status.innerText = "🧍 Stand Ready";
  status.style.color = "white";
  return;
}

// now real feedback starts
  if (angle <70 ) {
  status.innerText = "injury risk  ";
  status.style.color = "red ";
  updateState("up", "move up");
} 
 else if (angle > 160) {
  status.innerText = "⬆️ Go Down";
  status.style.color = "orange";
  updateState("up", "Go down slowly");
} 
else if (angle > 90) {
  status.innerText = "⬇️ Almost There";
  status.style.color = "yellow";
  updateState("mid", "Go lower");
} 
else {
  status.innerText = "✅ Perfect Squat";
  status.style.color = "lime";
  updateState("down", "Perfect squat");
}

}
function calculateAngle(a, b, c) {
  let ab = { x: a.x - b.x, y: a.y - b.y };
  let cb = { x: c.x - b.x, y: c.y - b.y };

  let dot = (ab.x * cb.x + ab.y * cb.y);
  let magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  let magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);

  let angle = Math.acos(dot / (magAB * magCB));
  return angle * (180 / Math.PI); // convert to degrees
}
