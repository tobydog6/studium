// Engine entry: bundled by build.mjs with esbuild into the single HTML file.
// three 0.180 + Spark 2 (World Labs): splats with level of detail, so big scans stay within a per-frame budget.
import * as THREE from 'three';
import { SparkRenderer, SplatMesh, dyno } from '@sparkjsdev/spark';
window.THREE = THREE;
window.Spark = { SparkRenderer, SplatMesh, dyno };
