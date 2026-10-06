// Frozen copy of the commodity balance ledger at 0f60c68, the reference for tools/commodity-ledger-equivalence.test.mjs.
/* BEGIN COMMODITY BALANCE ENGINE */
/* Dependency-free commodity balance core. Balances are numeric nested Maps;
   daily deltas are derived state held outside each ledger instance. */
globalThis.CommodityBalanceLedger = (() => {
  const DAILY = new WeakMap();
  const FACILITY_ORDER = '_commodityOrder';
  const AVAILABILITY = new Set(['held', 'sale', 'unassigned', 'transit', 'market-cleared']);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const keyFor = (m, k, make) => { let v = m.get(k); if (v === undefined && make) m.set(k, v = make()); return v; };
  const fail = message => { throw new Error(message); };
  const finiteNonnegative = (n, label) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) fail(`${label} must be finite and nonnegative`);
    return n;
  };
  const finiteDelta = n => {
    if (typeof n !== 'number' || !Number.isFinite(n)) fail('delta must be finite');
    return n;
  };
  const defaultOwnerId = owner => {
    if (owner == null) return 'unassigned';
    if (typeof owner === 'string' || typeof owner === 'number') return String(owner);
    if (owner.id != null) return String(owner.id);
    if (owner.storageOwnerId != null) return String(owner.storageOwnerId);
    fail('object owner requires id, storageOwnerId, or ownerId callback');
  };
  const ownerIdString = (value, label) => {
    if (value == null || typeof value === 'object' || typeof value === 'function' || typeof value === 'symbol') fail(`${label} must resolve to a stable string or number`);
    if (typeof value === 'number' && !Number.isFinite(value)) fail(`${label} must resolve to a stable string or number`);
    return String(value);
  };
  function cloneValue(value, path) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (Array.isArray(value)) return value.map((v, i) => cloneValue(v, `${path}[${i}]`)).filter(v => v !== OMIT);
    const proto = value && Object.getPrototypeOf(value);
    if (value && (proto === null || Object.getPrototypeOf(proto) === null && proto.constructor?.name === 'Object')) {
      const out = {};
      for (const k of Object.keys(value).sort()) { if (k === '__proto__') continue; const copy = cloneValue(value[k], `${path}.${k}`); if (copy !== OMIT) out[k] = copy; }
      return out;
    }
    return OMIT;
  }
  const OMIT = Symbol('omit');
  function metadataOf(id, data, prior) {
    const input = { ...(prior || {}), ...(data || {}) }, meta = {};
    for (const key of Object.keys(input).sort()) {
      const value = input[key];
      if (key === 'id' || key === 'balances' || key === 'owner' || key === '__proto__') continue;
      if (key === 'building') {
        if (value && typeof value === 'object' && (typeof value.storageId === 'string' || typeof value.storageId === 'number' && Number.isFinite(value.storageId))) meta.storageId = value.storageId;
        else if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) meta.building = value;
        continue;
      }
      if (key === 'capacity' && value === Infinity) { meta.capacity = null; meta.unlimited = true; continue; }
      const v = cloneValue(value, key); if (v !== OMIT) meta[key] = v;
    }
    if (own(data || {}, 'owner')) {
      const owner = data.owner;
      meta.ownerId = ownerIdString(DAILY.get(this).ownerId(owner), 'ownerId');
    } else if (input.ownerId !== undefined) meta.ownerId = ownerIdString(input.ownerId, 'ownerId');
    return Object.freeze(meta);
  }
  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Reflect.ownKeys(value)) freezeDeep(value[key]);
    return Object.freeze(value);
  }
  function nestedSet(root, keys, value) {
    let map = root;
    for (let i = 0; i < keys.length - 1; i++) map = keyFor(map, keys[i], () => new Map());
    map.set(keys[keys.length - 1], value);
  }
  function nestedGet(root, keys) {
    let map = root;
    for (let i = 0; i < keys.length - 1; i++) { map = map?.get(keys[i]); if (!map) return undefined; }
    return map?.get(keys.at(-1));
  }
  function nestedDelete(root, keys) {
    const maps = [root]; let map = root;
    for (let i = 0; i < keys.length - 1; i++) { map = map.get(keys[i]); if (!map) return; maps.push(map); }
    map.delete(keys.at(-1));
    for (let i = keys.length - 2; i >= 0; i--) {
      const child = maps[i + 1]; if (child.size) break; maps[i].delete(keys[i]);
    }
  }
  function rowKey(location, good, owner, availability) { return [location, good, owner, availability]; }
  function recordBalance(ledger, location, good, owner, availability, before, after, cause) {
    const state = DAILY.get(ledger), keys = rowKey(location, good, owner, availability);
    let row = nestedGet(state.rows, keys);
    if (!row) { row = { location, good, owner, ownerId: ownerIdString(state.ownerId(owner), 'ownerId'), availability, before, after }; nestedSet(state.rows, keys, row); }
    else row.after = after;
    if (cause) {
      let byGood = keyFor(state.flows, cause, () => new Map());
      byGood.set(good, (byGood.get(good) || 0) + (after - before));
    }
  }
  function recordLocation(ledger, id, before, after) {
    const state = DAILY.get(ledger), old = state.locations.get(id);
    if (!old) state.locations.set(id, { id, before, after });
    else old.after = after;
  }
  function recordNote(ledger, cause, qty, extra) {
    const state = DAILY.get(ledger), note = state.notes.get(cause) || { count: 0, qty: 0, metadata: null };
    note.count++;
    note.qty += qty;
    if (extra && Object.keys(extra).length) {
      const copy = cloneValue(extra, 'note'); note.metadata = copy === OMIT ? null : copy;
    }
    state.notes.set(cause, note);
  }
  function clearBuffer(state) { state.rows = new Map(); state.locations = new Map(); state.flows = new Map(); state.notes = new Map(); }
  function invalidateQuantity(state, owner, good) {
    const goods = state.quantityCache.get(owner); if (goods) goods.delete(good);
  }
  function ownerFacilitySet(state, owner, good, make = false) {
    let goods = state.ownerFacilities.get(owner);
    if (!goods && make) state.ownerFacilities.set(owner, goods = new Map());
    let ids = goods?.get(good);
    if (!ids && make) goods.set(good, ids = new Set());
    return ids;
  }
  function invalidateFacilityQueries(state, facility) {
    state.usedCache.delete(facility.id);
    for (const [good, owners] of facility.balances) {
      state.totalCache.delete(good);
      for (const [owner] of owners) invalidateQuantity(state, owner, good);
    }
  }

  return class CommodityBalanceLedger {
    constructor({ realmId = 0, day = 0, ownerId = defaultOwnerId, volumes = {}, assert = () => {} } = {}) {
      if (typeof ownerId !== 'function') fail('ownerId must be a function');
      if (typeof assert !== 'function') fail('assert must be a function');
      if (!Number.isSafeInteger(realmId) || realmId < 0) fail('realmId must be a nonnegative safe integer');
      if (!volumes || typeof volumes !== 'object' || Array.isArray(volumes)) fail('volumes must be a good-to-volume object');
      for (const [g, v] of Object.entries(volumes)) if (!g || typeof v !== 'number' || !Number.isFinite(v) || !(v > 0)) fail('volumes must be positive finite numbers');
      this.version = 3; this.realmId = realmId; this.day = finiteNonnegative(day, 'day'); this.settlementRevision = 0; this.facilities = new Map(); this.locations = this.facilities;
      DAILY.set(this, { ownerId, assert, volumes: { ...volumes }, rows: new Map(), locations: new Map(), flows: new Map(), notes: new Map(),
        usedCache: new Map(), totalCache: new Map(), quantityCache: new Map(), ownerFacilities: new Map(),
        orderRanks: new Map(), nextOrderRank: 0 });
    }
    _assert() { DAILY.get(this).assert(); }
    ownerId(owner) { return ownerIdString(DAILY.get(this).ownerId(owner), 'ownerId'); }
    location(id, data = {}) {
      this._assert();
      if (id == null || !['string', 'number'].includes(typeof id) || typeof id === 'number' && !Number.isFinite(id)) fail('location id must be a stable string or finite number');
      if (!data || typeof data !== 'object' || Array.isArray(data)) fail('location metadata must be an object');
      let facility = this.facilities.get(id);
      const prior = facility?.metadata || null;
      const capacity = own(data, 'capacity') ? data.capacity : facility ? facility.capacity : Infinity;
      if (typeof capacity !== 'number' || Number.isNaN(capacity) || capacity < 0) fail('capacity must be nonnegative');
      const active = own(data, 'active') ? !!data.active : facility ? facility.active : true;
      const transit = own(data, 'transit') ? !!data.transit : facility ? facility.transit : false;
      const goods = own(data, 'goods') ? data.goods == null ? null : new Set(data.goods) : facility?.goods ? new Set(facility.goods) : null;
      if (goods && [...goods].some(g => typeof g !== 'string')) fail('goods must contain strings');
      const volume = own(data, 'volume') ? finiteNonnegative(data.volume, 'volume') : facility?.volume ?? 1;
      if (!(volume > 0)) fail('volume must be positive');
      const volumes = own(data, 'volumes') ? { ...data.volumes } : facility?.volumes || {};
      for (const [g, v] of Object.entries(volumes)) if (typeof g !== 'string' || typeof v !== 'number' || !Number.isFinite(v) || !(v > 0)) fail('per-good volumes must be positive finite numbers');
      const next = { ...(facility || {}), ...data, id, capacity, active, transit, goods: goods ? [...goods] : null, volume, volumes,
        balances: facility?.balances || new Map(), metadata: null };
      if (facility) {
        const stats = this._usedStats(id), tolerance = this._roundoff(stats.magnitude, stats.terms, capacity);
        if (capacity < stats.sum - tolerance) fail(`capacity reduction would overfill location ${String(id)} (prior=${facility.capacity}, new=${capacity}, used=${stats.sum})`);
      }
      const normalized = { ...data, capacity, active, transit, volume, volumes, goods: goods ? [...goods] : null };
      if (!own(data, 'owner') && prior?.ownerId !== undefined) normalized.ownerId = prior.ownerId;
      const metadata = metadataOf.call(this, id, normalized, prior);
      next.metadata = metadata;
      if (facility && goods) for (const row of this.entries({ location: id, includeTransit: true })) if (!goods.has(row.good) && !(row.good === 'char' && goods.has('timber'))) fail('location update excludes stored good');
      const before = prior;
      const state = DAILY.get(this), queryChanged = !facility ||
        facility.transit !== next.transit || facility.volume !== next.volume ||
        JSON.stringify(facility.volumes) !== JSON.stringify(next.volumes) ||
        JSON.stringify(facility.goods) !== JSON.stringify(next.goods) || facility.active !== next.active;
      if (!facility) {
        this.facilities.set(id, facility = next);
        // An immutable ordinal on the canonical facility preserves its Map order.
        // Reuse the existing sequence; no second facility membership index.
        Object.defineProperty(facility, FACILITY_ORDER, { value: state.nextOrderRank++ });
      }
      else Object.assign(facility, next);
      if (queryChanged) invalidateFacilityQueries(state, facility);
      if (JSON.stringify(before) !== JSON.stringify(metadata)) recordLocation(this, id, before, metadata);
      return facility;
    }
    _facility(id) { const f = this.facilities.get(id); if (!f) fail(`unknown location: ${String(id)}`); return f; }
    facilityOrder(id) { return this._facility(id)[FACILITY_ORDER]; }
    volume(good) { const defaults = DAILY.get(this).volumes; return defaults[good] ?? (good === 'char' ? defaults.timber : undefined) ?? 1; }
    _volume(facility, good) { const defaults = DAILY.get(this).volumes; return facility.volumes[good] ?? defaults[good] ?? (good === 'char' ? defaults.timber : undefined) ?? facility.volume ?? 1; }
    _canStore(facility, good) {
      if (!facility.active) return false;
      if (facility.goods && !facility.goods.includes(good) && !(good === 'char' && facility.goods.includes('timber'))) return false;
      return true;
    }
    used(location) {
      return this._usedStats(location).sum;
    }
    _roundoff(magnitude, terms, capacity = 0, extraMagnitude = 0) {
      const scale = magnitude + extraMagnitude + (Number.isFinite(capacity) ? Math.abs(capacity) : 0);
      return Number.EPSILON * scale * (terms + 1) * 8;
    }
    _usedStats(location) {
      const state = DAILY.get(this), cached = state.usedCache.get(location);
      if (cached !== undefined) return cached;
      const facility = this._facility(location); let sum = 0, magnitude = 0, terms = 0;
      for (const [good, owners] of facility.balances) for (const availabilities of owners.values())
        for (const quantity of availabilities.values()) { const term = quantity * this._volume(facility, good); sum += term; magnitude += Math.abs(term); terms++; }
      const stats = { sum, magnitude, terms };
      state.usedCache.set(location, stats);
      return stats;
    }
    free(location, good) {
      const facility = this._facility(location);
      if (!this._canStore(facility, good)) return 0;
      return Math.max(0, facility.capacity - this.used(location)) / this._volume(facility, good);
    }
    _quantityAt(facility, good, owner, availability) {
      if (availability !== undefined) return facility.balances.get(good)?.get(owner)?.get(availability) || 0;
      let total = 0; const byOwner = facility.balances.get(good)?.get(owner);
      if (byOwner) for (const q of byOwner.values()) total += q;
      return total;
    }
    _set(facility, location, good, owner, availability, after, cause) {
      const state = DAILY.get(this);
      const before = nestedGet(facility.balances, [good, owner, availability]) || 0;
      if (before === after) return;
      if (after === 0) nestedDelete(facility.balances, [good, owner, availability]);
      else nestedSet(facility.balances, [good, owner, availability], after);
      state.usedCache.delete(location);
      state.totalCache.delete(good);
      invalidateQuantity(state, owner, good);
      if (before === 0 && after > 0) ownerFacilitySet(state, owner, good, true).add(location);
      else if (after === 0) {
        const ids = ownerFacilitySet(state, owner, good);
        if (ids && !facility.balances.get(good)?.has(owner)) {
          ids.delete(location);
          if (!ids.size) { state.ownerFacilities.get(owner)?.delete(good); if (!state.ownerFacilities.get(owner)?.size) state.ownerFacilities.delete(owner); }
        }
      }
      // Priority changes only with cell membership, never on ordinary quantity updates.
      if (before === 0 && after > 0) nestedSet(state.orderRanks, [location, good, owner, availability], state.nextOrderRank++);
      else if (before > 0 && after === 0) nestedDelete(state.orderRanks, [location, good, owner, availability]);
      recordBalance(this, location, good, owner, availability, before, after, cause);
    }
    adjust(location, good, owner, availability, delta, cause = 'adjustment') {
      this._assert();
      finiteDelta(delta); this._validateRow(good, owner, availability);
      const facility = this._facility(location), before = this._quantityAt(facility, good, owner, availability);
      if (delta > 0) {
        const stats = this._usedStats(location), free = Math.max(0, facility.capacity - stats.sum) / this._volume(facility, good);
        const tolerance = this._roundoff(stats.magnitude, stats.terms, facility.capacity, delta * this._volume(facility, good));
        if (!this._canStore(facility, good) || delta > free + tolerance / this._volume(facility, good)) fail(`insufficient compatible capacity at ${String(location)} (capacity=${facility.capacity}, used=${stats.sum})`);
      } else if (delta < 0) {
        const amount = -delta, tolerance = Number.EPSILON * Math.max(before, amount) * 8;
        if (amount > before + tolerance) fail('insufficient balance');
        delta = -Math.min(before, amount);
      }
      if (delta) this._set(facility, location, good, owner, availability, Math.max(0, before + delta), cause);
      return delta;
    }
    _validateRow(good, owner, availability) {
      if (typeof good !== 'string' || !good) fail('good is required');
      this.ownerId(owner);
      if (!AVAILABILITY.has(availability)) fail('invalid availability');
    }
    *entries(fields = {}) {
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) fail('fields must be an object');
      const has = key => own(fields, key), includeTransit = !!fields.includeTransit || fields.location !== undefined || fields.availability === 'transit';
      const state = DAILY.get(this); let ids;
      if (has('owner') && has('good')) ids = ownerFacilitySet(state, fields.owner, fields.good) || [];
      else if (has('owner')) { ids = new Set(); for (const locations of state.ownerFacilities.get(fields.owner)?.values() || []) for (const id of locations) ids.add(id); }
      else ids = state.orderRanks.keys(); // existing positive-row index excludes retired, empty cargo
      const ledger = this, facilities = has('location') ? [[fields.location, this._facility(fields.location)]] : (function* () { for (const id of ids) { const facility = ledger.facilities.get(id); if (facility) yield [id, facility]; } })();
      const selected = [];
      for (const [location, facility] of facilities) {
        if (!includeTransit && facility.transit) continue;
        const goods = has('good') ? [[fields.good, facility.balances.get(fields.good)]] : facility.balances;
        for (const [good, owners] of goods) {
          if (!owners) continue;
          const ownerEntries = has('owner') ? [[fields.owner, owners.get(fields.owner)]] : owners;
          for (const [owner, availabilities] of ownerEntries) {
            if (!availabilities) continue;
            const rows = has('availability') ? [[fields.availability, availabilities.get(fields.availability)]] : availabilities;
            for (const [availability, qty] of rows) {
              if (!(qty > 0) || !AVAILABILITY.has(availability)) continue;
              if (!includeTransit && availability === 'transit') continue;
              const rank = nestedGet(DAILY.get(this).orderRanks, [location, good, owner, availability]);
              selected.push({ row: { location, good, owner, availability, qty }, rank: rank ?? Number.MAX_SAFE_INTEGER });
            }
          }
        }
      }
      selected.sort((a, b) => a.rank - b.rank);
      for (const item of selected) yield item.row;
    }
    *owners(good, availability, includeTransit = false) {
      for (const [owner, goods] of DAILY.get(this).ownerFacilities)
        if (goods.has(good) && this.quantity(owner, good, availability, includeTransit) > 0) yield owner;
    }
    quantity(owner, good, availability, includeTransit = false) {
      if (typeof good !== 'string' || !good) fail('good is required');
      if (availability !== undefined && availability !== null && !AVAILABILITY.has(availability)) fail('invalid availability');
      const state = DAILY.get(this), token = availability == null ? undefined : availability;
      let goods = state.quantityCache.get(owner); if (!goods) state.quantityCache.set(owner, goods = new Map());
      let variants = goods.get(good); if (!variants) goods.set(good, variants = new Map());
      let scopes = variants.get(token); if (!scopes) variants.set(token, scopes = new Map());
      const scope = !!includeTransit || token === 'transit';
      if (scopes.has(scope)) return scopes.get(scope);
      const terms = [];
      const ids = [...(ownerFacilitySet(state, owner, good) || [])];
      for (const id of ids) {
        const facility = this.facilities.get(id); if (!facility || !scope && facility.transit) continue;
        const rows = facility.balances.get(good)?.get(owner); if (!rows) continue;
        const selected = token !== undefined ? [[token, rows.get(token) || 0]] : [...rows];
        for (const [kind, qty] of selected) if (qty > 0 && (scope || kind !== 'transit')) {
          const rank = nestedGet(state.orderRanks, [id, good, owner, kind]);
          terms.push({ rank: rank ?? Number.MAX_SAFE_INTEGER, qty });
        }
      }
      terms.sort((a, b) => a.rank - b.rank);
      let total = 0; for (const term of terms) total += term.qty;
      scopes.set(scope, total);
      return total;
    }
    total(good, includeTransit = false) {
      if (typeof good !== 'string' || !good) fail('good is required');
      const state = DAILY.get(this), scope = !!includeTransit;
      let cached = state.totalCache.get(good);
      if (cached?.has(scope)) return cached.get(scope);
      let total = 0;
      const facilities = [];
      for (const [id, goods] of state.orderRanks) if (goods.has(good)) {
        const facility = this.facilities.get(id); if (facility) facilities.push(facility);
      }
      facilities.sort((a, b) => a[FACILITY_ORDER] - b[FACILITY_ORDER]);
      for (const facility of facilities) {
        if (!scope && facility.transit) continue;
        const owners = facility.balances.get(good); if (!owners) continue;
        for (const availabilities of owners.values()) for (const [kind, qty] of availabilities)
          if (scope || kind !== 'transit') total += qty;
      }
      if (!cached) state.totalCache.set(good, cached = new Map()); cached.set(scope, total);
      return total;
    }
    _plan(fields, quantity) {
      finiteNonnegative(quantity, 'quantity');
      const includeTransit = !!fields.includeTransit || fields.location !== undefined || fields.availability === 'transit';
      const selector = { ...fields, includeTransit };
      // A complete balance address selects one cell; there is no ordering to recover.
      if (own(selector, 'location') && own(selector, 'good') && own(selector, 'owner') && own(selector, 'availability')) {
        const facility = this._facility(selector.location), stored = facility.balances.get(selector.good)?.get(selector.owner)?.get(selector.availability);
        const sum = stored > 0 && AVAILABILITY.has(selector.availability) ? stored : 0;
        const tolerance = Number.EPSILON * Math.max(sum, quantity) * 8;
        if (quantity > sum + tolerance) fail('insufficient balance');
        const qty = Math.min(quantity, sum);
        return { plan: qty > 0 ? [{ location: selector.location, good: selector.good, owner: selector.owner, availability: selector.availability, qty }] : [], quantity: qty > 0 ? qty : 0, available: sum };
      }
      const available = [...this.entries(selector)];
      const sum = available.reduce((n, row) => n + row.qty, 0), tolerance = Number.EPSILON * Math.max(sum, quantity) * 8;
      if (quantity > sum + tolerance) fail('insufficient balance');
      let left = Math.min(quantity, sum); const plan = [];
      for (const row of available) { const qty = Math.min(left, row.qty); if (qty > 0) plan.push({ ...row, qty }); left -= qty; if (!(left > 0)) break; }
      return { plan, quantity: plan.reduce((n, row) => n + row.qty, 0), available: sum };
    }
    transfer(fields, quantity, to, { location, availability, cause = 'transfer' } = {}) {
      this._assert();
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) fail('fields must be an object');
      this.ownerId(to);
      const { plan, quantity: moved } = this._plan(fields, quantity);
      const destinations = plan.map(row => ({ ...row, toLocation: location === undefined ? row.location : location,
        toAvailability: availability === undefined ? row.availability : availability }));
      for (const row of destinations) this._validateRow(row.good, to, row.toAvailability);
      const usedDelta = new Map();
      for (const row of destinations) {
        const fromF = this._facility(row.location), toF = this._facility(row.toLocation);
        if (row.location !== row.toLocation && !this._canStore(toF, row.good)) fail('incompatible destination');
        if (row.location !== row.toLocation) {
          usedDelta.set(row.location, (usedDelta.get(row.location) || 0) - row.qty * this._volume(fromF, row.good));
          usedDelta.set(row.toLocation, (usedDelta.get(row.toLocation) || 0) + row.qty * this._volume(toF, row.good));
        }
      }
      for (const [id, delta] of usedDelta) {
        const facility = this._facility(id), stats = this._usedStats(id), projected = stats.sum + delta;
        const tolerance = this._roundoff(stats.magnitude, stats.terms, facility.capacity, Math.abs(delta));
        if (delta > 0 && (destinations.some(x => x.toLocation === id && !this._canStore(facility, x.good)) || projected > facility.capacity + tolerance))
          fail(`insufficient compatible capacity at ${String(id)} (capacity=${facility.capacity}, used=${stats.sum}, projected=${projected})`);
        if (projected < -tolerance) fail(`insufficient source balance at ${String(id)} (used=${stats.sum}, projected=${projected})`);
      }
      for (const row of destinations) {
        const fromF = this._facility(row.location), toF = this._facility(row.toLocation);
        if (row.owner === to && row.availability === row.toAvailability && row.location === row.toLocation) continue;
        this._set(fromF, row.location, row.good, row.owner, row.availability, Math.max(0, this._quantityAt(fromF, row.good, row.owner, row.availability) - row.qty), cause);
        const before = this._quantityAt(toF, row.good, to, row.toAvailability);
        this._set(toF, row.toLocation, row.good, to, row.toAvailability, before + row.qty, cause);
      }
      return moved;
    }
    consume(fields, quantity, cause = 'consume') {
      this._assert();
      const { plan, quantity: consumed } = this._plan(fields, quantity);
      for (const row of plan) {
        const facility = this._facility(row.location), before = this._quantityAt(facility, row.good, row.owner, row.availability);
        this._set(facility, row.location, row.good, row.owner, row.availability, Math.max(0, before - row.qty), cause);
      }
      return consumed;
    }
    event(cause, _lot, qty, extra = {}) {
      this._assert();
      if (typeof cause !== 'string' || !cause) fail('cause is required');
      finiteDelta(qty);
      if (!extra || typeof extra !== 'object' || Array.isArray(extra)) fail('event metadata must be an object');
      recordNote(this, cause, qty, extra);
    }
    settle(day = this.day, emit = null) {
      this._assert();
      if (emit !== null && typeof emit !== 'function') fail('emit must be a function');
      finiteNonnegative(day, 'day');
      const state = DAILY.get(this), deltas = [];
      const flattenRows = map => { for (const value of map.values()) if (value instanceof Map) flattenRows(value); else yieldRow(value); };
      const yieldRow = row => { if (!Object.is(row.before, row.after)) deltas.push({ location: row.location, good: row.good, owner: row.ownerId, availability: row.availability,
        before: row.before, after: row.after, delta: row.after - row.before }); };
      flattenRows(state.rows);
      const locations = [...state.locations.values()].filter(x => JSON.stringify(x.before) !== JSON.stringify(x.after)).map(x => ({ id: x.id, after: x.after }));
      const flows = {};
      for (const [cause, goods] of state.flows) { const row = {}; for (const [good, qty] of goods) if (qty !== 0) Object.defineProperty(row, good, { value: qty, enumerable: true, writable: true, configurable: true }); if (Object.keys(row).length) Object.defineProperty(flows, cause, { value: row, enumerable: true, writable: true, configurable: true }); }
      const notes = {};
      for (const [cause, note] of state.notes) Object.defineProperty(notes, cause, { value: { count: note.count, qty: note.qty, metadata: note.metadata }, enumerable: true, writable: true, configurable: true });
      if (!deltas.length && !locations.length && !Object.keys(flows).length && !Object.keys(notes).length) { clearBuffer(state); this.day = day; return null; }
      const event = freezeDeep({ kind: 'storage', cause: 'daily-settlement', version: 3, settlement: this.realmId,
        day, revision: this.settlementRevision + 1, deltas, locations, flows, ...(Object.keys(notes).length ? { notes } : {}) });
      if (emit) emit(event);
      this.day = day;
      this.settlementRevision++;
      clearBuffer(state);
      return event;
    }
  };
})();

