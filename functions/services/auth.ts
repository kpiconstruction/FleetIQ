export async function getUserFromRequest(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  const adminToken = Deno.env.get('EXPORT_ADMIN_TOKEN') || '';
  if (!token) return null;
  if (adminToken && token === adminToken) return { fleet_role: 'FleetAdmin' };
  return null;
}
