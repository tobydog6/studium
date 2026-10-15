// Engine entry: bundled by build.mjs with esbuild into the single HTML file.
// Pinned versions (package.json) reproduce the original bundle byte-for-byte.
import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
window.THREE = THREE;
window.GaussianSplats3D = GaussianSplats3D;
