import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const globalStyles = `
  /* Ensure iOS Safari never auto-zooms inputs and never shows blue focus rings */
  input, select, textarea, button, a {
    font-size: 16px !important;
    outline: none !important;
    outline-width: 0 !important;
    outline-color: transparent !important;
    -webkit-tap-highlight-color: transparent !important;
    box-shadow: none !important;
  }
  *:focus, *:focus-visible, *:focus-within {
    outline: none !important;
    box-shadow: none !important;
  }
  input:focus, textarea:focus, select:focus {
    outline: none !important;
    outline-style: none !important;
    outline-width: 0 !important;
    outline-color: transparent !important;
    box-shadow: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }
  html, body, #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #0a0a0a;
    -webkit-text-size-adjust: 100%;
    touch-action: manipulation;
  }
  body {
    -webkit-overflow-scrolling: touch;
  }
`;

/**
 * Custom root HTML for Expo Router web output.
 * Configured for iOS Safari full-screen standalone PWA and preventing iOS input auto-zoom.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        
        {/* Polyfill SharedArrayBuffer for Web/Safari to prevent ReferenceErrors */}
        <script
          dangerouslySetInnerHTML={{
            __html: "if (typeof window !== 'undefined' && typeof window.SharedArrayBuffer === 'undefined') { window.SharedArrayBuffer = window.ArrayBuffer; }",
          }}
        />

        {/* 1. Prevent iOS Safari auto-zoom on input focus + cover safe areas */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* 2. Apple iOS PWA Full Screen / Standalone (Real App feel without Safari URL bar) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Moolah" />
        <meta name="application-name" content="Moolah" />
        <meta name="theme-color" content="#0a0a0a" />

        {/* 3. PWA Icons & Manifest */}
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* 4. Global CSS to guarantee inputs never zoom on iOS and full screen height */}
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}