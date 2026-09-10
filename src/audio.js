let context;
export function playSound(kind, enabled) {
  if (!enabled) return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume().catch(() => {});
    const notes = {
      plant: [392, 523],
      harvest: [523, 659, 784],
      water: [440, 587],
      sell: [659, 784, 1047],
      produce: [330, 440],
      pulse: [523, 784, 1047, 1319],
      level: [523, 659, 784, 1047, 1319],
    }[kind] || [440];
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        time = context.currentTime + i * 0.075;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.065, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + 0.25);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    /* Audio is optional; a blocked audio context never blocks gameplay. */
  }
}
