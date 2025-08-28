// src/utils/http.util.js
export function badRequest(res, errorsOrMessage) {
  const payload = Array.isArray(errorsOrMessage)
    ? { errors: errorsOrMessage }
    : { error: String(errorsOrMessage) };
  return res.status(400).json(payload);
}

export function notFound(res, msg = "Not found") {
  return res.status(404).json({ error: msg });
}

export function conflict(res, msg = "Conflict") {
  return res.status(409).json({ error: msg });
}
