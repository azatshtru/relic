import { effect } from "./relic-core.js";

export function mount(elementWrapper, parent) {
  parent.appendChild(...elementWrapper.unwrap());
  elementWrapper.build();
}

export function bind(...parts) {
  if(parts.length < 2 || typeof parts[0] !== 'string' || typeof parts[1] !== 'function') {
    throw new Error("relic.anvil. Invalid arguments supplied in bind. The correct structure is `bind(key: string, predicate: function)`");
  }
  return {
    parts,
  };
}

export function syn(htmlTag) {
  const element = document.createElement(htmlTag);
  const activeEffects = [];
  const children = [];
  const staticChildrenIndices = [];

  return {
    unwrap() {
      return [element];
    },

    first() {
      return element;
    },

    last() {
      return element;
    },

    anchor() {
      return (...stuff) => this.first().before(...stuff);
    },

    isEmpty() {
      return false;
    },

    build() {
      staticChildrenIndices
        .map((i) => children[i])
        .forEach((child) => element.append(...child.unwrap()));
      children.forEach((child) => child.build());
    },

    clean() {
      children.forEach((child) => child.clean());
      activeEffects.forEach((activeEffect) => activeEffect.clean());
      element.remove();
    },

    text(s) {
      if (typeof s === "function") {
        activeEffects.push(effect(() => (element.textContent = s())));
      } else {
        element.textContent = s;
      }
      return this;
    },

    on(event, fn) {
      element.addEventListener(event, fn);
      return this;
    },

    attr(attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (typeof value === "function") {
          activeEffects.push(
            effect(() => element.setAttribute(key, value())),
          );
        } else {
          element.setAttribute(key, value);
        }
      }
      return this;
    },

    prop(key, value) {
      if (typeof value === "function") {
        activeEffects.push(effect(() => (element[key] = value())));
      } else {
        element[key] = value;
      }
      return this;
    },

    children(things) {
      let next = (...stuff) => element.append(...stuff);
      for (const thing of things.toReversed()) {
        if (typeof thing === "function") {
          const frame = dynFrame(thing, next, null);
          next = frame.anchor();
          children.push(frame);
        } else {
          next = thing.anchor();
          children.push(thing);
          staticChildrenIndices.push(things.length - children.length);
        }
      }
      children.reverse();
      staticChildrenIndices.reverse();
      return this;
    },
  };
}

function dynFrame(fn, next, parent) {
  let activeEffect;
  let differ;

  return {
    next,
    parent,
    range: domRange(),
    binds: new Map(),
    children: [],

    unwrap() {
      return this.range.toArray();
    },

    first() {
      return this.range.first();
    },

    last() {
      return this.range.last();
    },

    anchor() {
      return this;
    },

    build() {
      differ = dynDiffer(this);
      const fnPrime = fn.length === 0 ? (o) => o.mut(fn()) : fn;
      activeEffect = effect(() => fnPrime(differ));
    },

    clean() {
      // for recursion stack optimization, perform depth first search here with
      // queue data structure, however this implementationshouldn't pose much problem.
      this.children.forEach((child) => child.clean());
      activeEffect.clean();
    },

    isEmpty() {
      return this.children.length === 0;
    },

    definiteRange() {
      if (this.children.length === 0) return [null, null];
      let first = 0;
      while (first < this.children.length && this.children[first].isEmpty())
        first++;
      if (first === this.children.length) return [null, null];
      let last = this.children.length - 1;
      while (this.children[last].isEmpty()) last--;
      return [this.children[first].first(), this.children[last].last()];
    },

    updateRange() {
      const [first, last] = this.definiteRange();
      this.range.update(first, last);
    },

    linkTo(next) {
      this.next = next;
    },
  };
}

function domRange(start = null, end = null) {
  let endpoints = [start, end];

  return {
    isEmpty() {
      return endpoints[0] == null || endpoints[1] == null;
    },

    first() {
      return endpoints[0];
    },

    last() {
      return endpoints[endpoints.length - 1];
    },

    update(newStart, newEnd) {
      endpoints = [newStart, newEnd];
    },

    toArray() {
      const range = [];
      const first = this.first();
      const last = this.last();
      let current = first;
      while (current && current !== last) {
        range.push(current);
        current = current.nextElementSibling;
      }
      range.push(last);
      return range;
    },
  };
}

function dynDiffer(frame) {
  return {
    diff(things) {},

    mut(things) {
      differImpl(this, frame, things);
    },
  };
}

function differImpl(differ, frame, things) {
  const { children, reorderedIndices, binds, resetKeys, unchanged } =
    assembleFrame(things, frame);

  differImplBuildMutated(children, unchanged);

  differImplCleanUnretained(frame, binds, resetKeys);

  const unorderedChildren = new Set(
    longestIncreasingSubsequence(reorderedIndices).map(
      (i) => frame.children[i],
    ),
  );

  differImplChainFrame(children, frame, unorderedChildren);

  frame.children = children;
  frame.binds = binds;

  differImplUpdateBranch(frame);
}

function assembleFrame(things, parentFrame) {
  const children = [];
  const binds = new Map();
  const reorderedIndices = [];
  const resetKeys = new Set();
  const unchanged = [];
  let next = null;
  let j = things.length - 1;
  while (j >= 0) {
    const thing = things[j];
    if (typeof thing === "function") {
      const frame = dynFrame(thing, next, parentFrame);
      children.push(frame);
      next = frame.anchor();
    } else if (typeof thing === "string") {
    } else if ("parts" in thing) {
      const [key, value, reset = false] = thing.parts;
      if (binds.has(key)) {
        throw new Error("relic.anvil. Duplicate keys in dynamic elements are invalid.");
      }
      things[j] = value;
      if (parentFrame.binds.has(key) && reset === false) {
        reorderedIndices.push(parentFrame.binds.get(key));
        things[j] = parentFrame.children[parentFrame.binds.get(key)];
        things[j].linkTo?.(next);
        unchanged.push(j);
      } else if (reset) {
        resetKeys.add(key);
      }
      binds.set(key, j);
      continue;
    } else {
      children.push(thing);
      next = thing.anchor();
    }
    j--;
  }
  return {
    children: children.reverse(),
    reorderedIndices: reorderedIndices.reverse(),
    binds,
    resetKeys,
    unchanged: unchanged.reverse(),
  };
}

function differImplBuildMutated(children, unchanged) {
  let j = 0;
  for (const [i, child] of children.entries()) {
    if (i == unchanged[j]) {
      j += 1;
      continue;
    }
    child.build();
  }
}

function differImplCleanUnretained(frame, binds, resetKeys) {
  const retained = new Set();
  for (const [key, value] of frame.binds) {
    if (binds.has(key) && !resetKeys.has(key)) {
      retained.add(value);
    }
  }
  for (const [i, child] of frame.children.entries()) {
    if (retained.has(i)) continue;
    child.clean();
  }
}

function differImplChainFrame(children, frame, unorderedChildren) {
  let next = nextAnchor(frame);
  for (const child of children.toReversed()) {
    if (child.isEmpty()) continue;
    if (!unorderedChildren.has(child)) {
      if (typeof next === "function") {
        next(...child.unwrap());
      } else {
        next.first().before(...child.unwrap());
      }
    }
    next = child.anchor();
  }
}

function differImplUpdateBranch(frame) {
  let currentFrame = frame;
  while (currentFrame) {
    const [first, last] = currentFrame.definiteRange();
    if (first != currentFrame.first() || last != currentFrame.last()) {
      currentFrame.updateRange();
      currentFrame = currentFrame.parent;
    } else break;
  }
}

function nextAnchor(frame) {
  let current = frame;
  while (true) {
    if (typeof current.next === "function") {
      return current.next;
    } else if (current.next === null) {
      current = current.parent;
    } else if (current.next.isEmpty()) {
      current = current.next;
    } else {
      return current.next;
    }
  }
}

function longestIncreasingSubsequence(numbers) {
  if (numbers.length === 0) return [];

  const n = numbers.length;
  const tails = [];
  const tailsIndices = [];
  const previousIndices = Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    const x = numbers[i];

    let left = 0;
    let right = tails.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (tails[mid] < x) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    if (left < tails.length) {
      tails[left] = x;
      tailsIndices[left] = i;
    } else {
      tails.push(x);
      tailsIndices.push(i);
    }

    if (left > 0) {
      previousIndices[i] = tailsIndices[left - 1];
    }
  }

  const lis = [];
  let index = tailsIndices[tailsIndices.length - 1];
  while (index !== -1) {
    lis.push(numbers[index]);
    index = previousIndices[index];
  }

  return lis.reverse();
}
