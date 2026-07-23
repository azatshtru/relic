const runtime = {
    running: null,
    pending: [],
    isBatching: false,

    ex(listener) {
        const previous = this.running;
        this.running = listener;
        try {
            return listener.fn();
        } finally {
            this.running = previous;
        }
    },

    ac(ref) {
        if(this.running && !ref.has(runtime.running)) {
            ref.hook(runtime.running);
            runtime.running.cite(ref);
        }
    },

    queue(effect) {
        this.pending.push(effect);
    },

    flush() {
        while(this.pending.length > 0) {
            this.pending.pop().check();
        }
    },

    batch(fn) {
        this.isBatching = true;
        fn();
        this.flush();
        this.isBatching = false;
    }
}

export function batch(fn) {
    runtime.batch(fn);
}

export function signal(initial) {
    let value = initial;
    const listeners = new Set();
    let equals = (a, b) => a === b;

    const inner = {
        check() {
            return false;
        },

        has(listener) {
            return listeners.has(listener);
        },

        hook(listener) {
            listeners.add(listener);
        },

        unhook(listener) {
            listeners.delete(listener);
        },
    };

    function outer() {
        runtime.ac(inner);
        return value;
    }
    outer.mut = (fn) => {
        const prior = value;
        value = fn(value);
        if(!equals(value, prior)) {
            listeners.forEach(listener => listener.react());
        }
        if(!runtime.isBatching) {
            runtime.flush();
        }
    };
    outer.peek = () => value;
    outer.options = (options) => {
        equals = options.equals;
        return outer;
    }

    return Object.freeze(outer);
}

export function memo(fn) {
    let value = null;
    let stale = true;
    const refs = [];
    const listeners = new Set(); 
    let equals = (a, b) => a === b;

    const inner = {
        fn,

        check() {
            if(!stale) {
                return true;
            }

            if(refs.length > 0 && refs.every(ref => ref.check())) {
                stale = false;
                return true;
            }

            while(refs.length > 0) {
                refs.pop().unhook(this);
            }

            const prior = value;
            value = runtime.ex(this);
            stale = false;
            return equals(prior, value);
        },

        cite(ref) {
            refs.push(ref);
        },

        has(listener) {
            return listeners.has(listener);
        },

        hook(listener) {
            listeners.add(listener);
        },

        unhook(listener) {
            listeners.delete(listener);
        },

        react() {
            if(stale) return;
            stale = true;
            for(const listener of listeners) {
                listener.react(this);
            };
        },
    }

    function outer() {
        inner.check();
        runtime.ac(inner);
        return value;
    }
    outer.isStale = () => stale;
    outer.options = (options) => {
        equals = options.equals;
        return outer;
    }

    return Object.freeze(outer);
}

export function effect(fn) {
    const refs = [];
    let queued = false;

    const inner = {
        fn,

        check() {
            queued = false;

            if(refs.length > 0 && refs.every(ref => ref.check())) return;

            while(refs.length > 0) {
                refs.pop().unhook(this);
            }

            runtime.ex(this);
        },

        cite(ref) {
            refs.push(ref);
        },

        react() {
            if(queued) return;
            runtime.queue(this);    
            queued = true;
        }
    }

    inner.check();

    function outer() {}
    outer.clean = () => {
        while(refs.length > 0) {
            refs.pop().unhook(inner);
        }
    }

    return Object.freeze(outer);
}
