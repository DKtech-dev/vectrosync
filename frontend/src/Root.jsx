import React, { useCallback, useEffect, useState } from 'react';
import App from './App.jsx';
import { Landing } from './landing/Landing.jsx';

function resolveViewFromHash() {
  return window.location.hash === '#console' ? 'console' : 'landing';
}

/**
 * Minimal, dependency-free router: the landing page is the entry point,
 * "Launch Console" (and the nav's Console link) switches to the dashboard.
 * State is mirrored to the URL hash so the browser back/forward buttons and
 * a direct #console link both work without adding react-router.
 */
export default function Root() {
  const [view, setView] = useState(resolveViewFromHash);

  useEffect(() => {
    const onHashChange = () => setView(resolveViewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const launchConsole = useCallback(() => {
    window.location.hash = '#console';
    setView('console');
  }, []);

  if (view === 'console') {
    return <App />;
  }
  return <Landing onLaunchConsole={launchConsole} />;
}
