// Three.js r170 and the post-processing add-ons, loaded as minified ES modules from jsDelivr.
// The "+esm" builds of the add-ons import "/npm/three@0.170.0/+esm", the same URL as below,
// so the engine is downloaded only once. Every other file imports THREE from here,
// so the version is set in one place (and in the modulepreload of index.html).
export * from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
export { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js/+esm';
export { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/RenderPass.js/+esm';
export { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js/+esm';
export { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/OutputPass.js/+esm';
export { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/ShaderPass.js/+esm';
export { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/shaders/FXAAShader.js/+esm';
