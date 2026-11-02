// A made-up value for this fixture, not a real credential.
const apiSecret = "hardcoded-secret-value-1234567890";

export async function loadReport(id: string) {
  const res = await fetch(`/api/reports/${id}`, { headers: { Authorization: `Bearer ${apiSecret}` } });
  return res.json();
}
