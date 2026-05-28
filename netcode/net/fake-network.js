// ===================================================================
// netcode/net/fake-network.js
//
// A SIMULATED network. The whole netcode track is built on top of this:
// every "send a message from client A to server" call across every demo
// goes through one of these objects, with sliders the learner can drag
// to introduce realistic latency, jitter, packet loss, and reordering.
//
// Why fake the network instead of using a real one?
// --------------------------------------------------
// 1. Zero backend — the project is a static site. A real server would
//    break that.
// 2. Reproducibility — combined with SeededRng, the same seed + same
//    actions produces the same outcome. Crucial for teaching: "look,
//    THAT's the moment the client mispredicted".
// 3. Slider-driven extremes — you can crank RTT to 500 ms or loss to
//    50% to see techniques like client-side prediction earn their keep.
//    No real network gives you that knob.
// 4. Surface-compatible with WebSocket/DataChannel — endpoints expose
//    `send(targetId, msg)` and `onMessage(handler)`. Swapping in a real
//    transport later is purely an implementation change.
//
// Mental model:
// -------------
//   const net = new FakeNetwork({ rttMs: 80, jitterMs: 20, lossRate: 0.02 });
//   const client = net.connect('client');
//   const server = net.connect('server');
//
//   client.send('server', { kind: 'input', tick: 12, ax: 1 });
//   server.onMessage((from, msg) => { ... });
//
//   // Each frame:
//   net.tick(performance.now());   // drains anything whose deliver-time arrived
//
// Every message is stamped with `deliverAt = now + oneWayLatency`, where
// the per-packet latency = rtt/2 + uniform_jitter ± reorderBoost. The
// queue is kept SORTED by deliverAt, so each tick we scan from the front
// until we find one not yet due. For a teaching demo with <100 in-flight
// messages this beats a binary heap on both code-clarity and allocation.
// ===================================================================

class FakeNetwork {
    /**
     * @param {object} opts
     * @param {number} [opts.rttMs=80]      - round-trip time. One-way latency = rttMs/2.
     * @param {number} [opts.jitterMs=20]   - random spread; each packet gets a
     *                                        uniform sample in [-jitter, +jitter].
     * @param {number} [opts.lossRate=0]    - probability in [0,1] that a packet is dropped.
     * @param {number} [opts.reorderRate=0] - probability in [0,1] that a packet
     *                                        gets a big extra delay (causing it
     *                                        to arrive after later packets).
     * @param {number} [opts.seed=1]        - PRNG seed for deterministic runs.
     */
    constructor({
        rttMs = 80,
        jitterMs = 20,
        lossRate = 0,
        reorderRate = 0,
        seed = 1,
    } = {}) {
        this.rttMs = rttMs;
        this.jitterMs = jitterMs;
        this.lossRate = lossRate;
        this.reorderRate = reorderRate;

        // Endpoints connected to this network, keyed by id.
        // value shape: { id, handlers: [fn], stats: {...} }
        this.endpoints = new Map();

        // In-flight messages, sorted ascending by deliverAt.
        // Inserted in order, drained from the front. O(n) insert is
        // fine for the small queues these demos produce.
        this.inFlight = [];

        // RNG used for loss, jitter, reorder — every random decision
        // the network makes pulls from this so a seed reproduces the
        // exact same "network weather" twice.
        this.rng = new SeededRng(seed);

        // Counters the UI can poll to render statistics overlays.
        this.stats = {
            sent: 0,
            delivered: 0,
            dropped: 0,
            reordered: 0,
        };
    }

    /**
     * Register a peer. Returns an endpoint with the surface a real
     * transport would expose: send(targetId, msg) + onMessage(handler).
     */
    connect(id) {
        if (this.endpoints.has(id)) {
            throw new Error(`FakeNetwork: endpoint '${id}' already connected`);
        }
        const handlers = [];
        const endpoint = {
            id,
            send: (targetId, msg) => this._enqueue(id, targetId, msg),
            onMessage: (handler) => handlers.push(handler),
            // Internal: the network calls this when a message arrives.
            _deliver: (from, msg) => {
                for (const h of handlers) h(from, msg);
            },
        };
        this.endpoints.set(id, { id, handlers, endpoint });
        return endpoint;
    }

    /**
     * Remove a peer. In-flight messages addressed to a disconnected
     * peer get silently dropped (same as TCP/UDP behaviour).
     */
    disconnect(id) {
        this.endpoints.delete(id);
    }

    /**
     * Update network conditions on the fly. UI sliders bind here.
     */
    setParams({ rttMs, jitterMs, lossRate, reorderRate } = {}) {
        if (rttMs !== undefined) this.rttMs = rttMs;
        if (jitterMs !== undefined) this.jitterMs = jitterMs;
        if (lossRate !== undefined) this.lossRate = lossRate;
        if (reorderRate !== undefined) this.reorderRate = reorderRate;
    }

    /**
     * Advance simulated time. Pass the current monotonic clock
     * (performance.now()). Drains every message whose deliverAt
     * has elapsed and hands it to the target endpoint.
     *
     * Call this once per frame, BEFORE your demo's simulation step
     * so the demo sees freshly-arrived inputs.
     */
    tick(nowMs) {
        // The queue is sorted ascending by deliverAt, so we keep
        // popping from the front until we hit one not yet due.
        while (this.inFlight.length > 0 && this.inFlight[0].deliverAt <= nowMs) {
            const pkt = this.inFlight.shift();
            const target = this.endpoints.get(pkt.to);
            if (target) {
                target.endpoint._deliver(pkt.from, pkt.msg);
                this.stats.delivered++;
            } else {
                // Target disconnected before delivery; quietly drop.
                this.stats.dropped++;
            }
        }
    }

    /**
     * Clear all in-flight messages. Useful when a demo "resets" without
     * tearing down the network object.
     */
    flush() {
        this.inFlight.length = 0;
    }

    /**
     * Reset statistics counters (UI "reset stats" button hook).
     */
    resetStats() {
        this.stats.sent = 0;
        this.stats.delivered = 0;
        this.stats.dropped = 0;
        this.stats.reordered = 0;
    }

    // -----------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------

    /**
     * Decide the fate of one outgoing message: drop it, schedule it,
     * possibly reorder it. Caller passes the synthetic `now` so the
     * test can drive time forward without performance.now().
     */
    _enqueue(from, to, msg) {
        this.stats.sent++;

        // 1. Loss check — drop the packet outright with probability lossRate.
        if (this.lossRate > 0 && this.rng.chance(this.lossRate)) {
            this.stats.dropped++;
            return;
        }

        // 2. Compute deliver time. One-way latency = rtt/2.
        //    Jitter is a uniform sample in [-jitterMs, +jitterMs].
        const oneWay = this.rttMs * 0.5;
        const jitter = this.jitterMs > 0
            ? this.rng.range(-this.jitterMs, this.jitterMs)
            : 0;

        // 3. Reorder: with probability reorderRate, add a big extra
        //    delay so this packet arrives AFTER ones sent later. We
        //    pick "big" as 1× the mean RTT — large enough to swap order
        //    with most subsequent packets but small enough to still
        //    arrive in a useful window.
        let reorderBoost = 0;
        if (this.reorderRate > 0 && this.rng.chance(this.reorderRate)) {
            reorderBoost = this.rttMs;
            this.stats.reordered++;
        }

        // Clamp negative deliver times to "right now" so a huge
        // negative jitter can't make a packet arrive in the past.
        const delay = Math.max(0, oneWay + jitter + reorderBoost);
        const sentAt = performance.now();
        const deliverAt = sentAt + delay;

        // 4. Insert into the sorted in-flight queue.
        //    Search from the back: typical deliver-times trend forward
        //    in time so most inserts land near the tail.
        //
        //    `sentAt` + `delay` are kept so demos can render each
        //    packet's progress along a lane as (now-sentAt)/delay.
        //    `reordered` flags packets that got the extra reorder
        //    boost so the renderer can highlight them.
        const pkt = { from, to, msg, sentAt, deliverAt, delay, reordered: reorderBoost > 0 };
        let i = this.inFlight.length;
        while (i > 0 && this.inFlight[i - 1].deliverAt > deliverAt) i--;
        this.inFlight.splice(i, 0, pkt);
    }
}

// Top-level expose. Name intentionally distinct from anything in
// shared/utils.js (verified pre-write).
window.FakeNetwork = FakeNetwork;
