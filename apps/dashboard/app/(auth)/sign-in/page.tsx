import { signInUrl } from '@repo/auth/server';
import { redirect } from 'next/navigation';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnPathname?: string }>;
}) {
  const { returnPathname } = await searchParams;
  const url = await signInUrl(returnPathname);
  redirect(url);
}
