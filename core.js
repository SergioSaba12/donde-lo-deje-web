// La lógica es independiente de la interfaz y del almacén para poder cambiar
// IndexedDB por una API sin reescribir las acciones de la app.
const PLACE = String.raw`(?:en|sobre|encima\s+de|debajo\s+de|dentro\s+de|al\s+lado\s+de|junto\s+a|detr[aá]s\s+de|frente\s+a|cerca\s+de|entre|tras|bajo)`;

const REMEMBER_PATTERNS = [
  new RegExp(String.raw`^(?:he\s+)?(?:dejado|guardado|puesto|colocado|metido)\s+(.+?)\s+(${PLACE}\s+.+)$`, "i"),
  new RegExp(String.raw`^(?:dej[eé]|guard[eé]|puse|coloqu[eé]|met[ií])\s+(.+?)\s+(${PLACE}\s+.+)$`, "i"),
  new RegExp(String.raw`^tengo\s+(.+?)\s+(${PLACE}\s+.+)$`, "i"),
  new RegExp(String.raw`^(.+?)\s+(?:est[aá]|est[aá]n|se\s+encuentra|se\s+encuentran)\s+(${PLACE}\s+.+)$`, "i"),
  new RegExp(String.raw`^(.+?)\s+(?:lo|la|los|las)\s+(?:he\s+)?(?:dejado|guardado|puesto)\s+(${PLACE}\s+.+)$`, "i")
];

const FIND_PATTERNS = [
  /^d[oó]nde\s+(?:he\s+)?(?:dejado|guardado|puesto|colocado|metido|dej[eé]|guard[eé]|puse|coloqu[eé]|met[ií])\s+(.+)$/i,
  /^d[oó]nde\s+(?:est[aá]|est[aá]n|tengo|qued[oó]|quedaron|se\s+encuentra|se\s+encuentran)\s+(.+)$/i,
  /^en\s+qu[eé]\s+lugar\s+(?:est[aá]|est[aá]n|dej[eé]|he\s+dejado)\s+(.+)$/i,
  /^(?:busca|encuentra|localiza)\s+(.+)$/i
];

export function clean(value) {
  return String(value ?? "").trim().replace(/^[¿?¡!.,;:\s]+|[¿?¡!.,;:\s]+$/g, "").replace(/\s+/g, " ");
}

export function objectKey(object) {
  return clean(object).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
    .replace(/^(?:el|la|los|las|mi|mis|un|una|unos|unas|este|esta|estos|estas|su|sus)\s+/, "");
}

export function locationDescription(location) {
  const value = clean(location);
  const folded = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  return /^(?:en|sobre|encima de|debajo de|dentro de|al lado de|junto a|detras de|frente a|cerca de|entre|tras|bajo)\s/.test(folded)
    ? value : `en ${value}`;
}

export function parseCommand(input) {
  const value = clean(input).replace(/^(?:oye(?:\s+asistente)?[, ]+|(?:recuerda|apunta|anota|guarda)\s+que\s+)/i, "");
  if (!value) return { type: "unknown" };
  for (const pattern of REMEMBER_PATTERNS) {
    const match = value.match(pattern);
    if (match) {
      const object = clean(match[1]);
      const location = clean(match[2]);
      if (object && location) return { type: "remember", object, location };
    }
  }
  for (const pattern of FIND_PATTERNS) {
    const match = value.match(pattern);
    if (match && clean(match[1])) return { type: "find", object: clean(match[1]) };
  }
  return { type: "unknown" };
}

export function latestFor(records, object) {
  const key = objectKey(object);
  return records.findLast(record => objectKey(record.object) === key) ?? null;
}

export function latestPlacements(records) {
  const seen = new Set();
  return [...records].reverse().filter(record => {
    const key = objectKey(record.object);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateBackup(data) {
  if (!data || data.app !== "DondeLoDejeWeb" || data.version !== 1 || !Array.isArray(data.placements)) {
    throw new Error("Este archivo no es una copia válida de Dónde lo dejé.");
  }
  if (data.placements.length > 10000) throw new Error("La copia contiene demasiados registros.");
  const ids = new Set();
  return data.placements.map(record => {
    if (!record || typeof record.id !== "string" || record.id.length > 100 ||
        typeof record.object !== "string" || typeof record.location !== "string" ||
        typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt)) ||
        !clean(record.object) || !clean(record.location) || record.object.length > 500 || record.location.length > 1000) {
      throw new Error("La copia contiene un registro no válido.");
    }
    if (ids.has(record.id)) throw new Error("La copia contiene identificadores repetidos.");
    ids.add(record.id);
    return { id: record.id, object: clean(record.object), location: clean(record.location), createdAt: record.createdAt };
  });
}
