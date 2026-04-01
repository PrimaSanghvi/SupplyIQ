import { API_BASE } from './config';
import type { NetworkData } from '../types/network';
import type { ScenarioSummary } from '../types/optimization';

export async function fetchNetwork(): Promise<NetworkData> {
  const res = await fetch(`${API_BASE}/api/network`);
  return res.json();
}

export async function fetchScenarios(): Promise<ScenarioSummary[]> {
  const res = await fetch(`${API_BASE}/api/scenarios`);
  return res.json();
}

export async function fetchScenario(id: string) {
  const res = await fetch(`${API_BASE}/api/scenarios/${id}`);
  return res.json();
}
