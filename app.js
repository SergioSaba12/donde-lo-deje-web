import { clean, latestFor, latestPlacements, locationDescription, parseCommand, validateBackup } from "./core.js";
import { IndexedDBPlacementRepository } from "./repository.js";

const repository = new IndexedDBPlacementRepository();
const $ = selector => document.querySelector(selector);
const state = { records: [], answer: "", recording: null, transcript: "", voiceGeneration: 0, toastTimer: null, ready: false };

const pinSVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.1" fill="currentColor"/></svg>';

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { element.hidden = true; }, 4500);
}

function setAnswer(message, speak = true) {
  state.answer = message;
  $("#answer-text").textContent = message;
  $("#answer-section").hidden = false;
  if (speak) speakAnswer(message);
}

function speakAnswer(message) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "es-ES";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function render() {
  const latest = latestPlacements(state.records);
  $("#count-label").textContent = `${latest.length} ${latest.length === 1 ? "objeto" : "objetos"}`;
  $("#empty-state").hidden = latest.length > 0;
  const list = $("#placements");
  list.replaceChildren();
  for (const record of latest) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "placement-item";
    row.setAttribute("aria-label", `${record.object}, ${locationDescription(record.location)}. Toca para escucharlo.`);
    const icon = document.createElement("span");
    icon.className = "placement-icon";
    icon.innerHTML = pinSVG;
    const detail = document.createElement("span");
    detail.className = "placement-detail";
    const name = document.createElement("strong");
    name.textContent = record.object.charAt(0).toLocaleUpperCase("es") + record.object.slice(1);
    const location = document.createElement("span");
    location.textContent = locationDescription(record.location);
    detail.append(name, location);
    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "›";
    row.append(icon, detail, chevron);
    row.addEventListener("click", () => setAnswer(`Último lugar registrado para ${record.object}: ${locationDescription(record.location)}.`));
    list.append(row);
  }
}

async function remember(object, location) {
  const record = { id: crypto.randomUUID(), object: clean(object), location: clean(location), createdAt: new Date().toISOString() };
  await repository.add(record);
  state.records = await repository.all();
  render();
  setAnswer(`He guardado ${record.object}: ${locationDescription(record.location)}.`);
}

function find(object) {
  const record = latestFor(state.records, object);
  setAnswer(record
    ? `Último lugar registrado para ${clean(object)}: ${locationDescription(record.location)}.`
    : `Todavía no tengo ningún lugar guardado para ${clean(object)}.`);
}

async function handlePhrase(phrase) {
  const command = parseCommand(phrase);
  if (command.type === "remember") {
    await remember(command.object, command.location);
  } else if (command.type === "find") {
    find(command.object);
  } else {
    setAnswer("Prueba con «Guardé el pasaporte en la maleta» o «¿Dónde está mi pasaporte?». También puedes usar el formulario para cualquier objeto.");
  }
}

function showForm() {
  if (!state.ready) { toast("El almacenamiento no está disponible. Recarga la página e inténtalo de nuevo."); return; }
  $("#form-error").hidden = true;
  $("#entry-form").reset();
  updateFormMode();
  $("#form-dialog").showModal();
  setTimeout(() => $("#object-input").focus(), 200);
}

function updateFormMode() {
  const isRemember = $("input[name=mode]:checked").value === "remember";
  $("#location-field").hidden = !isRemember;
  $("#form-title").textContent = isRemember ? "Guardar objeto" : "Buscar objeto";
  $("#submit-entry").textContent = isRemember ? "Guardar" : "Buscar";
}

async function submitForm(event) {
  event.preventDefault();
  const object = clean($("#object-input").value);
  const location = clean($("#location-input").value);
  const isRemember = $("input[name=mode]:checked").value === "remember";
  const error = $("#form-error");
  if (!object || (isRemember && !location)) {
    error.textContent = isRemember ? "Escribe el objeto y el lugar." : "Escribe el objeto que buscas.";
    error.hidden = false;
    return;
  }
  try {
    $("#submit-entry").disabled = true;
    if (isRemember) await remember(object, location);
    else find(object);
    $("#form-dialog").close();
  } catch {
    error.textContent = "No se pudo guardar. Comprueba el espacio del dispositivo e inténtalo de nuevo.";
    error.hidden = false;
  } finally {
    $("#submit-entry").disabled = false;
  }
}

function setVoiceUI(status, message = "") {
  const listening = status === "listening";
  $("#voice-orb").classList.toggle("listening", listening);
  $("#voice-title").textContent = status === "listening" ? "Te escucho" : status === "error" ? "No he podido escucharte" : "Preparando micrófono";
  $("#transcript").textContent = message || "Di dónde has dejado algo o pregunta por un objeto.";
  $("#finish-voice").hidden = !listening;
  $("#retry-voice").hidden = status !== "error";
}

function voiceError(message) {
  setVoiceUI("error", state.transcript);
  $("#voice-error").textContent = message;
  $("#voice-error").hidden = false;
}

function stopVoice(cancel = false) {
  const recognition = state.recording;
  if (!recognition) {
    if (cancel && $("#voice-dialog").open) $("#voice-dialog").close();
    return;
  }
  state.recording = null;
  if (cancel) {
    state.voiceGeneration++;
    recognition.abort();
    if ($("#voice-dialog").open) $("#voice-dialog").close();
  } else {
    setVoiceUI("processing", state.transcript);
    recognition.stop();
  }
}

function startVoice() {
  if (!state.ready) { toast("El almacenamiento no está disponible."); return; }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast("Este navegador no admite dictado. Usa Safari o escribe el objeto.");
    showForm();
    return;
  }
  if (!("SpeechRecognition" in window) && !("webkitSpeechRecognition" in window)) return;
  if (state.recording) stopVoice(true);
  const dialog = $("#voice-dialog");
  if (!dialog.open) dialog.showModal();
  state.transcript = "";
  $("#voice-error").hidden = true;
  setVoiceUI("preparing");
  const generation = ++state.voiceGeneration;
  const recognition = new Recognition();
  recognition.lang = "es-ES";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  state.recording = recognition;
  let failed = false;
  recognition.onstart = () => { if (generation === state.voiceGeneration) setVoiceUI("listening"); };
  recognition.onresult = event => {
    if (generation !== state.voiceGeneration) return;
    const parts = [];
    for (let index = 0; index < event.results.length; index++) parts.push(event.results[index][0].transcript);
    state.transcript = clean(parts.join(" "));
    $("#transcript").textContent = state.transcript || "Di dónde has dejado algo o pregunta por un objeto.";
  };
  recognition.onerror = event => {
    if (generation !== state.voiceGeneration) return;
    failed = true;
    state.recording = null;
    const message = event.error === "not-allowed" || event.error === "service-not-allowed"
      ? "Permite el micrófono y activa Siri en Ajustes para usar el dictado."
      : event.error === "no-speech"
        ? "No he entendido nada. Prueba otra vez o usa el teclado."
        : "El dictado no está disponible ahora. Prueba otra vez o usa el teclado.";
    voiceError(message);
  };
  recognition.onend = async () => {
    if (generation !== state.voiceGeneration || failed) return;
    state.recording = null;
    const phrase = state.transcript;
    if (!phrase) { voiceError("No he entendido nada. Prueba otra vez o usa el teclado."); return; }
    if (dialog.open) dialog.close();
    try { await handlePhrase(phrase); }
    catch { toast("No se pudo guardar. Comprueba el espacio del dispositivo e inténtalo de nuevo."); }
  };
  try { recognition.start(); }
  catch { state.recording = null; voiceError("No se pudo iniciar el micrófono. Prueba otra vez o usa el teclado."); }
}

async function exportData() {
  if (!state.ready) { toast("No se pueden leer los datos ahora."); return; }
  try {
    state.records = await repository.all();
    const backup = { app: "DondeLoDejeWeb", version: 1, exportedAt: new Date().toISOString(), placements: state.records };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dory-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast("Copia descargada. Guárdala en Archivos o compártela.");
  } catch { toast("No se pudo crear la copia."); }
}

async function importData(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 2_000_000) { toast("La copia es demasiado grande."); return; }
  try {
    const records = validateBackup(JSON.parse(await file.text()));
    const count = await repository.merge(records);
    state.records = await repository.all();
    render();
    toast(count ? `${count} ${count === 1 ? "registro importado" : "registros importados"}.` : "Esta copia ya está importada.");
  } catch (error) { toast(error.message || "No se pudo importar la copia."); }
}

async function initialize() {
  try {
    state.records = await repository.all();
    state.ready = true;
    render();
  } catch {
    $("#empty-state").querySelector("h3").textContent = "No se pudo abrir el almacenamiento";
    $("#empty-state").querySelector("p").textContent = "Comprueba que Safari permite guardar datos e inténtalo de nuevo.";
  }
  $("#open-form").addEventListener("click", showForm);
  $("#bottom-form").addEventListener("click", showForm);
  $("#start-voice").addEventListener("click", startVoice);
  $("#bottom-voice").addEventListener("click", startVoice);
  $("#entry-form").addEventListener("submit", submitForm);
  $("#form-dialog").querySelector(".cancel-dialog").addEventListener("click", () => $("#form-dialog").close());
  document.querySelectorAll("input[name=mode]").forEach(input => input.addEventListener("change", updateFormMode));
  $("#repeat-answer").addEventListener("click", () => speakAnswer(state.answer));
  $("#cancel-voice").addEventListener("click", () => stopVoice(true));
  $("#finish-voice").addEventListener("click", () => stopVoice());
  $("#retry-voice").addEventListener("click", startVoice);
  $("#voice-dialog").addEventListener("cancel", event => { event.preventDefault(); stopVoice(true); });
  $("#export-data").addEventListener("click", exportData);
  $("#import-data").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", importData);
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

initialize();
