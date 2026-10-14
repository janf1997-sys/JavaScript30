let countdown; // Global variable to store active interval reference
const timerDisplay = document.querySelector('.display__time-left');
const endTime = document.querySelector('.display__end-time');
const buttons = document.querySelectorAll('[data-time]');

function timer(seconds) {
  // Clear any existing timer to prevent multiple intervals running simultaneously
  clearInterval(countdown);
  const now = Date.now();
  // Calculate exact target timestamp in the future
  const then = now + seconds * 1000;
  displayTimeLeft(seconds);
  displayEndTime(then);

  countdown = setInterval(() => {
    // Calculate remaining seconds using absolute timestamps
    const secondsLeft = Math.round((then - Date.now()) / 1000);
    // Stop timer when it hits zero
    if (secondsLeft < 0) {
      clearInterval(countdown);
      return;
    }
    displayTimeLeft(secondsLeft);
  }, 1000);
}

function displayTimeLeft(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  // Format with leading zero if seconds are less than 10 (e.g. 5 -> '05')
  const display = `${minutes}:${remainderSeconds < 10 ? '0' : ''}${remainderSeconds}`;
  timerDisplay.textContent = display;
  // Dynamically update browser tab title with current countdown
  document.title = display;
}

function displayEndTime(timestamp) {
  const end = new Date(timestamp);
  const hour = end.getHours();
  const minutes = end.getMinutes();
  // Format minutes with leading zero if needed
  endTime.textContent = `Be Back At ${hour}:${minutes < 10 ? '0' : ''}${minutes}`;
}
function startTimer() {
  const seconds = parseInt(this.dataset.time);
  timer(seconds);
}

buttons.forEach(button => button.addEventListener('click', startTimer));
document.customForm.addEventListener('submit', function (e) {
  // Prevent full page reload on form submission
  e.preventDefault();
  const mins = this.minutes.value;
  // Convert input minutes to seconds and trigger timer
  timer(mins * 60);
  // Clear input field value after submit
  this.reset();
});
