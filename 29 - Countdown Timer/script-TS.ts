let countdown: number | undefined;
const timerDisplay = document.querySelector<HTMLHeadingElement>(
  '.display__time-left',
)!;
const endTime =
  document.querySelector<HTMLParagraphElement>('.display__end-time')!;
const buttons = document.querySelectorAll<HTMLButtonElement>('[data-time]');

function timer(seconds: number): void {
  clearInterval(countdown);
  const now = Date.now();
  const then = now + seconds * 1000;
  displayTimeLeft(seconds);
  displayEndTime(then);

  countdown = setInterval(() => {
    const secondsLeft = Math.round((then - Date.now()) / 1000);
    if (secondsLeft < 0) {
      clearInterval(countdown);
      return;
    }
    displayTimeLeft(secondsLeft);
  }, 1000);
}

function displayTimeLeft(seconds: number): void {
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  const display = `${minutes}:${remainderSeconds < 10 ? '0' : ''}${remainderSeconds}`;
  timerDisplay.textContent = display;
  document.title = display;
}

function displayEndTime(timestamp: number): void {
  const end = new Date(timestamp);
  const hour = end.getHours();
  const minutes = end.getMinutes();
  endTime.textContent = `Be Back At ${hour}:${minutes < 10 ? '0' : ''}${minutes}`;
}

function startTimer(this: HTMLButtonElement): void {
  const seconds = parseInt(this.dataset.time!, 10);
  timer(seconds);
}

buttons.forEach(button => button.addEventListener('click', startTimer));
const form = document.querySelector<HTMLFormElement>('#custom')!;
form.addEventListener('submit', function (e: SubmitEvent) {
  e.preventDefault();
  const input = this.querySelector<HTMLInputElement>('input[name="minutes"]')!;
  const mins = parseInt(input.value, 10);
  if (!isNaN(mins)) {
    timer(mins * 60);
  }
  this.reset();
});
