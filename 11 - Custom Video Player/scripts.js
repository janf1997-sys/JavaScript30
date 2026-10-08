const player = document.querySelector('.player');
const video = player.querySelector('.viewer');
const progress = player.querySelector('.progress');
const progressBar = player.querySelector('.progress__filled');
const toggle = player.querySelector('.toggle');
const skipButtons = player.querySelectorAll('[data-skip]');
const ranges = player.querySelectorAll('.player__slider');
const fullscreenButton = player.querySelector('.fullscreen');

// video.paused is the sourfe of truth (video has no 'playing' property)
function togglePlay() {
  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
}
// Decoupled icon update: listens directly to video events
function updateButton() {
  const icon = this.paused ? '►' : '❚ ❚';
  toggle.textContent = icon;
}
// Convert dataset string to number to prevent string concatenation
function skip() {
  video.currentTime += parseFloat(this.dataset.skip);
}
// Handles both volume and playbackRate via dynamic property lookup
function handleRangeUpdate() {
  video[this.name] = this.value;
}
// Calculates percentag completed and updates flex-basis
function handleProgress() {
  const percent = (video.currentTime / video.duration) * 100;
  progressBar.style.flexBasis = `${percent}%`;
}
// Calculate click position relative to total bar width: (offsetX / offsetWidth)
function scrub(e) {
  const scrubPercent = (e.offsetX / progress.offsetWidth) * 100;
  progressBar.style.flexBasis = `${scrubPercent}`; //Visual update while dragging
  const scrubTime = (e.offsetX / progress.offsetWidth) * video.duration;
  video.currentTime = scrubTime;
}
// Request fullscreen on parent container so controls remain visible
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    player.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}
// Hook up event listeners
video.addEventListener('click', togglePlay);
video.addEventListener('play', updateButton);
video.addEventListener('pause', updateButton);
video.addEventListener('timeupdate', handleProgress);
toggle.addEventListener('click', togglePlay);
skipButtons.forEach(button => button.addEventListener('click', skip));
ranges.forEach(range => range.addEventListener('change', handleRangeUpdate));
ranges.forEach(range => range.addEventListener('mousemove', handleRangeUpdate));
let mousedown = false;
progress.addEventListener('click', scrub);
progress.addEventListener('mousemove', e => mousedown && scrub(e));
progress.addEventListener('mousedown', () => (mousedown = true));
window.addEventListener('mouseup', () => (mousedown = false));
fullscreenButton.addEventListener('click', toggleFullscreen);
