import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ma Earth',
  description: 'Ma Earth — Sign in with your identity',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        background: '#F2EBE4',
        color: '#1A130F',
        minHeight: '100vh',
      } as React.CSSProperties}>
        {children}
      </body>
    </html>
  )
}
