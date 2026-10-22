// the engine Studium uses today: three 0.160 + GaussianSplats3D 0.4.7, set up exactly like Studium
import * as THREE from 'three';
import * as GS from '@mkkellogg/gaussian-splats-3d';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
window.ENG_GS = { label: 'Current · GaussianSplats3D 0.4.7', async start(host, bytes, ext, flip) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(60, host.clientWidth / host.clientHeight, 0.05, 1000), scene = new THREE.Scene();
  const viewer = new GS.Viewer({ selfDrivenMode: false, useBuiltInControls: false, renderer, camera, threeScene: scene, sharedMemoryForWorkers: false });
  const fmt = ext === 'ply' ? GS.SceneFormat.Ply : ext === 'ksplat' ? GS.SceneFormat.KSplat : GS.SceneFormat.Splat;
  if (ext === 'spz') throw new Error('The current engine cannot open .spz files');
  const q = new THREE.Quaternion(); if (flip) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  const url = URL.createObjectURL(new Blob([bytes]));
  await viewer.addSplatScene(url, { format: fmt, rotation: [q.x, q.y, q.z, q.w], showLoadingUI: false, progressiveLoad: false, splatAlphaRemovalThreshold: 5 });
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  let box = null; try { const b = viewer.splatMesh.computeBoundingBox(true); box = { min: b.min.toArray(), max: b.max.toArray() }; } catch (e) {}
  return { THREE, camera, controls, box, count: viewer.splatMesh.getSplatCount(), resize(w, h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    frame() { controls.update(); viewer.update(); viewer.render(); },
    dispose() { try { viewer.dispose(); } catch (e) {} renderer.dispose(); renderer.domElement.remove(); URL.revokeObjectURL(url); } };
} };
