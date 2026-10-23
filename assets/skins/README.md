# Bundled Bonk shape geometry

115 static Bonk shape vectors and centres, exported game artwork from the Bonkverse skin editor at commit `0b00e644aa0794f981f883332307cb1a33d5134c`:
https://github.com/Bonkverse/skin-editor/tree/0b00e644aa0794f981f883332307cb1a33d5134c/public/output_shapes

Shape artwork originates from Bonk.io. This bundle contains geometry, not renderer code. All assets are served by this site: no rendering requests go to Bonk Leagues, Bonkverse or GitHub. Only vector elements and attributes were retained; no scripts, images, event handlers or external URLs. Paints use currentColor. Local clip-path IDs are prefixed per shape. Shape 115 uses its viewBox centre; other centres use the exported bounds.

skin-renderer.js is this site's own bounded JSON/binary decoder and SVG renderer. User skin data supplies validated numbers and shape IDs, never SVG markup. Supported binary format: version 2. Ball radius: 15 skin units.
