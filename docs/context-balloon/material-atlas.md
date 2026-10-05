# Miniature materials

Generated with built-in Image Gen using `texture-reference.png` as style/palette reference. Source: `material-atlas-source.png` (1254 × 1254 RGB PNG). Runtime: `../../assets/materials/miniature-atlas.png` (512 × 512 RGB PNG; 128 × 128 cells). Runtime packs each Lanczos-downsampled 124 × 124 cell inside a two-pixel wrap gutter; no mipmaps cross the cell borders. No hand-painted substitutes.

Indices count left to right, top to bottom. UV coordinates depend on renderer image orientation; this table describes the image itself.

| Index | Row | Column | Material |
| --- | --- | --- | --- |
| 0 | 0 | 0 | Moss grass, sparse cream/yellow wildflowers |
| 1 | 0 | 1 | Ploughed dark earth, vertical furrows |
| 2 | 0 | 2 | Grey-beige cobble, dark joints |
| 3 | 0 | 3 | Wet gravel/muddy shoreline |
| 4 | 1 | 0 | Off-white lime plaster |
| 5 | 1 | 1 | Beige limestone ashlar courses |
| 6 | 1 | 2 | Dark weathered wood, vertical grain |
| 7 | 1 | 3 | Packed brown dirt path |
| 8 | 2 | 0 | Golden thatch, vertical fibres |
| 9 | 2 | 1 | Burnt-orange clay tiles |
| 10 | 2 | 2 | Blue-charcoal slate shingles |
| 11 | 2 | 3 | Blue-green river ripples/foam |
| 12 | 3 | 0 | Ridged dark bark |
| 13 | 3 | 1 | Mottled deciduous foliage |
| 14 | 3 | 2 | Dark pine needles |
| 15 | 3 | 3 | Harvested crop stubble |

Inspection: all sixteen surfaces appear in the specified order, with no border, gaps, text, or scene geometry. Generated edges are visually repeatable but are not mathematically guaranteed seamless; shader sampling should avoid neighboring cells and may blend rotated repeats where needed.

## Generation prompt

Use case: stylized-concept
Asset type: runtime diffuse material texture atlas for a medieval miniature simulation game.
Primary request: Create ONE square 1024x1024 image containing exactly 4 columns and 4 rows of equal square material textures, no gaps or borders. Pixel boundaries exactly at 25%, 50%, 75% horizontally and vertically. Sixteen tiles fill the entire image edge to edge. Every tile is a flat top-down orthographic close-up of a repeating surface. This is a material atlas, never a scene or swatch presentation.
Input image 1: style and palette reference only. Match its tactile matte miniature materials; do not reproduce any buildings, scene, interface, perspective, captions, or sky.
Tile order left to right, top to bottom:
Row 1: (0) moss green short meadow grass with sparse tiny cream/yellow wildflowers; (1) dark earthy parallel ploughed furrows, furrows vertical; (2) pale grey-beige irregular cobble pavers, dark thin joints; (3) wet grey/tan gravel and muddy shoreline, gravel evenly distributed over entire tile.
Row 2: (4) chalky weathered off-white lime plaster, mottled small stains; (5) beige limestone ashlar horizontal staggered courses and thin darker mortar; (6) dark warm weathered wood planks, grain vertical; (7) packed brown dirt path with subtle fine grit.
Row 3: (8) golden straw thatch bundles, thin fibres vertical; (9) burnt-orange overlapping clay roof tiles in horizontal staggered rows; (10) blue-charcoal slate shingles, horizontal staggered courses; (11) blue-green river surface ripples, sparse pale foam streaks.
Row 4: (12) ridged dark brown bark, ridges vertical; (13) small mottled green deciduous leaf clusters evenly distributed; (14) dark green pine needles densely layered; (15) tawny harvested crop stubble, small broken stems over earth.
Composition: each tile independently seamless/repeating on both axes; approximate physical scale 2-4m per tile, water 12m. Medium-small surface details with visible contrast surviving downsampling to128px tile. Materials keep organic, varied surfaces.
Lighting: flat neutral ambient diffuse albedo; no directional shadows or baked specular highlights; no large gradients or vignettes.
Constraints: exactly sixteen equal squares, no margins, no separators, no bevels, no frames, no labels, no text, no watermark, no perspective, no props, no scene objects, no recognizable buildings, no depicted sphere/cube. Fully opaque. Deliver square PNG.

## Runtime selection

Cell 11 was rejected: its diagonal foam streaks competed with river direction. Water uses the separate quiet ripple image documented in `water-ripples.md`. Grass repeats over 8 metres; plaster and straw contrast are attenuated. Material means normalize detail without overriding seasonal colors. Buildings use local faces; parcel walls inherit their instance orientation; roads and rivers carry continuous path distance and tangents. Atlas sampling uses constant loop indices for WebGL1 compatibility.
