/** Entry of the data browser page (tools.html). */
import { render } from 'preact';
import { App } from './App';
import './browser.css';

render(<App />, document.getElementById('app')!);
