(function(global){
    const Meteor = {};
    let renderer, camera, meshRoot, target, Config;

    let impactMarker=null, impactPoint=null, meteor=null;
    let fragments=[], meteorLaunched=false;
    // === NOVO: suporte a modelo do projeto Particulas ===
    let _meteorTextureLoadState = 0;  // 0=none 1=loading 2=ready
    let _meteorTextures = null;

    // ---- CAUDA (fallback por meshes) ----
    let tailGroup = null;
    let tailParticles = [];
    let tailNextIndex = 0;
    let tailEmitAccumulator = 0;

    // ---- FLAME (aura em volta da bola) ----
    let flameGroup = null;
    let flameParticles = [];   // { mesh, life, maxLife, velocity, startScale }
    let flameEmitAccumulator = 0;
    let flameNextIndex = 0;

    // --------------------------------
    let isDragging=false, prevX=0, prevY=0, dragMoved=0;
    const ROT_X_MIN=-Math.PI*0.48, ROT_X_MAX=Math.PI*0.48;

    let lastBackwardAxis = { x:0, y:0, z: -1 };

    // ============ INIT ============
    Meteor.init=function(opts){
        renderer=opts.renderer;
        camera=opts.camera;
        meshRoot=opts.meshRoot;
        target=opts.target;
        Config=opts.Config||global.Config;
        if(!renderer||!camera||!meshRoot) return;

        renderer.domElement.style.cursor="grab";
        renderer.domElement.addEventListener('mousedown',onMouseDown);
        window.addEventListener('mousemove',onMouseMove);
        window.addEventListener('mouseup',onMouseUp);
        document.addEventListener('keydown',onKeyDown);
    };

    // ============ UPDATE ============
    Meteor.update=function(delta){
        // meteoro rot
        if(meteor){
            meteor.rotation.y+=0.7*delta;
            meteor.rotation.x+=0.35*delta;
        }

        // mover meteoro
        if(meteor && meteor.userData.state==='falling'){
            const v=meteor.userData.velocity;
            meteor.position.x+=v.x*delta;
            meteor.position.y+=v.y*delta;
            meteor.position.z+=v.z*delta;

            // ATUALIZA eixo para trás com base na velocidade atual
            {
                const len = Math.hypot(v.x,v.y,v.z)||1;
                lastBackwardAxis.x = -v.x/len;
                lastBackwardAxis.y = -v.y/len;
                lastBackwardAxis.z = -v.z/len;
            }

            // emitir cauda após mover (usa posição atual)
            if (Config.meteorTailEnabled) emitTail(delta);
            if (Config.meteorFlameEnabled) emitFlame(delta);

            const tgt=meteor.userData.target;
            const dx=meteor.position.x-tgt.x;
            const dy=meteor.position.y-tgt.y;
            const dz=meteor.position.z-tgt.z;
            if(Math.hypot(dx,dy,dz) < (Config.meteorRadius||1.2)+0.6){
                meteor.userData.state='impact';
                emitImpactEvent();          // <--- Dispara agora
                createFragments(tgt);
                setTimeout(()=>{ if(meteor){ meshRoot.remove(meteor); meteor=null; }},120);
            }
        }

        // atualizar cauda
        if (Config.meteorTailEnabled) updateTail(delta);
        if (Config.meteorFlameEnabled) updateFlame(delta);

        // fragmentos (gravitacionais simples)
        const G=Config.fragmentGravity||0;
        const falloff=Config.fragmentGravityFalloff||2;
        const drag=Config.fragmentDrag||0;
        const reentryR=Config.fragmentReentryRadius||50.8;
        const reentryR2=reentryR*reentryR;
        const despawnR=Config.fragmentDespawnRadius||130;
        const despawnR2=despawnR*despawnR;

        for(let i=fragments.length-1;i>=0;i--){
            const f=fragments[i], v=f.userData.velocity, p=f.position;
            if(G>0){
                const r2=p.x*p.x+p.y*p.y+p.z*p.z;
                const r=Math.sqrt(r2);
                if(r>0){
                    const invR=1/r;
                    const aMag=G/Math.pow(r,falloff);
                    v.x-=p.x*invR*aMag*delta;
                    v.y-=p.y*invR*aMag*delta;
                    v.z-=p.z*invR*aMag*delta;
                    if(r2<=reentryR2){
                        meshRoot.remove(f);
                        fragments.splice(i,1);
                        continue;
                    }
                }
            }
            if(drag>0){
                const d=Math.max(0,1-drag*delta);
                v.x*=d; v.y*=d; v.z*=d;
            }
            p.x+=v.x*delta;
            p.y+=v.y*delta;
            p.z+=v.z*delta;
            if(p.x*p.x+p.y*p.y+p.z*p.z > despawnR2){
                meshRoot.remove(f);
                fragments.splice(i,1);
            }
        }

        if(meteorLaunched && !meteor && fragments.length===0){
            meteorLaunched=false;
            setTimeout(()=>{ if(impactMarker){ meshRoot.remove(impactMarker); impactMarker=null; }},300);
            impactPoint=null;
            if (tailGroup){
                meshRoot.remove(tailGroup);
                tailGroup=null;
                tailParticles.length=0;
            }
            if (flameGroup){ if (meteor && flameGroup.parent===meteor) meteor.remove(flameGroup);
                             else meshRoot.remove(flameGroup);
                             flameGroup=null; flameParticles.length=0; }
        }
    };

    // ======= Input handlers (como antes) =======
    function onKeyDown(e){ if(e.code==='Space') launchMeteor(); }
    function onMouseDown(e){ if(e.button!==0) return; isDragging=true; dragMoved=0; prevX=e.clientX; prevY=e.clientY; renderer.domElement.style.cursor='grabbing'; }
    function onMouseMove(e){
        if(!isDragging) return;
        const dx=e.clientX-prevX, dy=e.clientY-prevY;
        meshRoot.rotation.y+=dx*0.005;
        meshRoot.rotation.x+=dy*0.005;
        if(meshRoot.rotation.x<ROT_X_MIN) meshRoot.rotation.x=ROT_X_MIN;
        if(meshRoot.rotation.x>ROT_X_MAX) meshRoot.rotation.x=ROT_X_MAX;
        prevX=e.clientX; prevY=e.clientY;
        dragMoved+=Math.abs(dx)+Math.abs(dy);
    }
    function onMouseUp(e){
        if(!isDragging) return;
        isDragging=false;
        renderer.domElement.style.cursor='grab';
        if(dragMoved<6 && !meteorLaunched){
            const world=screenToGlobe(e.clientX,e.clientY);
            if(world) setImpactPointWorld(world);
        }
    }

    // ======= Picking =======
    function screenToGlobe(px,py){
        if(!renderer||!camera) return null;
        const rect=renderer.domElement.getBoundingClientRect();
        const ndcX=((px-rect.left)/rect.width)*2-1;
        const ndcY=-((py-rect.top)/rect.height)*2+1;
        const forward=new XG.Vector3().sub(target,camera.position);
        let fl=Math.hypot(forward.x,forward.y,forward.z)||1;
        forward.x/=fl; forward.y/=fl; forward.z/=fl;
        const upWorld=new XG.Vector3(0,1,0);
        const right=new XG.Vector3().cross(forward,upWorld);
        let rl=Math.hypot(right.x,right.y,right.z)||1; right.x/=rl; right.y/=rl; right.z/=rl;
        const up=new XG.Vector3().cross(right,forward);
        let ul=Math.hypot(up.x,up.y,up.z)||1; up.x/=ul; up.y/=ul; up.z/=ul;
        const fovRad=camera.fov*Math.PI/180;
        const halfH=Math.tan(fovRad/2), halfW=halfH*camera.aspect;
        const dir=new XG.Vector3(
            forward.x+right.x*ndcX*halfW+up.x*ndcY*halfH,
            forward.y+right.y*ndcX*halfW+up.y*ndcY*halfH,
            forward.z+right.z*ndcX*halfW+up.z*ndcY*halfH);
        const dl=Math.hypot(dir.x,dir.y,dir.z)||1; dir.x/=dl; dir.y/=dl; dir.z/=dl;
        const o=camera.position.clone();
        const R=50;
        const b=2*(o.x*dir.x+o.y*dir.y+o.z*dir.z);
        const oo=o.x*o.x+o.y*o.y+o.z*o.z;
        const c=oo-R*R;
        const disc=b*b-4*c;
        if(disc<0) return null;
        const sd=Math.sqrt(disc);
        let t=(-b - sd)/2;
        if(t<0) t=(-b + sd)/2;
        if(t<0) return null;
        return new XG.Vector3(o.x+dir.x*t,o.y+dir.y*t,o.z+dir.z*t);
    }

    function setImpactPointWorld(worldPos){
        const local=worldPos.clone();
        if(meshRoot.worldToLocal) meshRoot.worldToLocal(local);
        impactPoint=local;
        if(impactMarker) meshRoot.remove(impactMarker);
        const geo=new XG.SphereGeometry(1.2,16,12);
        const mat=new XG.PhongMaterial({color:0xff2222,transparent:true,opacity:0.85});
        impactMarker=new XG.Mesh(geo,mat);
        impactMarker.position.copy(local);
        meshRoot.add(impactMarker);

        // NOVO: latitude igual, longitude com sinal invertido
        const r = Math.hypot(local.x,local.y,local.z) || 1;
        const lat = Math.asin(local.y/r) * 180/Math.PI;
        const lon = -Math.atan2(local.z, local.x) * 180/Math.PI;

        window.dispatchEvent(new CustomEvent('MeteorTargetChanged', {
            detail: { lat, lon, r, local: {x:local.x,y:local.y,z:local.z} }
        }));
    }

    // ==== SUBSTITUI createMeteorMesh pelo modelo do Particulas (somente modelo) ====
    // ==== SAFE LOADER (evita ReferenceError quando THREE não existe) ====
    function loadMeteorTextures(cb){
        if(_meteorTextureLoadState === 2){ cb && cb(); return; }
        if(_meteorTextureLoadState === 1){ return; }
        _meteorTextureLoadState = 1;

        const Loader =
          (typeof XG !== 'undefined' && XG.TextureLoader) ? XG.TextureLoader :
          (typeof THREE !== 'undefined' && THREE.TextureLoader) ? THREE.TextureLoader :
          null;

        if(!Loader){
            // Sem loader disponível: cancela silenciosamente
            _meteorTextureLoadState = 0;
            cb && cb();
            return;
        }
        const loader = new Loader();
        let loaded = 0;
        const total = 4;
        function done(){
            loaded++;
            if(loaded >= total){
                _meteorTextureLoadState = 2;
                _meteorTextures = tex;
                cb && cb();
            }
        }
        const tex = {
            diffuse: loader.load("texture_pbr_20250901.png", done, undefined, done),
            normal:  loader.load("texture_pbr_20250901_normal.png", done, undefined, done),
            rough:   loader.load("texture_pbr_20250901_roughness.png", done, undefined, done),
            metal:   loader.load("texture_pbr_20250901_metallic.png", done, undefined, done)
        };
    }

    function createRealisticAsteroidGeometry(radius, detail){
        const Geo =
          (typeof XG !== 'undefined' && XG.SphereGeometry) ? XG.SphereGeometry :
          (typeof THREE !== 'undefined' && THREE.SphereGeometry) ? THREE.SphereGeometry :
          null;

        if(!Geo){
            console.warn('[Meteor] Nenhuma SphereGeometry disponível (XG / THREE ausentes).');
            // Fallback mínimo: retorna objeto “geometry-like” vazio
            return {
                attributes:{ position:{ array:new Float32Array(0), needsUpdate:false } },
                computeVertexNormals(){},
            };
        }

        const geometry = new Geo(radius, detail, Math.max(8, Math.floor(detail/2)));
        const posAttr = geometry.attributes.position;
        const verts = posAttr.array;

        function pseudo( x,y,z,f ){ return Math.sin(x*f)*Math.sin(y*f)*Math.sin(z*f); }
        function applyNoise(freq, amp){
            for(let i=0;i<verts.length;i+=3){
                const x=verts[i], y=verts[i+1], z=verts[i+2];
                let d = pseudo(x,y,z,freq);
                d += 0.5*pseudo(y*2.1,z*2.1,x*2.1,freq);
                d *= amp;
                const len = Math.hypot(x,y,z)||1;
                verts[i]   += (x/len)*d;
                verts[i+1] += (y/len)*d;
                verts[i+2] += (z/len)*d;
            }
        }
        function addCrater(center, r, depth){
            const r2 = r*r;
            for(let i=0;i<verts.length;i+=3){
                const px=verts[i], py=verts[i+1], pz=verts[i+2];
                const dx=px-center.x, dy=py-center.y, dz=pz-center.z;
                const dist2 = dx*dx+dy*dy+dz*dz;
                if(dist2 < r2){
                    const fall = 1 - dist2/r2;
                    const smooth = fall*fall*(3-2*fall);
                    const len = Math.hypot(px,py,pz)||1;
                    const nx=px/len, ny=py/len, nz=pz/len;
                    verts[i]   -= nx*depth*smooth;
                    verts[i+1] -= ny*depth*smooth;
                    verts[i+2] -= nz*depth*smooth;
                }
            }
        }
        applyNoise(1.2, radius*0.15);
        applyNoise(2.5, radius*0.05);
        for(let c=0;c<12;c++){
            const theta=Math.random()*Math.PI*2;
            const phi=Math.acos(Math.random()*2-1);
            const cx=radius*Math.sin(phi)*Math.cos(theta);
            const cy=radius*Math.sin(phi)*Math.sin(theta);
            const cz=radius*Math.cos(phi);
            const cr=radius*(Math.random()*0.22+0.10);
            const cd=cr*(Math.random()*0.5+0.25);
            addCrater({x:cx,y:cy,z:cz}, cr, cd);
        }
        if (posAttr) posAttr.needsUpdate = true;
        geometry.computeVertexNormals && geometry.computeVertexNormals();
        return geometry;
    }

    function createMeteorMesh(radius){
        loadMeteorTextures(()=>{
            if(meteor && _meteorTextures){
                const Mat =
                  (typeof XG !== 'undefined' && (XG.MeshPhongMaterial || XG.PhongMaterial)) ? (XG.MeshPhongMaterial||XG.PhongMaterial) :
                  (typeof THREE !== 'undefined' && THREE.MeshPhongMaterial) ? THREE.MeshPhongMaterial :
                  null;
                if(Mat){
                    meteor.material = new Mat({
                        color: 0xffffff,
                        map: _meteorTextures.diffuse || null,
                        normalMap: _meteorTextures.normal || null,
                        shininess: 30,
                        emissive: 0xffaa00,
                        emissiveIntensity: 0.12
                    });
                    meteor.material.needsUpdate = true;
                }
            }
        });

        const MeshCls =
          (typeof XG !== 'undefined' && XG.Mesh) ? XG.Mesh :
          (typeof THREE !== 'undefined' && THREE.Mesh) ? THREE.Mesh :
          null;

        const MatBase =
          (typeof XG !== 'undefined' && (XG.MeshPhongMaterial || XG.PhongMaterial)) ? (XG.MeshPhongMaterial||XG.PhongMaterial) :
          (typeof THREE !== 'undefined' && THREE.MeshPhongMaterial) ? THREE.MeshPhongMaterial :
          null;

        if(!MeshCls){
            console.error('[Meteor] Nenhuma classe Mesh disponível (XG/THREE ausentes).');
            return null;
        }

        const geo = createRealisticAsteroidGeometry(radius, 48);
        const mat = MatBase ? new MatBase({
            color: 0x888888,
            emissive: 0xffaa00,
            emissiveIntensity: 0.10,
            shininess: 20,
            flatShading: false
        }) : undefined;

        const mesh = new MeshCls(geo, mat);
        mesh.userData = mesh.userData || {};
        mesh.userData.visualRadius = radius;
        return mesh;
    }

    // === NOVO: atualizar raio a partir do diâmetro em metros (preview ao vivo) ===
    Meteor.updateRadiusFromDiameter = function(diamM){
        if(!Config) Config = global.Config || {};
        const minDiam = 50;
        const maxDiam = 5000;
        const minR = 0.4;   // raio mínimo em unidades de cena
        const maxR = 8.0;   // raio máximo em unidades de cena
        const t = Math.max(0, Math.min(1, (diamM - minDiam) / (maxDiam - minDiam)));
        const rUnits = minR + (maxR - minR) * t;
        Config.meteorRadius = rUnits;

        // Se meteoro já existe, apenas escala (não recria partículas / efeitos)
        if (meteor){
            const currentVisual = meteor.userData.visualRadius || 1;
            const scale = rUnits / currentVisual;
            meteor.scale.multiplyScalar(scale);
            meteor.userData.visualRadius = rUnits;
        }
        return rUnits;
    };

    function launchMeteor(){
        if(!impactPoint || meteorLaunched) return;
        meteor=createMeteorMesh((Config.meteorRadius||1.2)*1.3);
        const from=impactPoint.clone().normalize().multiplyScalar(95);
        meteor.position.copy(from);
        const dir=new XG.Vector3().sub(impactPoint,from);
        let dl=Math.hypot(dir.x,dir.y,dir.z)||1;
        dir.x/=dl; dir.y/=dl; dir.z/=dl;
        const speed=(Config.meteorSpeed||60)*3.2; // usa Config.meteorSpeed (UI aplica escala correta)
        dir.x*=speed; dir.y*=speed; dir.z*=speed;
        meteor.userData={velocity:dir,target:impactPoint.clone(),state:'falling'};
        meshRoot.add(meteor);
        meteorLaunched=true;
        // Mostra os resultados imediatamente no lançamento
        emitLaunchEvent();

        if (Config.meteorTailEnabled)   initTail();
        if (Config.meteorFlameEnabled)  initFlame();
    }

    function createFragments(center){
        fragments=[];
        const baseSize=Config.fragmentSize??0.12;
        const jitter=Config.fragmentSizeJitter??0.4;
        const seg=baseSize<0.5?8:10;
        const earthR=50;
        const spawnOffset=Config.fragmentSpawnOffset??3;
        const spawnR=earthR+spawnOffset;
        const coneDeg=Config.fragmentConeAngleDeg??40;
        const coneRad=coneDeg*Math.PI/180;
        const cosMax=Math.cos(coneRad);
        const lateral=Config.fragmentLateralSpread??3;
        const vMin=Config.fragmentSpeedMin??60;
        const vMax=Config.fragmentSpeedMax??120;
        const n=center.clone(); const nl=Math.hypot(n.x,n.y,n.z)||1; n.x/=nl;n.y/=nl;n.z/=nl;
        const base=(Math.abs(n.x)<0.9)?new XG.Vector3(1,0,0):new XG.Vector3(0,1,0);
        let t1=new XG.Vector3().cross(n,base); let t1l=Math.hypot(t1.x,t1.y,t1.z)||1; t1.x/=t1l;t1.y/=t1l;t1.z/=t1l;
        let t2=new XG.Vector3().cross(n,t1);   let t2l=Math.hypot(t2.x,t2.y,t2.z)||1; t2.x/=t2l;t2.y/=t2l;t2.z/=t2l;
        for(let i=0;i<Config.fragmentCount;i++){
            const s=baseSize*(0.8+jitter*Math.random());
            const geo=new XG.SphereGeometry(s,seg,seg);
            const mat=new XG.PhongMaterial({color:Config.fragmentColor});
            const frag=new XG.Mesh(geo,mat);
            const a=Math.random()*Math.PI*2;
            const r=lateral*Math.sqrt(Math.random());
            const offX=t1.x*r*Math.cos(a)+t2.x*r*Math.sin(a);
            const offY=t1.y*r*Math.cos(a)+t2.y*r*Math.sin(a);
            const offZ=t1.z*r*Math.cos(a)+t2.z*r*Math.sin(a);
            frag.position.set(n.x*spawnR+offX,n.y*spawnR+offY,n.z*spawnR+offZ);
            const u=Math.random();
            const cosT=cosMax+(1-cosMax)*u;
            const sinT=Math.sqrt(1-cosT*cosT);
            const phi=Math.random()*Math.PI*2;
            const dirX=n.x*cosT+(t1.x*Math.cos(phi)+t2.x*Math.sin(phi))*sinT;
            const dirY=n.y*cosT+(t1.y*Math.cos(phi)+t2.y*Math.sin(phi))*sinT;
            const dirZ=n.z*cosT+(t1.z*Math.cos(phi)+t2.z*Math.sin(phi))*sinT;
            const speed=vMin+(vMax-vMin)*Math.pow(Math.random(),0.55);
            frag.userData={velocity:new XG.Vector3(dirX*speed,dirY*speed,dirZ*speed)};
            meshRoot.add(frag);
            fragments.push(frag);
        }
    }

    // ---- Tail (meshes) ----
    function initTail(){
        if (tailGroup){
            meshRoot.remove(tailGroup);
        }
        tailGroup = (XG.Object3D)? new XG.Object3D() : new XG.Mesh();
        meshRoot.add(tailGroup);
        tailParticles.length = 0;
        tailNextIndex = 0;
        tailEmitAccumulator = 0;
        emitTail._colorCache = null;
    }

    // Utilitário: cria base ortonormal a partir do eixo backward
    function buildBasis(bx,by,bz){
        const aux = Math.abs(bx) < 0.8 ? new XG.Vector3(1,0,0) : new XG.Vector3(0,1,0);
        const t1 = new XG.Vector3().cross(new XG.Vector3(bx,by,bz), aux);
        let l1 = Math.hypot(t1.x,t1.y,t1.z)||1; t1.x/=l1; t1.y/=l1; t1.z/=l1;
        const t2 = new XG.Vector3().cross(new XG.Vector3(bx,by,bz), t1);
        let l2 = Math.hypot(t2.x,t2.y,t2.z)||1; t2.x/=l2; t2.y/=l2; t2.z/=l2;
        return {t1,t2};
    }

    function emitTail(dt){
        if (!meteor || !tailGroup || !Config.meteorTailEnabled) return;

        const rate       = Config.meteorTailEmitRate || 600;
        const lifeBase   = Config.meteorTailParticleLife || 1.0;
        const baseSpeed  = Config.meteorTailBaseSpeed || 14;
        const spread     = Config.meteorTailSpread || 0.1;
        const sizeBase   = Config.meteorTailParticleSize || 0.6;
        const maxParts   = Config.meteorTailMaxParticles || 1200;
        const fadeExp    = Config.meteorTailFadeExp || 1.4;
        const coneDeg    = Config.meteorTailConeDeg || 20;
        const coneRad    = coneDeg * Math.PI / 180;
        const cosMin     = Math.cos(coneRad);
        const lateralFactor = Config.meteorTailLateralFactor ?? 0.15;

        tailEmitAccumulator += rate * dt;
        let toEmit = Math.floor(tailEmitAccumulator);
        if (toEmit <= 0) return;
        tailEmitAccumulator -= toEmit;

        // Base axis (já atualizado em update)
        const bx = lastBackwardAxis.x, by = lastBackwardAxis.y, bz = lastBackwardAxis.z;

        // Ortonormal base
        const aux = Math.abs(bx) < 0.8 ? new XG.Vector3(1,0,0) : new XG.Vector3(0,1,0);
        const t1 = new XG.Vector3().cross(new XG.Vector3(bx,by,bz), aux);
        let l1 = Math.hypot(t1.x,t1.y,t1.z)||1; t1.x/=l1; t1.y/=l1; t1.z/=l1;
        const t2 = new XG.Vector3().cross(new XG.Vector3(bx,by,bz), t1);
        let l2 = Math.hypot(t2.x,t2.y,t2.z)||1; t2.x/=l2; t2.y/=l2; t2.z/=l2;

        while (toEmit-- > 0){
            if (tailParticles.length < maxParts){
                const geom = new XG.SphereGeometry(sizeBase*0.45, 5, 4);
                const mat  = new XG.PhongMaterial({
                    color: Config.meteorTailColorStart||0xffffff,
                    transparent: true,
                    opacity: Config.meteorTailOpacity||0.6,
                    shininess: 6
                });
                const mesh = new XG.Mesh(geom, mat);
                tailGroup.add(mesh);
                tailParticles.push({
                    mesh,
                    life:0,
                    maxLife:0,
                    velocity:new XG.Vector3(),
                    fadeExp,
                    startScale:1
                });
            }
            const idx = tailNextIndex % maxParts;
            tailNextIndex++;
            const p = tailParticles[idx];
            const mesh = p.mesh;
            if (!mesh) continue;

            // posição inicial: centro do meteoro + pequeno recuo para trás
            const backShift = (Config.meteorTailBackShift ?? 0.08);  // <--- novo
            mesh.position.set(
                meteor.position.x + lastBackwardAxis.x * backShift,
                meteor.position.y + lastBackwardAxis.y * backShift,
                meteor.position.z + lastBackwardAxis.z * backShift
            );

            // direção dentro de cone estreito
            const u = Math.random();
            const cosTheta = cosMin + (1 - cosMin)*u;
            const sinTheta = Math.sqrt(1 - cosTheta*cosTheta);
            const phi = Math.random()*Math.PI*2;
            let dirX = bx*cosTheta + (t1.x*Math.cos(phi)+t2.x*Math.sin(phi))*sinTheta;
            let dirY = by*cosTheta + (t1.y*Math.cos(phi)+t2.y*Math.sin(phi))*sinTheta;
            let dirZ = bz*cosTheta + (t1.z*Math.cos(phi)+t2.z*Math.sin(phi))*sinTheta;

            // força colimação inicial: reduz componente lateral imediatamente
            const latScale = lateralFactor;
            // decompõe v em axial + lateral, atenua lateral
            const dotAx = dirX*bx + dirY*by + dirZ*bz;
            let axX = bx*dotAx, axY = by*dotAx, axZ = bz*dotAx;
            let latX = dirX - axX, latY = dirY - axY, latZ = dirZ - axZ;
            dirX = axX + latX * latScale;
            dirY = axY + latY * latScale;
            dirZ = axZ + latZ * latScale;

            const dLen = Math.hypot(dirX,dirY,dirZ)||1;
            dirX/=dLen; dirY/=dLen; dirZ/=dLen;

            const speed = baseSpeed * (0.8 + Math.random()*0.4);
            p.velocity.set(dirX*speed, dirY*speed, dirZ*speed);

            const life = lifeBase * (0.8 + Math.random()*0.4);
            p.life = life;
            p.maxLife = life;
            p.fadeExp = fadeExp;

            const sc = (0.55 + Math.random()*0.5) * sizeBase;
            p.startScale = sc;
            mesh.scale.set(sc,sc,sc);

            if (mesh.material){
                mesh.visible = true;
                mesh.material.opacity = Config.meteorTailOpacity || 0.6;
                mesh.material.color.setHex(Config.meteorTailColorStart||0xffffff);
            }
        }

        if (!emitTail._colorCache){
            const cs=Config.meteorTailColorStart||0xffffff;
            const ce=Config.meteorTailColorEnd||0x223355;
            emitTail._colorCache={
                sr:(cs>>16)&255, sg:(cs>>8)&255, sb:cs&255,
                er:(ce>>16)&255, eg:(ce>>8)&255, eb:ce&255
            };
        }
    }

    // SUBSTITUIR updateTail ANTIGA:
    function updateTail(dt){
        if (!tailGroup || !Config.meteorTailEnabled) return;
        const cache=emitTail._colorCache;
        if(!cache) return;
        const {sr,sg,sb,er,eg,eb}=cache;
        const globalOpacity = Config.meteorTailOpacity || 0.6;

        const drift = Config.meteorTailDrift || 0.4;
        const damp  = 0.95; // maior damp lateral
        const collim = Math.min(1, Math.max(0, Config.meteorTailCollimation ?? 0.8));

        // backward eixo atual
        const bx = lastBackwardAxis.x, by = lastBackwardAxis.y, bz = lastBackwardAxis.z;

        for (let i=0;i<tailParticles.length;i++){
            const p=tailParticles[i];
            if(p.life<=0){ if(p.mesh) p.mesh.visible=false; continue; }
            p.life-=dt;
            if(p.life<=0){ if(p.mesh) p.mesh.visible=false; continue; }

            // Ruído mínimo (controlado)
            p.velocity.x += (Math.random()*2-1)*drift*dt;
            p.velocity.y += (Math.random()*2-1)*drift*dt;
            p.velocity.z += (Math.random()*2-1)*drift*dt;

            // Damp geral
            p.velocity.x *= (1 - damp*dt);
            p.velocity.y *= (1 - damp*dt);
            p.velocity.z *= (1 - damp*dt);

            // Colima: mistura direção atual com eixo para trás
            if (collim > 0){
                const v = p.velocity;
                const len = Math.hypot(v.x,v.y,v.z)||1;
                let nx=v.x/len, ny=v.y/len, nz=v.z/len
                nx = nx*(1-collim) + bx*collim;
                ny = ny*(1-collim) + by*collim;
                nz = nz*(1-collim) + bz*collim;
                const l2=Math.hypot(nx,ny,nz)||1;
                nx/=l2; ny/=l2; nz/=l2;
                const speed = len; // conserva módulo
                v.x = nx*speed; v.y = ny*speed; v.z = nz*speed;
            }

            const m=p.mesh;
            if(m){
                m.position.x += p.velocity.x*dt;
                m.position.y += p.velocity.y*dt;
                m.position.z += p.velocity.z*dt;

                const t = 1 - (p.life/p.maxLife);
                const rr=(sr+(er-sr)*t)/255;
                const gg=(sg+(eg-sg)*t)/255;
                const bb=(sb+(eb-sb)*t)/255;
                if (m.material){
                    m.material.color.setRGB(rr,gg,bb);
                    m.material.opacity = Math.pow(1 - t, p.fadeExp||1.3)*globalOpacity;
                }
                const s = p.startScale * Math.pow(1 - t, 0.55);
                m.scale.set(s,s,s);
                m.visible=true;
            }
        }
    }

    // ====== FLAME (aura) – novas funções ======
    function initFlame(){
        // flame fica como FILHO do meteoro para sempre centralizar
        if (!meteor) return;
        if (flameGroup && flameGroup.parent) flameGroup.parent.remove(flameGroup);
        flameGroup = (XG.Object3D)? new XG.Object3D() : new XG.Mesh();
        meteor.add(flameGroup);
        flameParticles.length = 0;
        flameEmitAccumulator = 0;
        flameNextIndex = 0;
    }

    // Helper: eixo "para trás" em coordenadas locais do meteoro
    function getLocalBackwardAxis(){
        const bx = lastBackwardAxis.x, by = lastBackwardAxis.y, bz = lastBackwardAxis.z;
        if (!meteor || !meteor.worldToLocal || !meteor.localToWorld){
            return { x: bx, y: by, z: bz };
        }
        const w0 = meteor.localToWorld(new XG.Vector3(0,0,0));
        const w1 = new XG.Vector3(w0.x + bx, w0.y + by, w0.z + bz);
        const l0 = meteor.worldToLocal(w0.clone());
        const l1 = meteor.worldToLocal(w1.clone());
        let lx = l1.x - l0.x, ly = l1.y - l0.y, lz = l1.z - l0.z;
        const len = Math.hypot(lx,ly,lz)||1; lx/=len; ly/=len; lz/=len;
        return { x: lx, y: ly, z: lz };
    }

    function emitFlame(dt){
        if (!meteor || !flameGroup) return;

        const rate      = Config.meteorFlameEmitRate || 500;
        const lifeBase  = Config.meteorFlameParticleLife || 0.5;
        const sizeBase  = Config.meteorFlameParticleSize || 0.45;
        const inner     = Config.meteorFlameInnerOffset || 0.05;
        const thick     = Config.meteorFlameThickness || 0.2;
        const expand    = Config.meteorFlameExpansionSpeed || 10;
        const maxParts  = Math.max(64, (rate*lifeBase*1.2)|0);
        const opacity   = Config.meteorFlameOpacity ?? 0.85;

        const rSurf = (meteor.userData && meteor.userData.visualRadius) || (Config.meteorRadius||1.2);

        flameEmitAccumulator += rate * dt;
        let toEmit = Math.floor(flameEmitAccumulator);
        if (toEmit<=0) return;
        flameEmitAccumulator -= toEmit;

        while (toEmit-- > 0){
            if (flameParticles.length < maxParts){
                const geom = new XG.SphereGeometry(sizeBase*0.5, 5, 4);
                const mat  = new XG.PhongMaterial({
                    color: Config.meteorFlameColorStart || 0xffe08a,
                    transparent: true,
                    opacity,
                    shininess: 20
                });
                // blend aditivo quando existir
                if (XG.AdditiveBlending) mat.blending = XG.AdditiveBlending;
                const m = new XG.Mesh(geom, mat);
                flameGroup.add(m);
                flameParticles.push({
                    mesh: m,
                    life: 0,
                    maxLife: 0,
                    velocity: new XG.Vector3(),
                    startScale: 1
                });
            }

            const idx = flameNextIndex % maxParts;
            flameNextIndex++;
            const p = flameParticles[idx];
            const m = p.mesh;
            if (!m) continue;

            // direção normal aleatória (unit vector)
            let nx = Math.random()*2-1, ny=Math.random()*2-1, nz = Math.random()*2-1;
            let nl = Math.hypot(nx,ny,nz)||1; nx/=nl; ny/=nl; nz/=nl;

            // posição: casca ao redor + leve recuo para trás (no espaço local)
            const r0 = rSurf + inner + Math.random()*thick;
            const backShift = (Config.meteorFlameBackShift ?? 0.03); // <--- novo
            const lb = getLocalBackwardAxis();                       // local axis
            m.position.set(
                nx*r0 + lb.x*backShift,
                ny*r0 + lb.y*backShift,
                nz*r0 + lb.z*backShift
            );

            // velocidade: radial + leve ruído
            const spd = expand * (0.75 + Math.random()*0.5);
            const jx = (Math.random()*2-1)*0.6;
            const jy = (Math.random()*2-1)*0.6;
            const jz = (Math.random()*2-1)*0.6;
            p.velocity.set(nx*spd + jx, ny*spd + jy, nz*spd + jz);

            const life = lifeBase * (0.8 + Math.random()*0.5);
            p.life = life;
            p.maxLife = life;

            const sc = 0.8 + Math.random()*0.6;
            p.startScale = sc;
            m.scale.set(sc,sc,sc);

            // reset aparência
            if (m.material){
                m.material.opacity = opacity;
                m.material.color.setHex(Config.meteorFlameColorStart || 0xffe08a);
            }
            m.visible = true;
        }

        if (!emitFlame._colorCache){
            const cs = Config.meteorFlameColorStart || 0xffe08a;
            const ce = Config.meteorFlameColorEnd   || 0xff4c22;
            emitFlame._colorCache = {
                sr:(cs>>16)&255, sg:(cs>>8)&255, sb:cs&255,
                er:(ce>>16)&255, eg:(ce>>8)&255, eb:ce&255
            };
        }
    }

    function updateFlame(dt){
        if (!flameGroup) return;
        const cache = emitFlame._colorCache;
        const drift = Config.meteorFlameDrift || 1.0;
        const fadeExp = Config.meteorFlameFadeExp || 1.1;
        const baseOpacity = Config.meteorFlameOpacity ?? 0.85;

        if (!cache) return;
        const { sr,sg,sb, er,eg,eb } = cache;

        for (let i=0;i<flameParticles.length;i++){
            const p = flameParticles[i];
            if (p.life <= 0){ if(p.mesh) p.mesh.visible=false; continue; }
            p.life -= dt;
            if (p.life <= 0){ if(p.mesh) p.mesh.visible=false; continue; }

            // turbulência leve e amortecimento
            p.velocity.x += (Math.random()*2-1)*drift*dt;
            p.velocity.y += (Math.random()*2-1)*drift*dt;
            p.velocity.z += (Math.random()*2-1)*drift*dt;

            // atualiza posição no espaço local do meteoro
            const m = p.mesh;
            m.position.x += p.velocity.x*dt;
            m.position.y += p.velocity.y*dt;
            m.position.z += p.velocity.z*dt;

            const t = 1 - (p.life/p.maxLife); // 0..1
            const rr=(sr+(er-sr)*t)/255;
            const gg=(sg+(eg-sg)*t)/255;
            const bb=(sb+(eb-sb)*t)/255;
            if (m.material){
                m.material.color.setRGB(rr,gg,bb);
                m.material.opacity = Math.pow(1 - t, fadeExp) * baseOpacity;
            }
            const s = p.startScale * (1 + t*0.6); // cresce um pouco
            m.scale.set(s,s,s);
            m.visible = true;
        }
    }

    // Helpers para lat/lon e eventos da UI
    function _toLatLon(v){
  const r = Math.hypot(v.x, v.y, v.z) || 1;
  return { lat: Math.asin(v.y/r) * 180/Math.PI, lon: -Math.atan2(v.z, v.x) * 180/Math.PI };
}
// Alias para compatibilidade (explode usa toLatLon)
function toLatLon(v){ return _toLatLon(v); }

    function emitLaunchEvent(){
      const p = impactPoint || (meteor && meteor.position) || new XG.Vector3(0,1,0).multiplyScalar(50);
      const ll = _toLatLon(p);
      const diamEl = document.getElementById('ui-diam');
      const speedEl = document.getElementById('ui-speed');
      const densEl  = document.getElementById('ui-density');
      const detail = {
        lat: ll.lat,
        lon: ll.lon,
        diamM: (window.Config?.metaDiameterM) ?? (diamEl ? parseFloat(diamEl.value) : 100),
        speedKmps: (window.Config?.metaSpeedKmps) ?? (window.Config?.kmps) ?? (speedEl ? parseFloat(speedEl.value) : 20),
        densityKgM3: (window.Config?.metaDensityKgM3) ?? (densEl ? parseFloat(densEl.value) : 3000)
      };
      if (window.DEBUG_IMPACT) console.log('[Meteor] emit MeteorLaunch', detail);
      window.dispatchEvent(new CustomEvent('MeteorLaunch', { detail }));
    }

    function emitImpactEvent(extra){
        try{
            if(meteor && meteor.userData && meteor.userData._impactEventSent) return;
            let lat=0, lon=0;
            if(impactPoint){
                const r = Math.hypot(impactPoint.x,impactPoint.y,impactPoint.z) || 1;
                lat = Math.asin(impactPoint.y / r) * 180/Math.PI;
                lon = -Math.atan2(impactPoint.z, impactPoint.x) * 180/Math.PI;
            }
            // Inputs (fallback) / Config possíveis
            const diamEl  = document.getElementById('ui-diam');
            const speedEl = document.getElementById('ui-speed');
            const densEl  = document.getElementById('ui-density');

            const diamM = extra?.diamM ??
                (Config && (Config.meteorDiameterM||Config.diameterM)) ??
                (diamEl ? parseFloat(diamEl.value) : 100);

            const speedKmps = extra?.speedKmps ??
                (Config && (Config.meteorSpeedKmps||Config.speedKmps||Config.meteorSpeed)) ??
                (speedEl ? parseFloat(speedEl.value) : 20);

            const densityKgM3 = extra?.densityKgM3 ??
                (Config && (Config.meteorDensityKgM3||Config.densityKgM3)) ??
                (densEl ? parseFloat(densEl.value) : 3000);

            window.dispatchEvent(new CustomEvent('MeteorImpact',{
                detail:{ lat, lon, diamM, speedKmps, densityKgM3 }
            }));

            if(meteor && meteor.userData) meteor.userData._impactEventSent = true;
            // Debug opcional
            console.log('[Meteor] Impact event dispatched', {lat,lon,diamM:safeRound(diamM),speedKmps,densityKgM3});
        }catch(err){
            console.warn('emitImpactEvent error', err);
        }
        function safeRound(v){ return Math.round((v||0)*100)/100; }
    }

    function explode(){
      if (!meteor) return;

      // Emite evento com os parâmetros usados no lançamento
      try {
        const ll = impactPoint ? toLatLon(impactPoint) : {lat:0,lon:0};
        const detail = {
          lat: ll.lat,
          lon: ll.lon,
          diamM: (Config && Config.metaDiameterM) || 100,
          speedKmps: (Config && (Config.metaSpeedKmps || Config.kmps || Config.meteorSpeed)) || 20,
          densityKgM3: (Config && Config.metaDensityKgM3) || 3000
        };
        if (window.DEBUG_IMPACT) console.log('[Meteor] emit MeteorImpact', detail);
        window.dispatchEvent(new CustomEvent('MeteorImpact', { detail }));
      } catch(e) { console.warn('MeteorImpact dispatch failed', e); }

      // remove meteoro e cria efeitos
      meshRoot.remove(meteor);
      meteor = null;
      meteorLaunched = false;
      // ...existing code de ring/fragmentos...
    }

    global.Meteor=Meteor;
    // NOVO: expõe APIs úteis à UI
    Meteor.launch = function(){ launchMeteor(); };
    Meteor.getTarget = function(){ return impactPoint ? {x:impactPoint.x,y:impactPoint.y,z:impactPoint.z} : null; };
})(window);