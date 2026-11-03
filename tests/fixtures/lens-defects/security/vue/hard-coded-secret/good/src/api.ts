export async function loadReport(id: string) {
  // The session cookie authenticates the request; the secret stays on the server.
  const res = await fetch(`/api/reports/${id}`, { credentials: 'include' });
  return res.json();
}
