// Small opt-in UI cues. No audio files, network requests, autoplay or persistent AudioContext until a click.
let context: AudioContext | null = null;
export type Cue = 'tap' | 'advance' | 'round' | 'finish';
export function playCue(cue: Cue) {
  if (typeof window === 'undefined') return;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return;
  try {
    context ||= new AudioContextCtor();
    if (context.state === 'suspended') void context.resume();
    const notes = cue === 'tap' ? [560] : cue === 'advance' ? [440, 660] : cue === 'round' ? [390, 540] : [523, 659, 784];
    const start = context.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      const at = start + index * 0.095;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.055, at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.17);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.18);
    });
  } catch { /* Unsupported device: captions and controls still work. */ }
}

export function stopNarration() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
export function narrate(text: string, onEnd: () => void): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false;
  stopNarration();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.95;
  utterance.volume = 0.85;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
}
