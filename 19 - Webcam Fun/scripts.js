const video = document.querySelector('.player');
const canvas = document.querySelector('.photo');
const ctx = canvas.getContext('2d');
const strip = document.querySelector('.strip');
const snap = document.querySelector('.snap');
// Provide video feed source (mocked via local video for testing without webcam)
// Add video in project folder named 'test.mp4'
function getVideo() {
  video.src = 'test.mp4';
  video.loop = true;
  video.muted = true;
  video.play();
}

function paintToCanvas() {
  // Sync canvas render dimensions to actual video resolution to avoid distortion
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;

  return setInterval(() => {
    // Draw raw video frame onto the 2D canvas context
    ctx.drawImage(video, 0, 0, width, height);
    // Extract raw RGBA pixel data
    let pixels = ctx.getImageData(0, 0, width, height);
    // Apply custom pixel transformation filters
    // pixels = redEffect(pixels);
    // pixels = rgbSplit(pixels);
    // ctx.globalAlpha = 0.1;
    pxiels = greenScreen(pixels);
    // Paint modified pixel array back to canvas
    ctx.putImageData(pixels, 0, 0);
  }, 16);
}

function takePhoto() {
  // Reset and play shutter click sound
  snap.currentTime = 0;
  snap.play();
  // Export current canvas frame as base64 image data URL
  const data = canvas.toDataURL('image/jpeg');
  // Build downloadable thumbnail element and prepend to gallery strip
  const link = document.createElement('a');
  link.href = data;
  link.setAttribute('download', 'pic');
  link.innerHTML = `<img src="${data}" alt="Screenshot" />`;
  strip.insertBefore(link, strip.firstChild);
}

// Filter: Boost red channel while reducing green and blue
function redEffect(pixels) {
  // Each pixel occupies 4 sequential slots: [R, G, B, A]
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i + 0] = pixels.data[i + 0] + 100; // Red
    pixels.data[i + 1] = pixels.data[i + 1] - 50; // Green
    pixels.data[i + 2] = pixels.data[i + 2] * 0.5; // Blue
  }
  return pixels;
}

// Filter: Shift individual color channels by index offsets
function rgbSplit(pixels) {
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i - 150] = pixels.data[i + 0];
    pixels.data[i + 100] = pixels.data[i + 1];
    pixels.data[i - 250] = pixels.data[i + 2];
  }
  return pixels;
}

// Filter: Key out pixels within user-defined RGB threshold ranges
function greenScreen(pixels) {
  const levels = {};
  // Read active slider values from input controls
  document.querySelectorAll('.rgb input').forEach(input => {
    levels[input.name] = input.value;
  });

  for (i = 0; i < pixels.data.length; i = i + 4) {
    red = pixels.data[i + 0];
    green = pixels.data[i + 1];
    blue = pixels.data[i + 2];
    alpha = pixels.data[i + 3];

    // If pixel value fall within configured color thresholds, set alpha to 0 (transparent)
    if (
      red >= levels.rmin &&
      green >= levels.gmin &&
      blue >= levels.bmin &&
      red <= levels.rmax &&
      green <= levels.gmax &&
      blue <= levels.bmax
    ) {
      // take it out!
      pixels.data[i + 3] = 0;
    }
  }

  return pixels;
}

getVideo();

video.addEventListener('canplay', paintToCanvas);
