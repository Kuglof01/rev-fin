import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spendly — Spending Tracker',
  description: 'Track purchases and explore spending by category and subcategory.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
