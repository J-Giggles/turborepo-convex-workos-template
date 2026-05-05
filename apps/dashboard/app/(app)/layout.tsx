import { readActiveOrg } from '../../lib/active-org';
import { Nav } from '../../components/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = await readActiveOrg();
  return (
    <div className="min-h-screen">
      <Nav orgName={org.name} userEmail={user.email} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
