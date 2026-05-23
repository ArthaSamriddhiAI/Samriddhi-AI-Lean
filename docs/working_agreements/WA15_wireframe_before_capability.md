# WA15: Wireframe before capability

## Agreement

Capability work catches up to wireframes. When a product surface is being designed, the wireframe (or its equivalent design artifact) lands first; the capability buildout that implements the wireframe follows. The wireframe is the source of truth for what the surface should look and feel like; the capability inherits its visual register from there.

## Rationale

*(Extended from the planner v11.3 body; the planner card carried the agreement text above without separate rationale / trigger / examples sections.)*

Designing the surface before building it keeps the capability's output shaped to a known target rather than guessed at, and avoids capability work that later has to be reshaped to fit a wireframe authored after the fact. It pairs with WA09 (capability ships data, design ships render): the wireframe defines the render contract the capability's data must satisfy.

## Trigger

*(Extended from planner body.)* Adopted as the design-versus-capability sequencing discipline for product surfaces. Codified into the repo during T-5.06 (time-series-performance) alongside WA16-18, which were likewise planner-canonical but not yet in `docs/working_agreements/`.

## Examples

**Compliance:** A Samriddhi 2 Analysis-surface wireframe lands; the capability that computes the data it renders is built afterward and inherits the surface's register.

**Non-compliance:** Building a capability surface's interactive UI in full before any wireframe exists, then reshaping it when the design lands.

## Cross-references

WA09 (capability ships data, design ships render); the UI/UX debt log records render-layer deferrals from capability workstreams. Codified from planner v11.3.
