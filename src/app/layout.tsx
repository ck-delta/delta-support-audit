export const metadata = {
  title: 'Delta Support Audit',
  description: 'Internal audit pipeline.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
