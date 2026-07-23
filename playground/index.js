import { signal, memo } from 'https://cdn.jsdelivr.net/gh/azatshtru/relic/lib/relic-core.js';
import { syn, mount, bind } from 'https://cdn.jsdelivr.net/gh/azatshtru/relic/lib/relic-anvil.js';

function Playground() {
    return syn('h1').text('Hello, world!');
}

mount(Playground(), document.body);
