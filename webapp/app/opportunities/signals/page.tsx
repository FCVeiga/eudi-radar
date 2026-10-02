import { redirect } from 'next/navigation';

// Signals moved to News (and the home feed).
export default function SignalsPage() {
  redirect('/news/signals');
}
