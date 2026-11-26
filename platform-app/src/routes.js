const PAGE = [
  { prefix: '/coach', roles: ['coach'] },
  { prefix: '/lite', roles: ['coach'] },
  { prefix: '/organiser', roles: ['organiser'] },
  { prefix: '/auditor', roles: ['auditor'] },
  { prefix: '/student', roles: ['student'] },
  { prefix: '/records', roles: ['coach', 'organiser', 'auditor'] },
  { prefix: '/audit', roles: ['organiser', 'auditor'] },
  { prefix: '/access', roles: ['organiser', 'auditor'] },
  { prefix: '/integrity', roles: ['organiser', 'auditor'] },
  { prefix: '/settings', roles: ['coach', 'organiser', 'auditor', 'student'] },
  { prefix: '/demo', roles: ['coach', 'organiser', 'auditor', 'student'] },
  { prefix: '/print', roles: ['coach', 'organiser', 'auditor', 'student'] },
  { prefix: '/search', roles: ['coach', 'organiser', 'auditor', 'student'] },
  { prefix: '/verify', roles: ['coach', 'organiser', 'auditor', 'student'] },
];

export function isExportPost(pathname) {
  return /^\/(?:api\/claims|auditor\/exports)\/[a-z0-9-]+\/export$/.test(pathname);
}

export function pageAllowed(pathname, role) {
  const rule = PAGE.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`) || (item.prefix === '/audit' && pathname === '/audit.csv'));
  if (!rule) return true;
  return rule.roles.includes(role);
}

export function auditorWriteBlocked(method, pathname) {
  return method === 'POST' && !isExportPost(pathname);
}
