// Simple sound utility using Web Audio API
export function playBeep(frequency = 800, duration = 200) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + duration / 1000)
  } catch (e) {
    console.error('Audio not supported:', e)
  }
}

export function playCountdownBeep() {
  playBeep(1000, 150) // High pitch for countdown seconds
}

export function playSetReadyBeep() {
  playBeep(400, 300) // Lower pitch when set is ready
}

export function playSessionStart() {
  // Three beeps to signal session start
  playBeep(800, 200)
  setTimeout(() => playBeep(800, 200), 250)
  setTimeout(() => playBeep(800, 200), 500)
}
