import { VOICE } from "./config.js";

const DIRECTION_TEXT = Object.freeze({
  RISE: "subida",
  FALL: "bajada",
  EVEN: "par",
  ODD: "impar",
  OVER: "mayor",
  UNDER: "menor"
});

class VoiceAssistant {
  constructor() {
    this.enabled = true;
    this.rate = VOICE.rate;
    this.voices = [];
    this.voice = null;
  }

  async init() {
    if (!("speechSynthesis" in window)) {
      this.enabled = false;
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    this.loadVoices();
    speechSynthesis.addEventListener?.("voiceschanged", () => this.loadVoices());
  }

  loadVoices() {
    this.voices = speechSynthesis.getVoices();
    this.voice =
      this.voices.find((voice) => voice.lang.toLowerCase() === "es-sv") ||
      this.voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) ||
      this.voices[0] ||
      null;
  }

  speak(text, replace = true) {
    if (!this.enabled || !text) return;
    if (replace) speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.voice?.lang || VOICE.language;
    utterance.voice = this.voice;
    utterance.rate = this.rate;
    speechSynthesis.speak(utterance);
  }

  describeDirection(result) {
    if (result.direction === "MATCH") {
      return `coincidencia ${result.metadata?.digit}`;
    }
    return DIRECTION_TEXT[result.direction] || result.direction;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) speechSynthesis.cancel();
    return this.enabled;
  }
}

export const voiceAssistant = new VoiceAssistant();
