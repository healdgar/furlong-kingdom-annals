# Texture correction evidence

The selected generated image and the running game were opened and compared together in `reference-comparison.png`. Source is 1586×992, normalized to 1440×900; runtime is 1440×900, density 1. Seed/fate 1001, sea coast, day 0, paused. The bridge scene is the same generated settlement arrangement, viewed from a closely matched camera. It is not an invented settlement that can be dismissed as unrelated.

| Surface | Correction | Evidence |
| --- | --- | --- |
| Meadow | Moss texture, small pale flowers, larger mottling, subdued green | bridge, coast |
| Cultivated earth | Furrow material, actual furlong and parcel headings | field, bridge |
| Road / field verge | Dirt and gravel blend to grass; connected path coordinates | capital, bridge |
| Road / bridge | Shared physical path phase and cobble surface | bridge |
| River / bank | Wet gravel and irregular alpha margin on the actual channel | river, bridge |
| Sea / shore | Height sampled with terrain triangle interpolation; shallow transparency | coast |
| Estuary | Actual coastline trimming; channel lowers and fades into sea | quay |
| Quay | Paving follows street; removed fake stretched contour ashlar | quay |
| Property stone walls | Instance-aligned horizontal stone courses, continuous scale | property |
| Wooden fences | Vertical post grain; horizontal rail grain | property, bridge |
| Plaster / masonry | Restrained plaster mottling and local masonry coordinates | property |
| Thatch / tile / slate | Real raster detail in local roof coordinates | property, capital |
| Trees | Bark, deciduous and pine surfaces retain seasonal tint | woodland |
| Tracks / track bridges | Packed earth; rotated timber and stone structure surfaces | realm |
| Castle / palisade | Stone/wood selection, local face/instance mapping | realm |

Rejected effects: diagonal atlas foam, dense white foam overlays, world-axis road joints, exaggerated quay stripes and broad uniform bank bands. Water uses a separate 512px quiet ripple texture whose U axis follows flow; shore ripples follow the existing water-field gradient. Gravel is isotropic. It needs no artificial directional courses on sloped banks.

`renderer-checks.json` records WebGL2 (nine views), WebGL1 (seven views), channel attributes and current card interaction checks. Matched capital draw calls remain 54. Total geometry is 1,756,487 triangles against 1,756,159 at `2fd9998`: 328 triangles, or 0.019%, from retaining river sections to the actual coast. No new building, foliage or terrain meshes. Matched capital GPU texture count is 12 against 10. New runtime imagery is two 512px images plus a 330px terrain-height data texture; an old roof bitmap is optimized out by its replaced shader.

All 21,354 channel cross sections have valid UV/tangent/bank attributes. Maximum absolute dot product between cross-channel geometry and flow tangent is 0.000087. Curved-river capture verifies visible ripple orientation through a bend. The 30-day simulation fingerprint exactly matches `2fd9998`; full states are in both history JSON files. No simulation RNG was consumed by materials.

`test-results.txt`: 72 focused tests pass. The temporary paused fixtures are removed after recording results. The production page keeps its normal animation loop.

The comparison remains evidence of an adaptation, not pixel identity: the reference has brighter ripple highlights and less regular bank silhouettes. Current assets, palette, placement and joins are visible in the saved captures. Physical devices, GPU timing, long soaks and deployed behavior are not established by these checks.
