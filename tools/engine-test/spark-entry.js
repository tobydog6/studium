// Spark 2 (World Labs) on three 0.180, with or without its level-of-detail
import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
window.ENG_SPARK = { label: 'Spark 2.3.1', async start(host, bytes, ext, flip, lod) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(60, host.clientWidth / host.clientHeight, 0.05, 1000), scene = new THREE.Scene();
  const spark = new SparkRenderer({ renderer }); scene.add(spark);
  const mesh = new SplatMesh({ fileBytes: bytes.slice(0), fileType: ext, lod: !!lod });
  if (flip) mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  scene.add(mesh); await mesh.initialized;
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  let box = null; try { const b = mesh.getBoundingBox(); b.applyMatrix4(mesh.matrixWorld.compose(mesh.position, mesh.quaternion, mesh.scale)); box = { min: b.min.toArray(), max: b.max.toArray() }; } catch (e) {}
  return { THREE, camera, controls, box, count: mesh.numSplats || (mesh.packedSplats && mesh.packedSplats.numSplats) || 0,
    resize(w, h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    frame() { controls.update(); renderer.render(scene, camera); },
    dispose() { scene.remove(mesh); try { mesh.dispose(); } catch (e) {} renderer.dispose(); renderer.domElement.remove(); } };
} };
