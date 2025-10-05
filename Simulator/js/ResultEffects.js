// Efeitos visuais temporários no globo ao passar o mouse sobre as seções do painel de resultados.
// Fail‑safe para diferentes engines (usa THREE se existir, senão tenta XG). Não altera fórmulas.
(function(global){
  const T = global.THREE || global.XG;
  if(!T){
    console.warn('ResultEffects: nem THREE nem XG encontrados. Efeitos desativados.');
    return;
  }

  const DEBUG = true; // coloque false para silenciar logs
  // --- Flag de suspensão de efeitos (ex: quando mouse sobre abas) ---
  let suspended = true;

  let EARTH_R_SCENE = 50; // poderá ser recalibrado ao detectar o mesh do globo
  const EARTH_R_KM = 6371;
  const INVERT_LON = false;

  // (ADDED) Disponibilidade de classes da engine
  const HAS = {
    Group: !!T.Group,
    Object3D: !!T.Object3D,
    Vector3: !!T.Vector3,
    RingGeometry: !!T.RingGeometry,
    CircleGeometry: !!T.CircleGeometry,
    SphereGeometry: !!T.SphereGeometry,
    CylinderGeometry: !!T.CylinderGeometry,
    Mesh: !!T.Mesh,
    MeshBasicMaterial: !!T.MeshBasicMaterial,
    AdditiveBlending: typeof T.AdditiveBlending !== 'undefined',
    DoubleSide: typeof T.DoubleSide !== 'undefined'
  };
  
  let scene=null;
  function getScene(){
    if(scene) return scene;
    scene = (global.TERRA && global.TERRA.scene) || global.scene || null;
    return scene;
  }

  // Achar nó do globo (opcional)
  let globeRoot=null;
  function findGlobeRoot(){
    const s=getScene();
    if(!s || !s.traverse) return null;
    if(globeRoot) return globeRoot;
    try{
      s.traverse(o=>{
        if(globeRoot) return;
        const name=(o.name||'').toLowerCase();
        if(/earth|globe|planet/.test(name)) globeRoot=o;
        else if(o.geometry && o.geometry.boundingSphere){
          const r=o.geometry.boundingSphere.radius;
          // heurística: maior esfera encontrada
          if(r>10 && r<500){
            if(!globeRoot || r > (globeRoot.geometry?.boundingSphere?.radius||0)){
              globeRoot=o;
            }
          }
        }
      });
    }catch(e){}
    if(globeRoot && globeRoot.geometry && globeRoot.geometry.boundingSphere){
      const r=globeRoot.geometry.boundingSphere.radius;
      if(Math.abs(r - EARTH_R_SCENE) > 0.5){
        if(DEBUG) console.log('[ResultEffects] Ajustando EARTH_R_SCENE de', EARTH_R_SCENE,'para', r);
        EARTH_R_SCENE = r;
      }
    }
    return globeRoot || s;
  }

  let lastImpact = { lat:0, lon:0, diamM:100, speedKmps:20, density:3000 };

  // ---------------- CONTAINER / ADIÇÃO ----------------
  // Se não houver Group/Object3D vamos adicionar diretamente ao scene.
  let useDirectAdd = (!HAS.Group && !HAS.Object3D);
  if(useDirectAdd && DEBUG) console.log('[ResultEffects] Usando adição direta (sem container).');

  function createContainer(){
    if(!useDirectAdd){
      if (HAS.Group) return new T.Group();
      if (HAS.Object3D) return new T.Object3D();
    }
    return null; // modo direto
  }

  const root = createContainer();
  if(root) root.name = 'ResultHoverEffectsRoot';

  function ensureRoot(){
    if(useDirectAdd) return; // não precisa
    const parent = findGlobeRoot() || getScene();
    if(!parent || !parent.add) return;
    if(!root.parent){
      parent.add(root);
      if(DEBUG) console.log('[ResultEffects] root anexado a', parent.name||parent.type||'scene');
    }
  }

  // Lista de meshes ativos quando em modo direto
  const activeMeshes = [];

  function attach(mesh){
    if(!mesh) return;
    mesh.renderOrder = 9999;
    const parent = (findGlobeRoot() || getScene());
    if(!parent || !parent.add){
      if(DEBUG) console.warn('[ResultEffects] Scene parent indisponível.');
      return;
    }
    if(useDirectAdd){
      parent.add(mesh);
      activeMeshes.push(mesh);
    } else {
      ensureRoot();
      root.add(mesh);
    }
    if(DEBUG) console.log('[ResultEffects] mesh adicionado', mesh.type, mesh.geometry?.type, '#mat', !!mesh.material);
  }

  // ================== MATERIAL / LINE FALLBACK ==================
  function findFallbackMaterialClass(){
    const prefer = ['LineBasicMaterial','MeshBasicMaterial','BasicMaterial'];
    for(const n of prefer){
      if(T[n]) return T[n];
    }
    for(const k in T){
      if(/Material$/.test(k) && typeof T[k]==='function') return T[k];
    }
    return null;
  }
  const FallbackMatClass = findFallbackMaterialClass();
  if(DEBUG) console.log('[ResultEffects] Material base =', FallbackMatClass && FallbackMatClass.name);

  function makeColor(color){
    if(T.Color) return new T.Color(color);
    return color;
  }

  function makeLineMaterial(color, opacity){
    if(!FallbackMatClass) return null;
    let params = {};
    // Tentar detectar se é LineBasicMaterial
    if(FallbackMatClass === T.LineBasicMaterial){
      params = { color, transparent:true, opacity };
    } else {
      params = { color, transparent:true, opacity };
    }
    let m;
    try{ m = new FallbackMatClass(params); }
    catch(e){
      m = new FallbackMatClass();
      if(m.color && m.color.set) m.color.set(color);
      m.transparent = true; m.opacity = opacity;
    }
    // atributos comuns
    m.transparent = true;
    m.opacity = opacity;
    if(m.depthWrite !== undefined) m.depthWrite = false;
    if(m.depthTest  !== undefined) m.depthTest  = false;
    return m;
  }

  // ================== RING LINE BUILDER ==================
  const HAS_BUFFER = !!(T.BufferGeometry);
  const HAS_LINE   = !!(T.Line || T.LineSegments);

  function buildRingLine(radiusScene, centerVec3, normalVec3, segments=96, color=0x23c463, opacity=0.8){
    if(!HAS_BUFFER || !HAS_LINE || !HAS.Vector3) return null;

    const geom = new T.BufferGeometry();
    const pts = new Float32Array((segments+1)*3);

    // base vectors ortogonais
    const n = normalVec3.clone().normalize();
    const ref = Math.abs(n.y) > 0.9 ? new T.Vector3(1,0,0) : new T.Vector3(0,1,0);
    const right = new T.Vector3().crossVectors(n, ref).normalize();
    const forward = new T.Vector3().crossVectors(right, n).normalize();

    for(let i=0;i<=segments;i++){
      const a = (i/segments)*Math.PI*2;
      const dir = right.clone().multiplyScalar(Math.cos(a)).add(forward.clone().multiplyScalar(Math.sin(a)));
      const p = centerVec3.clone().add(dir.multiplyScalar(radiusScene));
      pts[i*3] = p.x; pts[i*3+1]=p.y; pts[i*3+2]=p.z;
    }
    geom.setAttribute('position', new T.BufferAttribute ? new T.BufferAttribute(pts,3) :
      (T.Float32BufferAttribute ? new T.Float32BufferAttribute(pts,3) : null));

    const mat = makeLineMaterial(color, opacity) || makeLineMaterial(0xffffff, opacity);
    if(!mat) return null;

    const LineClass = T.Line || T.LineSegments;
    const line = new LineClass(geom, mat);
    line.userData._isEffect = true;
    return line;
  }

  // ============== FALLBACK DOM PULSE ==============
  let domLayer=null;
  function ensureDomLayer(){
    if(domLayer) return domLayer;
    domLayer = document.createElement('div');
    domLayer.id='impact-effect-layer';
    Object.assign(domLayer.style,{
      position:'fixed',left:0,top:0,width:'100%',height:'100%',
      pointerEvents:'none',zIndex:9999
    });
    document.body.appendChild(domLayer);
    // estilos
    if(!document.getElementById('impact-effect-style')){
      const st=document.createElement('style');
      st.id='impact-effect-style';
      st.textContent=`
        .impact-pulse{
          position:absolute;
          border-radius:50%;
          transform:translate(-50%,-50%);
          animation:impactPulse 1.8s cubic-bezier(.45,.04,.35,1) forwards;
          mix-blend-mode:screen;
          box-shadow:0 0 12px rgba(35,196,99,.8),0 0 48px 8px rgba(35,196,99,.45);
        }
        .impact-pulse.fireball{
          box-shadow:0 0 14px rgba(255,120,40,.85),0 0 60px 10px rgba(255,140,50,.55);
        }
        @keyframes impactPulse{
          0%{opacity:.0; transform:translate(-50%,-50%) scale(.2);}
          10%{opacity:.95;}
          60%{opacity:.55;}
          100%{opacity:0; transform:translate(-50%,-50%) scale(2.2);}
        }
      `;
      document.head.appendChild(st);
    }
    return domLayer;
  }

  function projectLatLon(lat,lon){
    // tenta achar câmera estilo THREE
    const cam = (global.TERRA && (global.TERRA.camera||global.TERRA.cam)) ||
                global.camera || (scene && scene.camera);
    if(!T.Vector3 || !cam || !cam.projectionMatrix){
      return { x: window.innerWidth/2, y: window.innerHeight/2, ok:false };
    }
    const v = latLonToVec3(lat,lon, EARTH_R_SCENE*1.01);
    // Se existir matrixWorldInverse / project:
    if(typeof v.project === 'function' && cam){
      try{
        v.project(cam);
        const x = (v.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
        return {x,y,ok:true};
      }catch(e){}
    }
    // fallback centro
    return { x: window.innerWidth/2, y: window.innerHeight/2, ok:false };
  }

  function spawnDomPulse(effect){
    const layer=ensureDomLayer();
    const p = projectLatLon(lastImpact.lat,lastImpact.lon);
    const div=document.createElement('div');
    const baseSize = 160; // px
    let color='rgba(35,196,99,0.85)';
    if(effect==='fireball') color='rgba(255,130,40,0.9)';
    if(effect==='shock') color='rgba(35,196,99,0.9)';
    if(effect==='wind') color='rgba(35,196,99,0.85)';
    if(effect==='quake') color='rgba(35,196,99,0.85)';
    div.className='impact-pulse '+effect;
    div.style.width=baseSize+'px';
    div.style.height=baseSize+'px';
    div.style.left=p.x+'px';
    div.style.top=p.y+'px';
    div.style.background=`radial-gradient(circle at 50% 50%, ${color} 0%, rgba(0,0,0,0) 70%)`;
    layer.appendChild(div);
    setTimeout(()=>div.remove(),1800);
    if(DEBUG && !p.ok) console.log('[ResultEffects] Pulse fallback sem projeção real.');
  }

  // ================== CLEAR / ATTACH ajustados ==================
  function clearEffects(){
    if(useDirectAdd){
      const parent = (findGlobeRoot() || getScene());
      if(parent && parent.remove){
        for(const m of activeMeshes) parent.remove(m);
      }
      activeMeshes.length=0;
      return;
    }
    if(root && root.children){
      for(let i=root.children.length-1;i>=0;i--){
        const c=root.children[i];
        root.remove(c);
      }
    }
  }

  function attach(obj){
    if(!obj) return;
    obj.renderOrder = 9999;
    const parent = (findGlobeRoot() || getScene());
    if(!parent || !parent.add) return;
    if(useDirectAdd){
      parent.add(obj);
      activeMeshes.push(obj);
    } else {
      ensureRoot();
      root.add(obj);
    }
    if(DEBUG) console.log('[ResultEffects] line anexada', obj.type, obj.geometry?.attributes?.position?.count);
  }

  // ================== EFEITOS (versão simplificada com linhas) ==================
  // Cada efeito cria apenas linhas animadas (consistência em engines limitadas).
  function effectCrater(){
    if(!HAS_LINE || !HAS_BUFFER){ spawnDomPulse('crater'); return; }
    const craterMi = estimateCraterMi(lastImpact.diamM,lastImpact.speedKmps,lastImpact.density);
    const rScene = Math.max(0.3, craterSceneRadius(craterMi));
    const center = latLonToVec3(lastImpact.lat,lastImpact.lon).multiplyScalar(1.003);
    const normal = center.clone().normalize();

    const ring = buildRingLine(rScene, center, normal, 96, 0x23c463, 0.0);
    const glow = buildRingLine(rScene*1.25, center, normal, 96, 0x43ff9a, 0.0);
    [ring,glow].forEach(attach);

    animators.push((dt,t)=>{
      if(ring && ring.material){
        ring.material.opacity = Math.min(0.85, ring.material.opacity + dt*2.2);
        ring.scale.setScalar(1 + 0.05*Math.sin(t*3));
      }
      if(glow && glow.material){
        glow.material.opacity = Math.min(0.5, glow.material.opacity + dt*1.6);
        glow.scale.setScalar(1 + 0.15*Math.sin(t*1.8));
      }
    });
  }

  function effectFireball(){
    if(!HAS_LINE || !HAS_BUFFER){ spawnDomPulse('fireball'); return; }
    const craterMi = estimateCraterMi(lastImpact.diamM,lastImpact.speedKmps,lastImpact.density);
    const rScene = Math.max(0.4, craterSceneRadius(craterMi)*0.9);
    const center = latLonToVec3(lastImpact.lat,lastImpact.lon).multiplyScalar(1.005);
    const n = center.clone().normalize();

    const inner = buildRingLine(rScene, center, n, 96, 0xff6d21, 0.0);
    const mid   = buildRingLine(rScene*1.35, center, n, 96, 0xffc040, 0.0);
    const outer = buildRingLine(rScene*1.7, center, n, 96, 0xfff3c0, 0.0);
    [inner,mid,outer].forEach(attach);

    animators.push((dt,t)=>{
      if(inner?.material) inner.material.opacity = Math.min(0.9, inner.material.opacity + dt*3);
      if(mid?.material)   mid.material.opacity   = Math.min(0.6, mid.material.opacity + dt*2.2);
      if(outer?.material) outer.material.opacity = Math.min(0.4, outer.material.opacity + dt*1.4);
      const pulse = 1+0.08*Math.sin(t*5);
      inner?.scale.setScalar(pulse);
      mid?.scale.setScalar(1+0.12*Math.sin(t*3));
      outer?.scale.setScalar(1+0.2*Math.sin(t*2));
    });
  }

  function effectShock(){
    if(!HAS_LINE || !HAS_BUFFER){ spawnDomPulse('shock'); return; }
    const craterMi = estimateCraterMi(lastImpact.diamM,lastImpact.speedKmps,lastImpact.density);
    const base = Math.max(0.35, craterSceneRadius(craterMi));
    const center = latLonToVec3(lastImpact.lat,lastImpact.lon).multiplyScalar(1.002);
    const n = center.clone().normalize();

    const rings = [];
    for(let i=0;i<3;i++){
      const r = buildRingLine(base*(0.9+i*0.15), center, n, 96, 0x23c463, 0.0);
      attach(r);
      rings.push({line:r, delay:i*0.3});
    }

    animators.push((dt,t)=>{
      rings.forEach(obj=>{
        if(!obj.line || !obj.line.material) return;
        const lt = t - obj.delay;
        if(lt<0) return;
        obj.line.material.opacity = Math.min(0.6, obj.line.material.opacity + dt*2);
        const grow = 1 + lt*4; // expansivo
        obj.line.scale.setScalar(grow);
        obj.line.material.opacity *= Math.max(0, 1 - lt*0.3);
      });
    });
  }

  function effectWind(){
    if(!HAS_LINE || !HAS_BUFFER){ spawnDomPulse('wind'); return; }
    const craterMi = estimateCraterMi(lastImpact.diamM,lastImpact.speedKmps,lastImpact.density);
    const base = Math.max(0.4, craterSceneRadius(craterMi)*1.1);
    const center = latLonToVec3(lastImpact.lat,lastImpact.lon).multiplyScalar(1.004);
    const n = center.clone().normalize();

    const rings=[];
    for(let i=0;i<3;i++){
      const r = buildRingLine(base*(1+i*0.35), center, n, 96, 0x23c463, 0.25);
      attach(r);
      rings.push(r);
    }

    animators.push((dt,t)=>{
      rings.forEach((r,idx)=>{
        if(!r || !r.material) return;
        r.rotation.z += 0.4*dt + idx*0.15*dt;
        r.material.opacity = 0.25 + 0.1*Math.sin(t*2 + idx);
      });
    });
  }

  function effectQuake(){
    if(!HAS_LINE || !HAS_BUFFER){ spawnDomPulse('quake'); return; }
    const center = latLonToVec3(lastImpact.lat,lastImpact.lon).multiplyScalar(1.001);
    const n = center.clone().normalize();
    const pulses=[];
    for(let i=0;i<4;i++){
      const ring = buildRingLine(0.2, center, n, 96, 0x23c463, 0.0);
      attach(ring);
      pulses.push({line:ring, delay:i*0.35});
    }
    animators.push((dt,t)=>{
      pulses.forEach(p=>{
        if(!p.line || !p.line.material) return;
        const lt = t - p.delay;
        if(lt<0) return;
        const scale = 1 + lt*6;
        p.line.scale.setScalar(scale);
        p.line.material.opacity = Math.max(0, 0.55 - lt*0.6);
      });
    });
  }

  // ---------- Helpers matemáticos e debug (faltavam) ----------
  function latLonToVec3(latDeg, lonDeg, r = EARTH_R_SCENE){
    if(!HAS.Vector3) return {x:0,y:0,z:0, clone(){return this;}, normalize(){return this;}, multiplyScalar(){return this;}};
    if(INVERT_LON) lonDeg = -lonDeg;
    const lat = latDeg * Math.PI / 180;
    const lon = lonDeg * Math.PI / 180;
    const y = Math.sin(lat);
    const cl = Math.cos(lat);
    const x = Math.cos(lon)*cl;
    const z = Math.sin(lon)*cl;
    return new T.Vector3(x,y,z).multiplyScalar(r);
  }

  // Estimativa simplificada só para dimensionar efeitos (não interfere nos cálculos reais do app)
  function estimateCraterMi(diamM, speedKmps, density){
    return 1.6
      * Math.pow(Math.max(diamM,1)/100,0.83)
      * Math.pow(Math.max(speedKmps,0.1)/20,0.44)
      * Math.pow(Math.max(density,1)/3000,1/3);
  }

  function craterSceneRadius(craterMi){
    const craterKm = craterMi * 1.60934;
    const halfArcKm = craterKm / 2;
    const theta = halfArcKm / EARTH_R_KM;
    return EARTH_R_SCENE * Math.sin(Math.min(Math.max(theta,0), Math.PI/2));
  }

  // Relatório de debug usado no setTimeout final e export
  function debugReport(){
    console.log('[ResultEffects] Report:', {
      classes: HAS,
      sceneFound: !!getScene(),
      globeRoot: globeRoot ? (globeRoot.name||globeRoot.type) : null,
      earthRadiusScene: EARTH_R_SCENE,
      lastImpact
    });
  }

  // Coloca marcador temporário no último impacto (ou lat/lon custom) para verificar posição
  function marker(lat = lastImpact.lat, lon = lastImpact.lon, color = 0x23c463){
    if(!HAS.Vector3) { console.warn('[ResultEffects] Sem Vector3 para marker'); return; }
    const pos = latLonToVec3(lat, lon).multiplyScalar(1.01);
    // Usa ring line mínimo
    const line = buildRingLine(EARTH_R_SCENE*0.05, pos, pos.clone().normalize(), 48, color, 0.9);
    if(!line){ console.warn('[ResultEffects] Marker sem geometria'); return; }
    attach(line);
    setTimeout(()=>{ stop(); }, 2000);
    if(DEBUG) console.log('[ResultEffects] marker em', lat, lon);
  }

  // ================== DISPATCH / LOOP (inalterado) ==================
  function spawn(effect){
    clearEffects();
    ensureRoot();
    if(suspended){
      if(DEBUG) console.log('[ResultEffects] spawn ignorado (suspenso)');
      return;
    }
    switch(effect){
      case 'crater': effectCrater(); break;
      case 'fireball': effectFireball(); break;
      case 'shock': effectShock(); break;
      case 'wind': effectWind(); break;
      case 'quake': effectQuake(); break;
      default: return;
    }
    startAnimation();
  }

  function stop(){ clearEffects(); }

  let animating=false;
  const animators=[];
  let startTime=0;

  function animate(){
    if(!animating) return;
    const now = performance.now()/1000;
    if(!animate._last) animate._last = now;
    const dt = Math.min(0.033, now - animate._last);
    animate._last = now;

    for(let i=animators.length-1;i>=0;i--){
      try{
        animators[i](dt, now - startTime);
      }catch(e){
        console.warn('[ResultEffects] animator error', e);
        animators.splice(i,1);
      }
    }

    // Condição de término depende do modo
    const empty = (useDirectAdd ? activeMeshes.length===0 : (!root || !root.children || root.children.length===0));
    if(empty){
      animators.length=0;
      animating=false;
      return;
    }
    requestAnimationFrame(animate);
  }

  function startAnimation(){
    if(animating) return;
    animating=true;
    startTime = performance.now()/1000;
    requestAnimationFrame(animate);
  }

  (function waitScene(){
    if(getScene()){ ensureRoot(); }
    else setTimeout(waitScene, 400);
  })();

  window.addEventListener('MeteorImpact', ev=>{
    const d=ev.detail||{};
    lastImpact.lat = d.lat||0;
    lastImpact.lon = d.lon||0;
    lastImpact.diamM = d.diamM||100;
    lastImpact.speedKmps = d.speedKmps||20;
    lastImpact.density = d.densityKgM3||3000;
  });

  window.addEventListener('ImpactEffectHover', ev=>{
    const {effect, active} = ev.detail||{};
    if(suspended){
      if(DEBUG && active) console.log('[ResultEffects] ImpactEffectHover ignorado (suspenso)');
      return;
    }
    if(active) spawn(effect); else stop();
  });

  // --- novos listeners adicionais ---
  window.addEventListener('MeteorTargetChanged', ev=>{
    const d=ev.detail||{};
    if(typeof d.lat === 'number') lastImpact.lat = d.lat;
    if(typeof d.lon === 'number') lastImpact.lon = d.lon;
    if(DEBUG) console.log('[ResultEffects] Target update', lastImpact.lat, lastImpact.lon);
  });

  // ================== Suspensão por hover em abas ==================
  function setSuspended(flag){
    if(flag === suspended) return;
    suspended = flag;
    if(suspended) stop();
    if(DEBUG) console.log('[ResultEffects] suspended =', suspended);
  }
  
  function bindTabHover(selector='.result-tabs, .tabs'){
    const els = document.querySelectorAll(selector);
    els.forEach(el=>{
      el.addEventListener('mouseenter', ()=>setSuspended(true));
      el.addEventListener('mouseleave', ()=>setSuspended(false));
    });
    if(DEBUG) console.log('[ResultEffects] bindTabHover em', els.length, 'elementos');
  }
  
  // Eventos globais para controle manual externo
  window.addEventListener('ResultEffectsSuspend', ()=>setSuspended(true));
  window.addEventListener('ResultEffectsResume', ()=>setSuspended(false));
  
  // Auto-bind após DOM pronto
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>bindTabHover());
  } else {
    setTimeout(()=>bindTabHover(),0);
  }

  // ---------------- Debug extras / API ----------------
  function scanMaterials(){
    const names=[];
    for(const k in T){
      if(/Material$/.test(k)) names.push(k);
    }
    console.log('[ResultEffects] Materiais disponíveis:', names);
    return names;
  }

  global.ResultEffects = {
    test(e='crater'){ spawn(e); setTimeout(stop, 4000); },
    force: spawn,
    stop,
    debugReport,
    marker,
    scanMaterials,
    // API nova:
    suspend: setSuspended,
    bindTabHover
  };

  if(DEBUG) setTimeout(()=>debugReport(), 2500);
  console.log('%cResultEffects ready (fallback aware)','background:#0d2e1c;color:#23c463;padding:2px 6px;');
})(window);