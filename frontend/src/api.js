// Calls to the FastAPI backend. 
export const API_URL = import.meta.env?.VITE_API_URL ?? 'http://127.0.0.1:8001';

// fetch() does not reject on HTTP 4xx/5xx: check response.ok ourselves.
export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: {'Content-Type': 'application/json'},
      ...options,
    });
  } catch {
    throw new Error('Serveur injoignable. Le backend est-il lancé ?');
  }
  if (!response.ok) throw new Error(`Le serveur a refusé la demande (${response.status}).`);
  return response.status === 204 ? null : response.json();
}

export const fetchScores = () => request('/scores/');
export const saveScore = score => request('/scores/', {method: 'POST', body: JSON.stringify(score)});
