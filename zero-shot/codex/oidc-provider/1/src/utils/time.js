export function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function isoDateAfterSeconds(seconds) {
  return new Date(Date.now() + (seconds * 1000)).toISOString();
}
