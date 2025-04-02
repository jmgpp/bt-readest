import { AppProps } from 'next/app';
import Head from 'next/head';
import Providers from '@/components/Providers';

import '../styles/globals.css';
import '../styles/fonts.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta
          name='viewport'
          content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover'
        />
        <meta name='application-name' content='BookTalk' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='BookTalk' />
        <meta
          name='description'
          content='Discover BookTalk, the social book reading platform where readers connect. Share your reading progress, join book clubs, discuss with friends, and enjoy powerful tools for highlighting, bookmarking, and commenting.'
        />
        <meta name='format-detection' content='telephone=no' />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='theme-color' content='white' />
        <link rel='manifest' href='/manifest.json' />
      </Head>
      <Providers>
        <Component {...pageProps} />
      </Providers>
    </>
  );
}

export default MyApp;
