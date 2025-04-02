import * as React from 'react';
import '../styles/globals.css';
import '../styles/fonts.css';
import ClientLayout from '../components/ClientLayout';

const url = 'https://booktalk-app.com/';
const title = 'BookTalk — Connect with readers, discuss books, and share progress';
const description =
  'Discover BookTalk, the social book reading platform where readers connect. ' +
  'Share your reading progress, join book clubs, discuss with friends, ' +
  'and enjoy powerful tools for highlighting, bookmarking, and commenting. ' +
  'Perfect for social reading and community building around books. Explore now!';
const previewImage = '/images/open_graph_preview.png';

export const metadata = {
  title,
  description,
  generator: 'Next.js',
  manifest: '/manifest.json',
  keywords: ['social reading', 'epub', 'pdf', 'ebook', 'reader', 'booktalk', 'pwa'],
  authors: [
    {
      name: 'booktalk',
      url: 'https://github.com/booktalk/booktalk',
    },
  ],
  icons: [
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png' },
    { rel: 'icon', url: '/icon.png' },
  ],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: 'white',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>{title}</title>
        <meta
          name='viewport'
          content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover'
        />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='BookTalk' />
        <link rel='apple-touch-icon' sizes='180x180' href='/apple-touch-icon.png' />
        <link rel='icon' href='/favicon.ico' />
        <link rel='manifest' href='/manifest.json' />
        <meta name='description' content={description} />
        <meta property='og:url' content={url} />
        <meta property='og:type' content='website' />
        <meta property='og:title' content={title} />
        <meta property='og:description' content={description} />
        <meta property='og:image' content={previewImage} />
        <meta name='twitter:card' content='summary_large_image' />
        <meta property='twitter:domain' content='booktalk-app.com' />
        <meta property='twitter:url' content={url} />
        <meta name='twitter:title' content={title} />
        <meta name='twitter:description' content={description} />
        <meta name='twitter:image' content={previewImage} />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
