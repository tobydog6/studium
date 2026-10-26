// Engine entry: bundled by build.mjs with esbuild into the single HTML file.
// three 0.180 + Spark 2 (World Labs): splats with level of detail, so big scans stay within a per-frame budget.
import * as THREE from 'three';
import { SparkRenderer, SplatMesh, PackedSplats, dyno } from '@sparkjsdev/spark';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
window.THREE = THREE;
window.GLTFLoader = GLTFLoader; window.RoomEnvironment = RoomEnvironment;   /* the lighting kit's stands and fixtures (assets/kit/lightkit.glb, made in Blender by tools/build_kit.py) */
window.Spark = { SparkRenderer, SplatMesh, PackedSplats, dyno };
