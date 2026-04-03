const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

export function startCountdown(targetDateString, onTick) {
  const targetDate = new Date(targetDateString);
  let timerId = 0;

  if (Number.isNaN(targetDate.getTime())) {
    throw new Error(`Invalid wedding date: ${targetDateString}`);
  }

  // The user only supplied a wedding date, so the countdown anchors to local midnight for that date.
  const update = () => {
    const diff = Math.max(targetDate.getTime() - Date.now(), 0);

    const nextValue = {
      days: Math.floor(diff / DAY),
      hours: Math.floor((diff % DAY) / HOUR),
      minutes: Math.floor((diff % HOUR) / MINUTE),
      seconds: Math.floor((diff % MINUTE) / SECOND),
      completed: diff === 0,
    };

    onTick(nextValue);

    if (nextValue.completed) {
      clearInterval(timerId);
    }
  };

  update();
  timerId = window.setInterval(update, SECOND);

  return () => window.clearInterval(timerId);
}
