# Remaster texture assets

These photographic PBR surfaces and HDR environment originate from [Poly Haven](https://polyhaven.com/). They are free, public-domain **CC0 1.0** assets, not proprietary BBE or Rockstar assets. Source assets retain that dedication after optimization.

- [Poly Haven asset license](https://polyhaven.com/license)
- [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
- Powered by Poly Haven. Assets are vendored for offline runtime use; the game makes no request to their API.

The adjacent `manifest.json` records each author, official asset page, exact download URL, original MD5 and SHA-256, runtime SHA-256, image dimensions, processing steps and suggested material parameters. The source directory additionally retains original downloaded files, provider metadata and reproducible preparation scripts.

| Runtime key | Official asset | Artist(s) | Typical use |
|---|---|---|---|
| asphalt | [Asphalt 02](https://polyhaven.com/a/asphalt_02) | Rob Tuytel | Road surfaces; 3 m repeat |
| pavement | [Concrete Pavement](https://polyhaven.com/a/concrete_pavement) | Charlotte Baglioni | Sidewalks; 1.8 m repeat |
| plaster | [White Plaster 02](https://polyhaven.com/a/white_plaster_02) | Rob Tuytel | Painted interior/exterior walls; 1 m repeat |
| oak | [Oak Wood Planks](https://polyhaven.com/a/oak_wood_planks) | Dimitrios Savva | Flooring and wood furniture; 1.2 m repeat |
| fabric | [Denim Fabric 03](https://polyhaven.com/a/denim_fabric_03) | colormass, Rico Cilliers | Tintable woven upholstery; 0.3 m repeat |
| metal | [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) | Rob Tuytel | Neutral painted metal, scratches and seams; 2.5 m repeat |
| stone | [White Sandstone Blocks 02](https://polyhaven.com/a/white_sandstone_blocks_02) | Rob Tuytel | Light sandstone facade plinths; 2 m repeat |
| bark | [Bark Platanus](https://polyhaven.com/a/bark_platanus) | Dimitrios Savva | City tree trunks and branches; 1.5 m repeat |
| grass | [Grass Ground](https://polyhaven.com/a/grass_ground) | Charlotte Baglioni | Lawn/soil; 2.51 m repeat |
| leaf | [Island Tree 01](https://polyhaven.com/a/island_tree_01) | Rob Tuytel, Rico Cilliers | Isolated photographed leaf with alpha; stem bottom, tip top |
| sky-day | [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | Greg Zaal, Jarod Guest | Scene-linear daytime HDR illumination/reflections |

## Runtime use

Albedo maps are sRGB. Normal and roughness maps are **linear**, not sRGB. Normals follow OpenGL +Y. All maps of a material need identical repeat/rotation. Normal maps were renormalized after downsampling and stored losslessly. Roughness is replicated across RGB (Three.js reads green). Fabric and painted-metal albedos have deliberately been desaturated and normalized for tinting; their photographed micro-detail is retained.

Albedos are 1024 square, except bark and grass at 512. Normal/roughness maps are 512. Leaf images are 256 x 512, intended for a 0.5 aspect-ratio card; use the albedo's alpha with alphaTest around 0.38 and DoubleSide rather than translucent sorting. The leaf is extracted from the clean second leaf in the top row of the official photographic atlas; no hand-drawn replacement.

`sky-day-1k.hdr` is an unmodified 1024 x 512 Radiance RGBE file. Use an RGBE loader and PMREM prefiltering. Reduce environment intensity at night and do not use a daylight panorama as a night background. No additional point lights are needed for material detail.

Diffuse texture colors already contain the measured surface color. Use near-white material tint for faithful reproduction; multiplying asphalt by a near-black existing procedural color will make it unnecessarily dark.
