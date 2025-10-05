(function(global){
  const EARTH_R_M = 6371000;
  const EARTH_R_U = 50;
  const UPM = EARTH_R_U / EARTH_R_M;
  const J_PER_MEGATON = 4.184e15;

  const densities = {
    'Comet (ice/dust)': 600,
    'Rocky (chondrite)': 3000,
    'Iron (nickel-iron)': 7800
  };

  function el(html){
    const t=document.createElement('template');
    t.innerHTML=html.trim();
    return t.content.firstChild;
  }

  // ===== ESTILO (reduzido ~25% e movido para ESQUERDA) =====
  function ensureStyle(){
    if (document.getElementById('impact-ui-style2')) return;
    const style = el(`<style id="impact-ui-style2">
      #impact-ui{
        position:fixed;
        top:10px;
        left:10px;       /* antes right:10px */
        right:auto;
        width:320px;     /* antes 430px */
        font:11px/1.2 Arial, sans-serif; /* menor */
        color:#d0d0d0;
        z-index:1000;
        user-select:none;
        pointer-events:auto;
      }
      #impact-ui *{box-sizing:border-box;}
      .ui-section{margin:0 0 5px;background:#0a0a0a;border:1px solid #161616;position:relative;}
      .ui-section::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent,#2196f3);} /* barra mais fina */
      .ui-header{
        background:#050505;
        padding:5px 7px 5px 14px;
        cursor:pointer;
        font-weight:bold;
        display:flex;
        align-items:center;
        gap:6px;
        font-size:12px;
      }
      .ui-header .arrow{font-size:9px;color:#bbb;transition:transform .18s;}
      .ui-section.collapsed .ui-header .arrow{transform:rotate(-90deg);}
      .ui-body{padding:6px 10px 8px 12px;border-top:1px solid #161616;}
      .ui-section.collapsed .ui-body{display:none;}
      .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:3px;}
      .info-pill{background:#1d1d1d;border:1px solid #2a2a2a;padding:5px;font-size:10px;line-height:1.1;display:flex;flex-direction:column;gap:2px;min-height:40px;}
      .info-pill span.label{color:#9a9a9a;font-size:9px;text-transform:uppercase;letter-spacing:.4px;}
      .info-pill span.value{color:#33aef6;font-weight:600;font-variant-numeric:tabular-nums;font-size:11px;}
      .wide-pill{margin-top:5px;display:flex;justify-content:space-between;align-items:center;background:#1d1d1d;border:1px solid #2a2a2a;padding:5px 6px;font-size:11px;}
      .wide-pill span.val{color:#33aef6;font-weight:600;font-variant-numeric:tabular-nums;}
      .ui-row{
        display:flex;
        align-items:center;
        padding:5px 0;
        gap:8px;
        border-top:1px solid #151515;
      }
      .ui-row:first-child{border-top:none;}
      .ui-row label{
        flex:0 0 120px;          /* menor */
        font-size:11px;
        color:#d7d7d7;
      }
      .slider-wrap{flex:1;display:flex;align-items:center;}
      .slider-wrap input[type=range]{
        --percent:50%;
        -webkit-appearance:none;
        width:100%;
        height:22px;            /* antes 28 */
        margin:0;
        background:linear-gradient(to right,#33aef6 var(--percent),#262626 var(--percent));
        border:1px solid #2e2e2e;
        border-right:none;
        cursor:pointer;
      }
      .slider-wrap input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:0;height:0;}
      .slider-wrap input[type=range]::-moz-range-thumb{width:0;height:0;border:none;}
      .val-box{
        width:58px;             /* menor */
        background:#1d1d1d;
        border:1px solid #2e2e2e;
        text-align:center;
        color:#33aef6;
        font-variant-numeric:tabular-nums;
        padding:3px 4px;
        font-size:12px;
      }
      .select-row select{
        width:100%;
        background:#1d1d1d;
        border:1px solid #2e2e2e;
        color:#e0e0e0;
        padding:5px 5px;
        font-size:11px;
      }
      .select-row select:focus{outline:1px solid #33aef6;}
      .btn-bar{margin-top:6px;display:flex;gap:8px;}
      .btn{
        flex:1;
        background:#131313;
        border:1px solid #2d2d2d;
        padding:7px 8px;
        color:#e2e2e2;
        font-size:11px;
        cursor:pointer;
        text-align:center;
      }
      .btn:hover{background:#1b1b1b;}
      .btn:active{background:#101010;}
      .note{margin:6px 2px 0;font-size:10px;color:#808080;line-height:1.25;}
      .ui-section[data-accent="1"]{--accent:#33aef6;}
      .ui-section[data-accent="2"]{--accent:#c35bff;}
      .ui-section[data-accent="3"]{--accent:#ff8a3d;}
      .ui-section[data-accent="4"]{--accent:#58c26d;}
    </style>`);
    document.head.appendChild(style);
  }

  function formatMT(E){
    const mt = E / J_PER_MEGATON;
    if (mt < 0.01) return (mt*1000).toFixed(2)+' kt';
    return mt.toFixed(2)+' Mt';
  }

  // ===== BUILD UI =====
  function buildUI(){
    ensureStyle();
    const panel = el(`
      <div id="impact-ui">
      <div class="ui-section" data-accent="1">
        <div class="ui-header"><span class="arrow">▾</span> Target</div>
        <div class="ui-body">
        <div class="info-grid">
          <div class="info-pill"><span class="label">Latitude</span><span class="value" id="ui-lat">--</span></div>
          <div class="info-pill"><span class="label">Longitude</span><span class="value" id="ui-lon">--</span></div>
          <div class="info-pill"><span class="label">Area</span><span class="value" id="ui-area">--</span></div>
        </div>
        <div class="wide-pill"><span>Population / km²</span><span class="val" id="ui-pop">--</span></div>
        <div class="btn-bar" style="margin-top:8px;"><div class="btn" id="ui-clear">Clear Target</div></div>
        <div class="note">Click on the globe to set the impact point.</div>
        </div>
      </div>
      <div class="ui-section" data-accent="2">
        <div class="ui-header"><span class="arrow">▾</span> Parameters</div>
        <div class="ui-body">
        <div class="ui-row">
          <label>Diameter (m)</label>
          <div class="slider-wrap"><input id="ui-diam" type="range" min="50" max="1000" step="10" value="330"></div>
          <div class="val-box" id="ui-diam-val">100</div>
        </div>
        <div class="ui-row">
          <label>Velocity (km/s)</label>
          <div class="slider-wrap"><input id="ui-speed" type="range" min="1" max="40" step="0.1" value="18"></div>
          <div class="val-box" id="ui-speed-val">18.0</div>
        </div>
        <div class="ui-row select-row" style="padding-bottom:0;">
          <label>Density</label>
          <div style="flex:1;display:flex;gap:8px;">
          <select id="ui-density"></select>
          </div>
        </div>
        <div class="btn-bar"><div class="btn" id="ui-launch">Launch</div></div>
        </div>
      </div>
      <div class="ui-section" data-accent="3">
        <div class="ui-header"><span class="arrow">▾</span> Results</div>
        <div class="ui-body">
        <div class="ui-row" style="border-top:none;">
          <label>Energy</label><div style="flex:1;"></div><div class="val-box" id="ui-energy">--</div>
        </div>
        <div class="ui-row">
          <label>Mass</label><div style="flex:1;"></div><div class="val-box" id="ui-mass">--</div>
        </div>
        <div class="note">Approximate values (simplified model).</div>
        </div>
      </div>
      </div>
    `);

    const sel = panel.querySelector('#ui-density');
    Object.keys(densities).forEach(k=>{
      const o=document.createElement('option');
      o.value=String(densities[k]); o.textContent=k; sel.appendChild(o);
    });
    sel.value=String(densities['Rocky (chondrite)']);

    panel.querySelectorAll('.ui-header').forEach(h=>{
      h.addEventListener('click',()=>h.parentElement.classList.toggle('collapsed'));
    });

    document.body.appendChild(panel);
    return panel;
  }

  // ===== CORE CALCS =====
  function compute(diamM, speedKms, densityKgM3){
    const r = Math.max(0.5, diamM/2);
    const vol = 4/3*Math.PI*r*r*r;
    const mass = vol * densityKgM3;
    const v = speedKms * 1000;
    const E = 0.5*mass*v*v;
    return { mass, E };
  }
  function humanMass(kg){
    if (kg < 1e3) return kg.toFixed(0)+' kg';
    if (kg < 1e6) return (kg/1e3).toFixed(2)+' t';
    if (kg < 1e9) return (kg/1e6).toFixed(2)+' kt';
    if (kg < 1e12) return (kg/1e9).toFixed(2)+' Mt';
    return (kg/1e12).toFixed(2)+' Gt';
  }
  function applyConfigFromUI(diamM, speedKms){
    global.Config = global.Config || {};
    global.Config.kmps = speedKms;
    global.Config.metaSpeedKmps = speedKms;
    if (window.Config) window.Config.meteorSpeed = speedKms * 0.5;

    // Usa a função do Meteor para definir raio (com preview consistente)
    if (global.Meteor && typeof global.Meteor.updateRadiusFromDiameter === 'function'){
      global.Meteor.updateRadiusFromDiameter(diamM);
    } else {
      // fallback (linear mesmo mapeamento)
      const minDiam=50,maxDiam=5000,minR=0.4,maxR=8;
      const t=Math.max(0,Math.min(1,(diamM-minDiam)/(maxDiam-minDiam)));
      global.Config.meteorRadius = minR + (maxR - minR)*t;
    }

    const densEl = document.getElementById('ui-density');
    global.Config.metaDiameterM   = diamM;
    global.Config.metaDensityKgM3 = densEl ? parseFloat(densEl.value) : 3000;
    global.Config.meteorTailEnabled  = true;
    global.Config.meteorFlameEnabled = true;
    global.Config.meteorTailOpacity  = 0.55;
  }

  // ===== Atualização em tempo real da velocidade =====
  function applyLiveSpeed(speedKmS){
    global.Config = global.Config || {};
    global.Config.kmps = speedKmS;
    global.Config.metaSpeedKmps = speedKmS;
    // >>> ADICIONADO: atualização em tempo real do meteorSpeed com a escala 0.5
    if (window.Config) window.Config.meteorSpeed = speedKmS * 0.5;
    // Se o objeto Meteor expuser um método específico
    if(global.Meteor){
      if(typeof global.Meteor.setVelocityKmps === 'function'){
        global.Meteor.setVelocityKmps(speedKmS);
      }else if(global.Meteor.velocity && typeof global.Meteor.velocity.setLength === 'function'){
        // Ajuste aproximado (metros/segundo)
        global.Meteor.velocity.setLength(speedKmS * 1000);
      }
    }
  }

  function updateRangeFill(r){
    const min = parseFloat(r.min)||0;
    const max = parseFloat(r.max)||100;
    const val = parseFloat(r.value);
    const percent = ((val - min) / (max - min)) * 100;
    r.style.setProperty('--percent', percent + '%');
  }

  // ===== INIT UI =====
  function init(){
    const panel = buildUI();
    const latEl = panel.querySelector('#ui-lat');
    const lonEl = panel.querySelector('#ui-lon');
    const areaEl= panel.querySelector('#ui-area');
    const popEl = panel.querySelector('#ui-pop');
    const diamEl= panel.querySelector('#ui-diam');
    const speedEl=panel.querySelector('#ui-speed');
    const densEl = panel.querySelector('#ui-density');
    const diamVal= panel.querySelector('#ui-diam-val');
    const speedVal=panel.querySelector('#ui-speed-val');
    const massEl = panel.querySelector('#ui-mass');
    const enerEl = panel.querySelector('#ui-energy');
    const launch = panel.querySelector('#ui-launch');
    const clear  = panel.querySelector('#ui-clear');

    function refresh(){
      const d = parseFloat(diamEl.value)||0;
      const v = parseFloat(speedEl.value)||0;
      const rho = parseFloat(densEl.value)||3000;
      const {mass,E}=compute(d,v,rho);
      diamVal.textContent = d.toFixed(0);
      speedVal.textContent= v.toFixed(1);
      massEl.textContent  = humanMass(mass);
      enerEl.textContent  = formatMT(E);
      updateRangeFill(diamEl);
      updateRangeFill(speedEl);

      // Redimensiona em tempo real sem esperar lançar
      if (global.Meteor && typeof global.Meteor.updateRadiusFromDiameter === 'function'){
        global.Meteor.updateRadiusFromDiameter(d);
      } else {
        global.Config.meteorRadius = d; // fallback simples
      }

      applyLiveSpeed(v); // já atualiza velocidade
    }

    refresh();
    diamEl.addEventListener('input', refresh);
    speedEl.addEventListener('input', refresh);
    densEl.addEventListener('change', refresh);
    window.addEventListener('resize', ()=>{
      updateRangeFill(diamEl);updateRangeFill(speedEl);
    });

    let hasTarget=false;
    window.addEventListener('MeteorTargetChanged', (ev)=>{
      const {lat,lon}=ev.detail||{};
      if (typeof lat==='number' && typeof lon==='number'){
        latEl.textContent = lat.toFixed(2)+'°';
        lonEl.textContent = lon.toFixed(2)+'°';
        if (window.PopGrid){
          const res = PopGrid.lookup(lat, lon);
          if (res){
            areaEl.textContent = res.label;
            popEl.textContent  = res.density + ' hab/km²';
          } else {
            popEl.textContent='--';
          }
        }
        hasTarget = true;
      }
    });

    launch.addEventListener('click', ()=>{
      if (!global.Meteor || !hasTarget) return;
      applyConfigFromUI(parseFloat(diamEl.value)||0, parseFloat(speedEl.value)||0);
      global.Meteor.launch();
    });

    clear.addEventListener('click', ()=>{
      latEl.textContent='--';
      lonEl.textContent='--';
      areaEl.textContent='--';
      popEl.textContent='--';
      hasTarget=false;
    });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);