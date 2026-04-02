export interface BrandConfig {
  name: string;
  subtitle: string;
  color: string;
  logo: 'zap' | 'image';
  logoSrc?: string;
}

const BRAND_MAP: Record<string, BrandConfig> = {
  // SupplyMind AI — default / fallback
  'supplymind-iq.vercel.app': {
    name: 'SupplyMind AI',
    subtitle: 'Optimization Engine',
    color: '#ffffff',
    logo: 'zap',
  },
  // Persistent
  'supply-iq-persistent.vercel.app': {
    name: 'PERSISTENT',
    subtitle: 'SupplyMind AI',
    color: '#ee7d2f',
    logo: 'image',
    logoSrc: '/logos/persistent.png',
  },
  // Cogniify
  'supply-iq-cogniify.vercel.app': {
    name: 'COGNIIFY',
    subtitle: 'SupplyMind AI',
    color: '#4f46e5',
    logo: 'image',
    logoSrc: '/logos/cogniify.png',
  },
};

const DEFAULT_BRAND: BrandConfig = {
  name: 'SupplyMind AI',
  subtitle: 'Optimization Engine',
  color: '#ffffff',
  logo: 'zap',
};

export function getBrand(): BrandConfig {
  const hostname = window.location.hostname;
  // Check for exact match first
  if (BRAND_MAP[hostname]) return BRAND_MAP[hostname];
  // Check for partial match (in case of custom domains)
  for (const [domain, config] of Object.entries(BRAND_MAP)) {
    if (hostname.includes(domain.split('.')[0])) return config;
  }
  // Localhost or unknown → default
  return DEFAULT_BRAND;
}
