import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme.css';
import './print.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
