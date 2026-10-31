// Captures structured console output so tests can assert the cron/reminder
// log lifecycle (event names + payload fields) without flooding test output.
// node --test isolates each test file in its own process, so mutating the
// console inside one file cannot leak into others.
export function captureConsole() {
  const events = [];
  const originalLog = console.log;
  const originalError = console.error;

  const record = (level) => (...args) => {
    if (typeof args[0] === "string") {
      events.push({ level, name: args[0], data: args[1] });
    } else if (originalLog === console.log) {
      // Non-structured logs are forwarded untouched.
      originalLog(...args);
    }
  };

  console.log = record("log");
  console.error = record("error");

  return {
    events,
    names: () => events.map((event) => event.name),
    first: (name) => events.find((event) => event.name === name),
    all: (name) => events.filter((event) => event.name === name),
    indexOf: (name) => events.findIndex((event) => event.name === name),
    restore() {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}
