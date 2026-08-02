/**
 * Agent name normalization and alias resolution.
 */
export function normalizeAgentName(rawName?: string, rawId?: string): string {
  let name = (rawName || '').trim();
  if (!name && rawId) {
    name = rawId.trim();
  }
  if (!name) return 'Agente de Trânsito';

  const lower = name.toLowerCase();

  // Alias mapping: "Leandro Souza" and "Leandro Santos Souza" are the same person
  if (lower === 'leandro souza' || lower === 'leandro santos souza') {
    return 'Leandro Santos Souza';
  }

  return name;
}
