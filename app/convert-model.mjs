import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

// Polyfill for node
import { Blob } from 'buffer';
globalThis.Blob = Blob;

const ASSETS = path.resolve('./src/assets');
const FBX_PATH = path.join(ASSETS, 'lib61hgvnnk0-muschelman', 'muschelman.fbx');
const OBJ_PATH = path.join(ASSETS, 'n1kj5enhkuf4-Base_Mesh', 'Base Mesh sculpt 2.obj');
const OUT_GLB  = path.join(ASSETS, 'human-model.glb');

async function loadFBX() {
  console.log('Loading FBX from', FBX_PATH);
  const data = fs.readFileSync(FBX_PATH);
  const loader = new FBXLoader();
  const group = loader.parse(data.buffer, '');
  console.log('FBX loaded, children:', group.children.length);
  return group;
}

async function loadOBJ() {
  console.log('Loading OBJ from', OBJ_PATH);
  const data = fs.readFileSync(OBJ_PATH, 'utf-8');
  const loader = new OBJLoader();
  const group = loader.parse(data);
  console.log('OBJ loaded, children:', group.children.length);
  return group;
}

function normalizeModel(group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 3.6 / maxDim; // normalize to ~3.6 units tall

  group.position.sub(center);
  group.position.y += size.y * scale / 2; // put feet at y=0
  group.scale.multiplyScalar(scale);

  // Remove all materials - we'll use custom holographic shaders
  group.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    }
  });

  console.log(`Normalized: original size ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}, scale ${scale.toFixed(4)}`);
  return group;
}

async function exportGLB(scene) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        const buf = Buffer.from(result);
        fs.writeFileSync(OUT_GLB, buf);
        console.log(`Wrote ${OUT_GLB} (${(buf.length / 1024).toFixed(1)} KB)`);
        resolve();
      },
      (error) => reject(error),
      { binary: true }
    );
  });
}

async function main() {
  let model;
  try {
    model = await loadFBX();
    console.log('Using FBX muscleman model');
  } catch (e) {
    console.log('FBX failed:', e.message, '- trying OBJ...');
    try {
      model = await loadOBJ();
      console.log('Using OBJ base mesh model');
    } catch (e2) {
      console.error('Both models failed:', e2.message);
      process.exit(1);
    }
  }
  normalizeModel(model);
  await exportGLB(model);
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
