import JSZip from "jszip";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

const PREVIEW_SIZE = 256;
const SUPPORTED_EXTS = new Set([".stl", ".obj", ".3mf"]);

export function isPreviewableFileName(name: string) {
  return SUPPORTED_EXTS.has(getExtension(name));
}

export function getExtension(name: string) {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx).toLowerCase();
}

export function toArrayBuffer(data: ArrayBuffer | Uint8Array | null) {
  if (!data) return null;
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return null;
}

export async function generatePreviewDataUrl(fileName: string, data: ArrayBuffer) {
  const ext = getExtension(fileName);
  try {
    if (ext === ".3mf") {
      const thumb = await extract3mfThumbnail(data);
      if (thumb) return thumb;
      return await render3mf(data);
    }
    if (ext === ".stl") {
      return await renderStl(data);
    }
    if (ext === ".obj") {
      return await renderObj(data);
    }
  } catch (error) {
    console.warn("Preview generation failed:", error);
  }
  return null;
}

async function extract3mfThumbnail(data: ArrayBuffer) {
  const zip = await JSZip.loadAsync(data);
  const candidates = zip.file(/metadata\/thumbnail\.(png|jpe?g)$/i);
  if (!candidates || candidates.length === 0) return null;
  const entry = candidates[0];
  const blob = await entry.async("blob");
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function render3mf(data: ArrayBuffer) {
  const loader = new ThreeMFLoader();
  const object = loader.parse(data);
  return renderObjectToDataUrl(object);
}

async function renderStl(data: ArrayBuffer) {
  const loader = new STLLoader();
  const geometry = loader.parse(data);
  const material = new MeshStandardMaterial({
    color: new Color(0x8aa7ff),
    metalness: 0.1,
    roughness: 0.75
  });
  const mesh = new Mesh(geometry, material);
  return renderObjectToDataUrl(mesh);
}

async function renderObj(data: ArrayBuffer) {
  const text = new TextDecoder("utf-8").decode(data);
  const loader = new OBJLoader();
  const group = loader.parse(text);
  const material = new MeshStandardMaterial({
    color: new Color(0x8aa7ff),
    metalness: 0.1,
    roughness: 0.75
  });
  group.traverse((node) => {
    if (!(node as Mesh).isMesh) return;
    (node as Mesh).material = material;
  });
  return renderObjectToDataUrl(group);
}

function renderObjectToDataUrl(object: Object3D) {
  const scene = new Scene();
  scene.background = null;
  scene.add(object);

  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return null;

  object.position.sub(center);

  const camera = new PerspectiveCamera(45, 1, 0.1, maxDim * 10);
  const distance = maxDim * 1.6;
  camera.position.set(distance, distance, distance);
  camera.lookAt(0, 0, 0);

  const ambient = new AmbientLight(0xffffff, 0.7);
  const directional = new DirectionalLight(0xffffff, 0.9);
  directional.position.set(1, 1, 1);
  scene.add(ambient, directional);

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });
  renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE, false);
  renderer.render(scene, camera);

  const dataUrl = canvas.toDataURL("image/png");
  renderer.dispose();

  return dataUrl;
}
