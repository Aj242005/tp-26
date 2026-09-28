import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { connections, type StageId, type TrailStage } from './trail-model';

export type SceneCommand = { action: 'reset' | 'in' | 'out'; tick: number };
export type SceneProps = { stages: TrailStage[]; selected: StageId; onSelect: (id: StageId) => void; onUnavailable: () => void; command: SceneCommand };
const positions: Record<StageId, [number, number, number]> = {
  snapshot: [-6, 0, 0], policy: [-2.8, 0, -3.1], normalize: [-3, 0, .3],
  evaluate: [0, 0, 0], report: [3.4, 0, -2.2], investigate: [3.2, 0, 2], review: [6.3, 0, 2],
};
const colors = { recorded: 0x89b8ff, attention: 0xe8b76c, active: 0x84ded2, pending: 0x61738e, optional: 0x61738e, failed: 0xf08999 };

/** A small, on-demand scene. No ambient render loop, remote assets or post-processing. */
export default function TrailScene({ stages, selected, onSelect, onUnavailable, command }: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<StageId, HTMLButtonElement>());
  const current = useRef({ stages, selected, onSelect, onUnavailable });
  current.current = { stages, selected, onSelect, onUnavailable };
  const controller = useRef<{ update: () => void; command: (action: SceneCommand['action']) => void } | null>(null);

  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { current.current.onUnavailable(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x0c1422, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.dataset.renderer = 'audit-pipeline';
    element.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-9, 9, 5, -5, .1, 90);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enableZoom = false; // Page scrolling remains native; explicit zoom controls are below.
    controls.minPolarAngle = .3;
    controls.maxPolarAngle = Math.PI / 2.25;
    controls.rotateSpeed = .65;
    controls.panSpeed = .7;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.PAN };
    const compact = () => element.clientWidth < 560;
    const reset = () => { camera.position.set(...(compact() ? [18, 24, 6] : [7.5, 12, 18]) as [number, number, number]); camera.zoom = 1; controls.target.set(.2, 0, -.1); camera.updateProjectionMatrix(); controls.update(); };
    reset();
    scene.add(new THREE.HemisphereLight(0xc5dcff, 0x263043, 2.6));
    const key = new THREE.DirectionalLight(0xe3efff, 3.5);
    key.position.set(-5, 11, 7); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 9, bottom: -9, near: 1, far: 35 });
    key.shadow.bias = -.001; key.shadow.normalBias = .04;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x749de3, 2.3); rim.position.set(6, 5, -8); scene.add(rim);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      geometries.add(geometry); materials.add(material);
      const item = new THREE.Mesh(geometry, material); item.position.set(x, y, z); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
    };
    const metal = (color: number, roughness = .4) => new THREE.MeshStandardMaterial({ color, metalness: .4, roughness });
    const board = mesh(new THREE.BoxGeometry(16.6, .16, 8.7), metal(0x152238, .8), scene, .1, -.49, -.25);
    const boardEdge = new THREE.LineSegments(new THREE.EdgesGeometry(board.geometry), new THREE.LineBasicMaterial({ color: 0x3b506d }));
    boardEdge.position.copy(board.position); scene.add(boardEdge); geometries.add(boardEdge.geometry); materials.add(boardEdge.material);

    const groups = new Map<StageId, { group: THREE.Group; accent: THREE.MeshStandardMaterial; trim: THREE.MeshStandardMaterial }>();
    const picks: THREE.Object3D[] = [];
    for (const stage of current.current.stages) {
      const group = new THREE.Group(); group.position.set(...positions[stage.id]); group.userData.stage = stage.id; scene.add(group);
      const accent = metal(colors[stage.state], .3);
      const trim = metal(0x477099, .36);
      const dark = metal(0x26384f, .5);
      mesh(new THREE.CylinderGeometry(.86, .95, .2, 6), dark, group, 0, -.2, 0);
      mesh(new THREE.CylinderGeometry(.79, .79, .055, 6), trim, group, 0, -.073, 0);
      mesh(new THREE.CylinderGeometry(.75, .75, .1, 6), dark, group, 0, .005, 0);
      if (stage.id === 'snapshot') {
        for (let i = 0; i < 3; i++) {
          const plate = mesh(new THREE.BoxGeometry(.95, .09, .77), i === 2 ? accent : dark, group, -.05 * i, .22 + i * .16, 0); plate.rotation.y = -.16 + i * .13;
        }
        for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(.54, .018, .028), dark, group, -.12, .593, -.19 + i * .15);
      } else if (stage.id === 'policy') {
        const shape = new THREE.Shape(); shape.moveTo(-.46, .82); shape.lineTo(.46, .82); shape.lineTo(.4, .27); shape.quadraticCurveTo(.22, -.05, 0, -.18); shape.quadraticCurveTo(-.22, -.05, -.4, .27); shape.closePath();
        const shield = mesh(new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, steps: 1 }), accent, group, 0, .34, -.06); shield.rotation.y = .25;
        for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(.35 - i * .06, .035, .04), dark, group, .06, .97 - i * .18, .1);
      } else if (stage.id === 'normalize') {
        for (let i = 0; i < 3; i++) {
          const height = .4 + i * .24;
          mesh(new THREE.BoxGeometry(.2, height, .4), accent, group, -.34 + i * .34, .13 + height / 2, 0);
          mesh(new THREE.BoxGeometry(.22, .055, .42), trim, group, -.34 + i * .34, .13 + height, 0);
        }
      } else if (stage.id === 'evaluate') {
        const core = mesh(new THREE.OctahedronGeometry(.57), accent, group, 0, .76, 0); core.rotation.y = Math.PI / 4;
        const ring = mesh(new THREE.TorusGeometry(.56, .025, 8, 40), trim, group, 0, .23, 0); ring.rotation.x = Math.PI / 2;
      } else if (stage.id === 'report') {
        mesh(new THREE.BoxGeometry(.74, .98, .12), accent, group, 0, .66, 0);
        for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(i === 0 ? .29 : .48, .035, .02), dark, group, i === 0 ? -.095 : 0, .94 - i * .16, .073);
      } else if (stage.id === 'investigate') {
        mesh(new THREE.IcosahedronGeometry(.26, 1), accent, group, 0, .68, 0);
        for (let i = 0; i < 3; i++) { const orbit = mesh(new THREE.TorusGeometry(.51, .022, 7, 48), accent, group, 0, .68, 0); orbit.rotation.set(i * .9 + .4, i * 1.1, .25); }
      } else {
        for (const x of [-.36, .36]) mesh(new THREE.BoxGeometry(.15, .88, .28), accent, group, x, .54, 0);
        mesh(new THREE.BoxGeometry(.9, .16, .3), accent, group, 0, 1.02, 0);
        for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(.055, .5, .09), dark, group, -.2 + i * .2, .5, 0);
      }
      group.traverse(item => { if (item instanceof THREE.Mesh) picks.push(item); });
      groups.set(stage.id, { group, accent, trim });
    }
    const paths: { from: StageId; to: StageId; solid: THREE.Mesh; dashed: THREE.Line; arrow: THREE.Mesh }[] = [];
    for (const [from, to] of connections) {
      const a = new THREE.Vector3(...positions[from]); a.y = -.28;
      const b = new THREE.Vector3(...positions[to]); b.y = -.28;
      const mid = a.clone().lerp(b, .5); mid.y = -.19;
      const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, .5), mid, mid.clone().lerp(b, .5), b]);
      const solid = mesh(new THREE.TubeGeometry(curve, 32, .035, 6, false), metal(0x577da7, .48), scene);
      const dashedMaterial = new THREE.LineDashedMaterial({ color: 0x60738e, dashSize: .14, gapSize: .12 }); materials.add(dashedMaterial);
      const dashedGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)); geometries.add(dashedGeometry);
      const dashed = new THREE.Line(dashedGeometry, dashedMaterial); dashed.computeLineDistances(); scene.add(dashed);
      const arrow = mesh(new THREE.ConeGeometry(.085, .22, 8), metal(0x7e9dbd), scene); arrow.position.copy(curve.getPoint(.66)); arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(.66));
      paths.push({ from, to, solid, dashed, arrow });
    }

    let visible = true;
    let width = 1, height = 1;
    const render = () => {
      if (!visible || document.hidden) return;
      renderer.render(scene, camera);
      for (const [id, label] of labels.current) {
        const point = new THREE.Vector3(...positions[id]); point.y = -.05; point.z += .5; point.project(camera);
        const x = (point.x + 1) * width / 2, y = (-point.y + 1) * height / 2 + (compact() ? 23 : 33);
        label.style.left = `${x}px`; label.style.top = `${y}px`;
        label.style.visibility = x < 35 || x > width - 35 || y < 15 || y > height - 22 ? 'hidden' : 'visible';
      }
    };
    let selectionFrame = 0;
    let previousSelection: StageId | null = null;
    const update = () => {
      cancelAnimationFrame(selectionFrame);
      const animate = previousSelection !== null && previousSelection !== current.current.selected && visible && !document.hidden && document.documentElement.dataset.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      previousSelection = current.current.selected;
      const from = new Map([...groups].map(([id, item]) => [id, item.group.position.y]));
      for (const stage of current.current.stages) {
        const item = groups.get(stage.id)!;
        const selected = current.current.selected === stage.id;
        item.accent.color.setHex(colors[stage.state]);
        item.accent.emissive.setHex(selected ? colors[stage.state] : 0x000000);
        item.accent.emissiveIntensity = selected ? .18 : 0;
        item.trim.color.setHex(selected ? 0xc1ddff : colors[stage.state]);
        if (!animate) item.group.position.y = selected ? .16 : 0;
      }
      for (const path of paths) {
        const to = current.current.stages.find(stage => stage.id === path.to)!;
        const missing = ['optional', 'pending'].includes(to.state);
        const highlighted = path.to === current.current.selected || path.from === current.current.selected;
        path.solid.visible = !missing; path.dashed.visible = missing;
        (path.solid.material as THREE.MeshStandardMaterial).color.setHex(highlighted ? 0xb3d6ff : 0x4f7096);
        (path.arrow.material as THREE.MeshStandardMaterial).color.setHex(highlighted ? 0xc8e2ff : missing ? 0x53637c : 0x7395bd);
      }
      if (animate) {
        const started = performance.now();
        const step = (time: number) => {
          const progress = visible && !document.hidden ? Math.min(1, (time - started) / 220) : 1;
          const eased = 1 - (1 - progress) ** 3;
          groups.forEach((item, id) => { const target = id === current.current.selected ? .16 : 0; item.group.position.y = from.get(id)! + (target - from.get(id)!) * eased; });
          render();
          if (progress < 1) selectionFrame = requestAnimationFrame(step);
        };
        selectionFrame = requestAnimationFrame(step);
      } else render();
    };
    const resize = () => {
      width = element.clientWidth; height = element.clientHeight;
      if (!width || !height) return;
      const isCompact = compact();
      if (element.dataset.compact !== String(isCompact)) reset();
      element.dataset.compact = String(isCompact);
      const halfHeight = isCompact ? Math.max(7.8, 5.1 / (width / height)) : Math.max(4.65, 9 / (width / height));
      camera.left = -halfHeight * width / height; camera.right = -camera.left; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
      renderer.setSize(width, height); render();
    };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(element);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) render(); }); intersection.observe(element);
    const raycaster = new THREE.Raycaster(); let downX = 0, downY = 0;
    const pointerDown = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY; };
    const pointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5 || event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      let item: THREE.Object3D | null = raycaster.intersectObjects(picks, false)[0]?.object ?? null;
      while (item && !item.userData.stage) item = item.parent;
      if (item) current.current.onSelect(item.userData.stage);
    };
    const contextLost = (event: Event) => { event.preventDefault(); current.current.onUnavailable(); };
    controls.addEventListener('change', render);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', render);
    controller.current = { update, command(action) { if (action === 'reset') reset(); else { camera.zoom = THREE.MathUtils.clamp(camera.zoom * (action === 'in' ? 1.2 : 1 / 1.2), .6, 2); camera.updateProjectionMatrix(); } render(); } };
    resize(); update();
    element.dataset.ready = 'true';
    return () => {
      cancelAnimationFrame(selectionFrame);
      controller.current = null; delete element.dataset.ready;
      resizeObserver.disconnect(); intersection.disconnect(); controls.dispose();
      document.removeEventListener('visibilitychange', render);
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); key.shadow.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, []);
  useEffect(() => { controller.current?.update(); }, [stages, selected]);
  useEffect(() => { if (command.tick) controller.current?.command(command.action); }, [command]);

  return <div ref={host} className="trail-canvas" aria-label="Spatial audit pipeline"><div className="trail-node-labels">{stages.map((stage, index) => <button key={stage.id} ref={node => { if (node) labels.current.set(stage.id, node); else labels.current.delete(stage.id); }} className={`trail-node-label ${stage.state} ${selected === stage.id ? 'selected' : ''}`} aria-label={`${stage.title}: ${stage.status}`} title={`${stage.title}: ${stage.status}`} aria-pressed={selected === stage.id} onClick={() => onSelect(stage.id)}><span className="trail-node-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className="trail-node-name">{String(index + 1).padStart(2, '0')} / {stage.short}</span><small>{stage.status}</small></button>)}</div></div>;
}
