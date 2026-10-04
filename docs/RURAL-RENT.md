# Rural rent follows the owner’s current household

`tickHouseholds` now pays rural rent through the existing canonical `transfer` operation. It resolves the recorded property owner's current household on each payment; the recipient is not pinned to a parent's household. A tenant and owner belonging to the same household pay no rent to themselves, preserving both purse and income counters. Existing affordability limits, absent-owner behavior and estate successor routing remain intact.

No household formation, marriage, inheritance or property ownership rule changes. A child can own the family roof while remaining a household member. Once `householdPortion` creates their independent household and updates their property title, later rent reaches that new account. Tests exercise both an external tenant and a parent occupying the child's property across this transition.

## First causal transaction

Frozen source SHA256 `ce80a3a5149620c47acf97e0aecf95d59a54ff9b9b1e9740d4b73b1b99f48dee`, seed 1001 sea, day 1295: `tickHouseholds` lost `25.144620202627266` coins with zero external flow and no simulation errors. Instrumenting the actual rural rent statements isolated the loss at Valpont. Tenant Berthe (person 2122) and landlord Baudoin (person 2886) belonged to `hh744`, headed by Berthe. Rent was `25.144620202625774`. Baudoin's non-head `w` accessor returned zero and ignored its credit; Berthe's debit reduced the family's actual purse. The tiny difference between payment and census residual is floating-point cancellation.

The same original-parent (`9753322dea76eeca750a928e9133cf38d17f211d`) and integrated (`0a670d6`) caller reproduce the loss in a controlled non-head-owner fixture. This is an actual debit without a credited account, not an omitted purse or prepaid label mismatch. The conservation oracle and `0.01` annual threshold are unchanged.

Nine focused regressions cover current account credit, adult/child ownership, dead-owner successors, same-account purse and income, available funds, absent owners, tiny payments, independent household formation and property rebinding. All 267 Node tests pass. Local evidence: `.git/storage/2026-10-03/inventory/mature-{money-frozen-full,rent-frozen}`, `rural-rent-baseline-proof.json`, and `rural-rent-tests.txt`.

This repair intentionally changes erroneous rent losses and subsequent financial outcomes. The exact combined source still requires mature multi-seed reruns. Separately, controlled original/current fixtures show `killNotable` erases a signed purse when a noble line ends; this distinct latent defect is not changed here. Neither this bounded repair nor passing samples establish whole-engine financial correctness.
