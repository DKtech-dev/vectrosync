import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root.jsx'
import { ThemeProvider } from './utils/theme.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </React.StrictMode>,
)
