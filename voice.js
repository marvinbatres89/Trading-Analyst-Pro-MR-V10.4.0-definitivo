import { VOICE } from "./config.js";

const DIRECTION_TEXT = Object.freeze({
  RISE: "subida", FALL: "bajada", EVEN: "par",
  ODD: "impar", OVER: "mayor", UNDER: "menor"
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
      this.voices.find((v) => v.lang.toLowerCase() === "es-sv") ||
      this.voices.find((v) => v.lang.toLowerCase().startsWith("es")) ||
      this.voices[0] || null;
  }
  speak(text, { replace = true, rate = this.rate } = {}) {
    return new Promise((resolve) => {
      if (!this.enabled || !text || !("speechSynthesis" in window)) {
        resolve(); return;
      }
      if (replace) speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.voice?.lang || VOICE.language;
      utterance.voice = this.voice;
      utterance.rate = rate;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      speechSynthesis.speak(utterance);
    });
  }
  pause(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  describeDirection(result) {
    return result.direction === "MATCH"
      ? `coincidencia ${result.metadata?.digit}`
      : DIRECTION_TEXT[result.direction] || result.direction;
  }
  async announcePrediction(result, explanation) {
    await this.speak("Predicción confirmada.");
    await this.pause(850);
    await this.speak(this.describeDirection(result));
    await this.pause(600);
    if (explanation) await this.speak(explanation);
    await this.pause(650);
    await this.speak("Prepare la operación.");
    await this.pause(900);
  }
  async announceExecutionWindow(recommendedSecond = null) {
    if (recommendedSecond) {
      await this.speak(
        `Momento observado con mejor rendimiento: segundo ${recommendedSecond}.`
      );
      await this.pause(450);
    }
    await this.speak("Tiene diez segundos para ejecutar la operación.");
    await this.pause(650);
  }
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && "speechSynthesis" in window) speechSynthesis.cancel();
    return this.enabled;
  }
}
export const voiceAssistant = new VoiceAssistant();
