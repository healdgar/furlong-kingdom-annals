# Soak and profile

`tools/soak.mjs` drives isolated headless Chrome instances through CDP. It needs Node with its built-in WebSocket (verified with Node 25.2.1) and Chrome/Chromium; no packages or build step. Chrome uses the hardware GPU (Metal on macOS); the harness rejects reported software rasterizers. The JavaScript simulation itself runs on the CPU. It leaves the game source unchanged. Source snapshots, measurements and browser profiles stay local.

A short matched sample:

```sh
node tools/soak.mjs --seeds 688673834,1001,2002,3003,4004 \
  --coast sea,land --years 20 --par 8 --profile 20 --audit 120 \
  --out tools/soak-results/sample
```

The intended long soak:

```sh
node tools/soak.mjs --seeds 688673834,1001,2002,3003,4004 \
  --coast sea,land --years 200 --par 8 --profile 100,200 --audit 120 \
  --out tools/soak-results/centuries
```

Drawing, measured separately from busy parallel soaks:

```sh
node tools/soak.mjs --seeds 2002 --coast land --years 1 \
  --render 0 --devices laptop,phone --cpu 1,4 --speeds 1,5 \
  --profile 0 --par 1 --out tools/soak-results/drawing
```

For an older realm, use `--years 20 --render 20`. Each device/CPU/view/speed scenario reloads and repeats the undrawn history, so a large matrix takes considerable time. All scenarios begin at the same simulated day, then advance at the selected speed. Their recorded end dates can differ. Screen emulation and CPU throttling measure this host; they do not establish performance on physical phones or other laptops.

`--help` lists the remaining options. Choose a fresh output directory; existing yearly logs and profiles are never overwritten. SIGINT/SIGTERM terminate the harness's Chrome instances and retain completed measurements.

## Measurements

Each year records population and places, famine onsets and place-days, hunger and famine weighted by people-days, grain and tilled furlongs per head, fish production, household purchase and consumption, high-hunger days with food still stored, money by holder (including both craft pools) and its flow-book residual, simulation errors, wall proportions, deserted houses, heap, per-phase time and route calls. Tilled furlongs are a count, not hectares.

The frame loop is suppressed before boot. The harness yields after monthly land work so deferred tracks and fences finish before subsequent days use them. It also flushes the annual autosave. This avoids year-sized batches of delayed land callbacks. Undrawn histories are useful comparisons; equivalence to continuously rendered play is a separate check.

`msDay` includes measurement overhead, timer yields and deferred land work. `tickMsDay` measures the daily tick calls alone. The first `--audit` days additionally census purses around every phase, so their timing includes audit overhead. CPU profiles include work executed between the start and stop commands, including deferred callbacks. Parallel run timings describe that workload on this host.

Famine days per place-year use the actual daily number of places; villages count in both numerator and denominator. Famine flags are narrower than hunger: the game only declares a new famine above 100 people. Money fails reconciliation if any year's residual exceeds 0.01 coin. This is a bookkeeping check: prepaid wages labelled as payments without a payer can create a residual without losing actual coin. Netting residuals across years would hide cancelling faults.

## Local evidence

- `run.json`: source and harness SHA256 hashes, runtime, arguments and start time.
- `index.snapshot.html`: the exact game source loaded by that run.
- `<world>.browser.json`: Chrome version and protocol information.
- `<world>.jsonl`: one completed year's measurements per line.
- `<world>.summary.json`: updated after each completed year.
- `<world>-y<N>.cpuprofile`: raw DevTools CPU profile.
- `<world>.render.json`: drawing measurements, saved after each scenario.
- `summary.json` and `summary.md`: completed-run results.

Exit status is nonzero for a failed world or failed check; a completed run can correctly fail because the simulation's ledger does not reconcile. Partial logs alone do not establish completion of the requested duration. Results under `tools/soak-results/` are git-ignored.
