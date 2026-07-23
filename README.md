# relic
_remarkably written web-apps_

relic is a fine-grained reactive, declarative JavaScript "mid-level" framework designed using zero-cost abstractions, optimized for efficiency and correctness.

- fine-grained reactive? relic doesn't maintain a DOM tree and uses surgical diffing to minimize DOM updates on state change.
- declarative? relic's API utilizes pure functions that do not mutate the DOM until mounted.
- mid-level? [yes.](#mid-level)
- zero-cost abstractions? [yes.](#zero-cost-abstractions)
- efficient? being fast is about doing less. relic is just an API over raw JavaScript, two small files minified. relic uses minimal memory and uses the most optimized algorithms for diffing and internals, the API is single layer.
- correctness? relic requires you to be explicit, it doesn't hide decision making functionality under "magic", combined with the functional thinking model produces programs which are easier to prove the correctness of (given the constraints of JavaScript).

## mid-level?
relic is opinionated about its usage of the functional paradigm, but it doesn't enforce a particular way to compose your code using it.
relic isn't exactly low-level because it uses a minimal runtime to track reactive signals and updates.
In fact, relic provides a pretty ergonomic API and thinking model to compose your web apps with robustness and future scalability in mind.

relic acknowledges that no two projects are the same and each require a different design, mental model and domain-specific syntax. While modern "high-level" frameworks and meta-frameworks enforce a single opinionated philosophy which requires workarounds to mould into your project-specific liking (syntaxwise or else), relic provides single entry points to allow you to build a custom project-centric framework for each project you make.

relic doesn't have lifecycle hooks either, it provides an explicit mutation API which lets you specify other behaviour and attach DOM mutation hatches granularly, this means you don't have to remember complex internal lifecycle management systems. Unlike high-level frameworks, which are often divided between basic and advanced usage, there is no _advanced_ relic which expects you to understand (and remember) the internals of the framework to write _complex_ web apps. Each web app is simple enough to not warrant unaccounted complexity, and complex enough to not fit into fixed lifecycle systems, relic expects and allows you to build complexity only in places you need it.

relic remains unopinionated about how exactly you implement your own customized framework. You can write JavaScript facades, compilers, use any library or framework in the backend, relic easily attaches to anything and supports building on top of it, also relic doesn't have to be your entire project, you can use it to make some components inside other frameworks, or plain javascript, it is very modular, making things like hydration much more easier, hence the name "mid-level".

> A future roadmap plan is to build a JSX parser that compiles down to relic code for demonstration of the mid-levelness.

## zero-cost abstractions
Rendering elements dynamically is hard, it requires finding your place in the DOM, then mapping elements out from the data or state.
As of the time of writing this, frameworks like SolidJS and Svelte insert empty text nodes or comments respectively in the DOM to mark out where to insert the elements.
They provide abstractions like `<For/>`, `<Show>`, `{#each}`, `{#if}`, etc. to allow you to dynamically map state over elements, or conditionally render elements. While a good approach, the final generated html isn't what you would have written yourself, you wouldn't have inserted empty text nodes or empty comments to mark out areas to dynamically insert elements.

A zero-cost abstraction operates such that the abstraction you use to do something is just an easier way to do what you would have written yourself without the abstraction using the raw tools. Now this definition is fundamentally flawed because you always lose some granularity with the abstraction, we can never assume what someone intended, however one can get really close by knowing what they didn't.

relic doesn't create any external nodes or comments in the DOM, all the dynamic elements are composed using a single API `() => []` and tracked using an internal linked list. This means that relic doesn't try to assume what you meant. In fact, your dynamic lists aren't automatically keyed, and everything will be rerendered by default on state change, relic provides bounded computations using `bind` which lets you explicitly state that you want to key and preserve unchanged components between dynamic updates.

You customize the mounting/unmounting behaviour and implement transitions yourself because relic doesn't give you built-in `onMount`. However since relic is mid-level, having project specific transition or animation APIs is easy and wildly reusable. relic just provides `.mut()` API which lets you explicitly state when you want a DOM mutation during dynamic rendering.


## quickstart

### import the primitives
*through jsDelivr*
```javascript
import { signal, memo } from 'https://cdn.jsdelivr.net/gh/azatshtru/relic/lib/relic-core.js';
import { syn, mount, bind } from 'https://cdn.jsdelivr.net/gh/azatshtru/relic/lib/relic-anvil.js';
```

*or using html importmap*
```html
<script type="importmap">
{
    "imports": {
        "relic-anvil": "https://cdn.jsdelivr.net/gh/azatshtru/relic/lib/relic-anvil.js",
        "relic-core": "https://cdn.jsdelivr.net/gh/azatshtru/relic/lib/relic-core.js",
    }
}
</script>
```
then in javascript,
```javascript
import { signal, memo, effect } from "relic-core";
import { syn, bind, mount } from "relic-anvil";
```

### compose!
```javascript
function Hello() {
    return syn('h1').text('Hello, world!');
}

mount(Hello(), document.body);
```
