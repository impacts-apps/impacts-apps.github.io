(function (global) {
  // ---------- utils (inalterados) ----------
  const J_PER_MEGATON = 4.184e15;
  const WORLD_POP = 8_142_000_000;
  const km2mi = km => km * 0.621371;
  const mi2km = mi => mi / 0.621371;
  const kmps2mph = kmps => kmps * 2236.93629;
  const m2ft = m => m * 3.28084;
  const withSep = n => Number(n).toLocaleString('en-US');

  // ---------- Visibilidade (inalterado) ----------
  const RESULTS_VISIBILITY = {
    sections: { crater:true, fireball:true, shock:true, wind:true, quake:true },
    items: {
      craterWidth:true, craterDeaths:true, craterDepth:true, impactSpeed:true, energyMt:true, compareKrakatoa:true, recurrence:true,
      fireballWidth:true, fireballDeaths:true, burns3rd:true, burns2nd:true, clothesIgnite:true, treesIgnite:true,
      shockDb:true, shockDeaths:true, lungDamage:true, earDamage:true, buildingsCollapse:true, homesCollapse:true,
      windPeak:true, windDeaths:true, windJupiter:true, homesLeveled:true, ef5Feel:true, treesDown:true,
      quakeMag:true, quakeDeaths:false, quakeFelt:true,
    }
  };
  window.ResultsVisibility = RESULTS_VISIBILITY;

  // ---------- Cálculo (inalterado) ----------
  function computeAll(diamM, speedKmps, densityKgM3) {
    const r = Math.max(0.1, diamM/2);
    const vol = 4/3*Math.PI*r*r*r;
    const mass = vol*densityKgM3;
    const v = speedKmps*1000;
    const E = 0.5*mass*v*v;
    const Emt = E / J_PER_MEGATON;

    const craterMi = 1.6 * Math.pow(diamM/100, 0.83) * Math.pow(speedKmps/20, 0.44) * Math.pow(densityKgM3/3000, 1/3);
    const craterKm = mi2km(craterMi);
    const depthKm = craterKm * 0.22;
    const depthFt = m2ft(depthKm*1000);
    const impactMph = kmps2mph(speedKmps);
    const sR = Math.pow(Math.max(Emt, 0.01), 1/3);

    const shockDb   = Math.round(170 + 35*Math.log10(Math.max(Emt, 0.01)));
    const dClothesMi= 1.13*sR;
    const dTreesMi  = 2.51*sR;
    const dLungMi   = 1.20*sR;
    const dEarMi    = 1.56*sR;
    const dBldgMi   = 2.76*sR;
    const dHomesMi  = 3.52*sR;

    const windPeakMph = Math.round(1025 * Math.pow(Math.max(Emt,0.01), 0.40));
    const dJupiterMi  = 0.80*sR;
    const dLevelMi    = 1.33*sR;
    const dEF5Mi      = 2.36*sR;
    const dTrees2Mi   = 4.02*sR;

    const mag = Math.max(0, (Math.log10(Math.max(E,1)) - 11.7)/1.5 + 3.6);
    const feltMi = 5.3*sR;
    const fireballMi = craterMi;

    function recurrenceYears(diam){
      if (diam <= 120) return 0.037 * Math.pow(diam, 2.57);
      return Math.max(1, Math.round(144 * Math.pow(Math.max(Emt,0.01), 0.80)));
    }
    const yearsFreq = Math.round(recurrenceYears(diamM));
    const deathsQuake = Math.round(220 * Math.pow(Math.max(Emt,0.01)/64, 0.30));
    const moreThanKrakatoa = Emt >= 60;

    return {
      mass, E, Emt, impactMph,
      craterMi, depthFt, fireballMi,
      shockDb, dClothesMi, dTreesMi, dLungMi, dEarMi, dBldgMi, dHomesMi,
      windPeakMph, dJupiterMi, dLevelMi, dEF5Mi, dTrees2Mi,
      mag, feltMi, yearsFreq, moreThanKrakatoa
    };
  }

  // ---------- Estilo (reposicionado direita + scroll custom + sem ícones) ----------
  function ensureResultsStyle(){
    if (document.getElementById('impact-results-style-lite')) return;
    const css = `
      #impact-results{
        position:fixed;
        top:10px;
        right:10px;          /* movido para direita */
        left:auto;
        width:380px;
        max-height:85vh;
        overflow:auto;
        overscroll-behavior:contain;
        scroll-behavior:smooth;
        z-index:1002;
        font:11px/1.25 Arial, sans-serif;
        color:#d0d0d0;
        user-select:none;
        background:#0a0a0a;
        border:1px solid #161616;
        padding:0 0 8px;
        backdrop-filter:blur(2px);
      }
      /* Scrollbar custom */
      #impact-results{
        scrollbar-width:thin;
        scrollbar-color:#2e2e2e #101010;
      }
      #impact-results::-webkit-scrollbar{width:8px;}
      #impact-results::-webkit-scrollbar-track{background:#101010;}
      #impact-results::-webkit-scrollbar-thumb{
        background:#2e2e2e;
        border-radius:4px;
        border:1px solid #444;
      }
      #impact-results::-webkit-scrollbar-thumb:hover{
        background:#33aef6;
      }

      #impact-results .res-header{
        padding:8px 14px 6px 18px;
        font-size:14px;
        font-weight:bold;
        letter-spacing:.5px;
        background:#050505;
        border-bottom:1px solid #161616;
        display:flex;
        justify-content:space-between;
        align-items:center;
      }
      #impact-results button.res-close{
        background:#131313;
        border:1px solid #2d2d2d;
        color:#e2e2e2;
        font-size:10px;
        padding:4px 8px;
        cursor:pointer;
      }
      #impact-results button.res-close:hover{background:#1d1d1d;}
      #impact-results .overview-box{
        padding:8px 16px 10px;
        border-bottom:1px solid #161616;
        font-size:11px;
        line-height:1.4;
      }
      #impact-results .overview-box strong{color:#33aef6;}
      #impact-results .ui-section{
        margin:8px 10px;
        border:1px solid #161616;
        background:#0a0a0a;
        position:relative;
      }
      #impact-results .ui-section::before{
        content:"";
        position:absolute;
        left:0;top:0;bottom:0;
        width:3px;
        background:var(--accent,#33aef6);
      }
      #impact-results .ui-header{
        background:#050505;
        padding:6px 12px 6px 16px;
        font-weight:bold;
        font-size:12px;
        cursor:pointer;
        display:flex;
        gap:6px;
        align-items:center;
      }
      #impact-results .ui-header .arrow{
        font-size:9px;
        color:#bbb;
        transition:transform .18s;
      }
      #impact-results .ui-section.collapsed .ui-header .arrow{
        transform:rotate(-90deg);
      }
      #impact-results .ui-body{
        padding:6px 14px 10px 16px;
        border-top:1px solid #161616;
      }
      #impact-results .ui-section.collapsed .ui-body{display:none;}
      #impact-results ul.effect-list{
        list-style:none;
        padding:0;
        margin:0;
      }
      #impact-results ul.effect-list li{
        padding:6px 0 7px;
        border-top:1px solid #151515;
        font-size:11px;
        line-height:1.35;
      }
      #impact-results ul.effect-list li:first-child{border-top:none;}
      #impact-results .badge-num{
        background:#1d1d1d;
        border:1px solid #2e2e2e;
        padding:2px 5px;
        border-radius:3px;
        font-size:10px;
        color:#33aef6;
        font-weight:600;
      }
      #impact-results .mi-val{color:#33aef6;font-weight:600;}
      #impact-results .highlight{color:#ff8a3d;font-weight:600;}
      #impact-results .launch-again{
        margin:12px 10px 6px;
        width:calc(100% - 20px);
        background:#131313;
        border:1px solid #2d2d2d;
        color:#e2e2e2;
        padding:8px 8px;
        font-size:11px;
        cursor:pointer;
        text-align:center;
      }
      #impact-results .launch-again:hover{background:#1b1b1b;}
      /* Acentos por efeito */
      #impact-results .ui-section[data-effect="crater"]{--accent:#33aef6;}
      #impact-results .ui-section[data-effect="fireball"]{--accent:#c35bff;}
      #impact-results .ui-section[data-effect="shock"]{--accent:#ff8a3d;}
      #impact-results .ui-section[data-effect="wind"]{--accent:#58c26d;}
      #impact-results .ui-section[data-effect="quake"]{--accent:#d5d547;}
      @media (max-width:1200px){
        #impact-results{right:10px;left:auto;width:330px;}
      }
      @media (max-width:900px){
        #impact-results{top:10px;right:10px;width:300px;}
      }
    `;
    const style = document.createElement('style');
    style.id='impact-results-style-lite';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- UI ----------
  let panel, listContainer, overviewEl;

  function ensurePanel() {
    ensureResultsStyle();
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'impact-results';
    panel.style.display='none';
    panel.innerHTML = `
      <div class="res-header">
        <div>RESULTS</div>
        <button class="res-close" id="ir-close">CLOSE</button>
      </div>
      <div class="overview-box" id="ir-overview"></div>
      <div id="ir-sections"></div>
      <button id="ir-launch-again" class="launch-again">LAUNCH ANOTHER</button>
    `;
    document.body.appendChild(panel);
    overviewEl = panel.querySelector('#ir-overview');
    listContainer = panel.querySelector('#ir-sections');

    panel.querySelector('#ir-close').addEventListener('click', ()=> panel.style.display='none');
    panel.querySelector('#ir-launch-again').addEventListener('click', ()=>{
      panel.style.display='none';
      const launchBtn=document.getElementById('ui-launch');
      if (launchBtn) launchBtn.focus();
    });
    return panel;
  }

  function makeSection(effectKey, title, rows) {
    if (!rows.length) return '';
    return `
      <div class="ui-section" data-effect="${effectKey}">
        <div class="ui-header"><span class="arrow">▾</span> ${title}</div>
        <div class="ui-body">
          <ul class="effect-list">
            ${rows.join('')}
          </ul>
        </div>
      </div>`;
  }

  // (Ícones removidos – apenas texto)
  function li(_iconIgnored, html){
    return `<li>${html}</li>`;
  }

  function attachSectionBehavior(container){
    container.querySelectorAll('.ui-header').forEach(h=>{
      if (h.__bind) return;
      h.__bind=true;
      h.addEventListener('click', ()=>{
        h.parentElement.classList.toggle('collapsed');
      });
    });
    container.querySelectorAll('.ui-section[data-effect]').forEach(sec=>{
      if (sec.__bindHover) return;
      sec.__bindHover=true;
      const eff = sec.getAttribute('data-effect');
      sec.addEventListener('mouseenter', ()=>{
        window.dispatchEvent(new CustomEvent('ImpactEffectHover',{detail:{effect:eff,active:true}}));
      });
      sec.addEventListener('mouseleave', ()=>{
        window.dispatchEvent(new CustomEvent('ImpactEffectHover',{detail:{effect:eff,active:false}}));
      });
    });
  }

  function renderResults(lat, lon, diamM, speedKmps, densityKgM3) {
    ensurePanel();
    const r = computeAll(diamM, speedKmps, densityKgM3);
    if (overviewEl){
      overviewEl.innerHTML =
        `Lat <strong>${lat.toFixed(2)}°</strong> • Lon <strong>${lon.toFixed(2)}°</strong><br>`+
        `Diâmetro <strong>${Math.round(diamM)} m</strong> • <strong>${speedKmps.toFixed(1)} km/s</strong> • ρ≈${Math.round(densityKgM3)} kg/m³<br>`+
        `Energia liberada: <span class="highlight">${withSep(r.Emt.toFixed(2))} Mt</span> (equivalente TNT)`;
    }

    // Casualties estimadas
    const localDensity = (window.PopGrid ? PopGrid.lookup(lat, lon).density : 30);
    const radiiMi = [r.craterMi,r.fireballMi,r.dBldgMi,r.dHomesMi,r.dTrees2Mi].filter(x=>x>0);
    const maxRadiusMi = Math.max(...radiiMi, 0.1);
    const maxRadiusKm = maxRadiusMi * 1.60934;
    const areaKm2 = Math.PI * maxRadiusKm * maxRadiusKm;
    const weight = (radiusMi,w)=> w*(radiusMi/maxRadiusMi);
    const lethalScore =
      weight(r.craterMi,5)+weight(r.fireballMi,4)+weight(r.dBldgMi,3)+weight(r.dHomesMi,2)+weight(r.dEarMi,1);
    const killProb = 1 - Math.exp(-lethalScore/10);
    const energyFactor = Math.min(1, Math.pow(r.Emt/64,0.5));
    let casualties = areaKm2 * localDensity * killProb * energyFactor;
    casualties = Math.min(casualties, WORLD_POP);

    const FRACTIONS = { crater:.10, fireball:.35, burns3rd:.03, burns2nd:.07, shock:.18, wind:.22, quake:.05 };
    const deathsCrater   = Math.round(casualties * FRACTIONS.crater);
    const deathsFireball = Math.round(casualties * FRACTIONS.fireball);
    const burns3rd       = Math.round(casualties * FRACTIONS.burns3rd);
    const burns2nd       = Math.round(casualties * FRACTIONS.burns2nd);
    const deathsShock    = Math.round(casualties * FRACTIONS.shock);
    const deathsWind     = Math.round(casualties * FRACTIONS.wind);
    const quakeDeaths    = Math.round(casualties * FRACTIONS.quake * 0.05);

    const S = RESULTS_VISIBILITY.sections;
    const I = RESULTS_VISIBILITY.items;

    // ----- Seções (texto expandido) -----
    let craterRows=[], fireRows=[], shockRows=[], windRows=[], quakeRows=[];

    if (S.crater){
      if (I.craterWidth) craterRows.push(li('', `Resulting crater with an approximate diameter of <strong>${r.craterMi.toFixed(1)} miles</strong>.`));
      if (I.craterDeaths) craterRows.push(li('', `<span class="badge-num">${withSep(Math.min(deathsCrater,WORLD_POP))}</span> estimated deaths in the central crater excavation zone.`));
      if (I.craterDepth) craterRows.push(li('', `Estimated average crater depth: <strong>${withSep(Math.round(r.depthFt))} feet</strong>.`));
      if (I.impactSpeed) craterRows.push(li('', `Impact velocity upon hitting the ground: <strong>${withSep(Math.round(r.impactMph))} mph</strong>.`));
      if (I.energyMt) craterRows.push(li('', `Kinetic energy converted: <strong>${withSep(r.Emt.toFixed(0))} megatons of TNT</strong>.`));
      if (I.compareKrakatoa) craterRows.push(li('', `Total energy is ${r.moreThanKrakatoa? 'greater' : 'less'} than the Krakatoa eruption (1883).`));
      if (I.recurrence) craterRows.push(li('', `An event of this magnitude occurs on average every <strong>${withSep(r.yearsFreq)}</strong> years (statistical estimate).`));
    }
    if (S.fireball){
      if (I.fireballWidth) fireRows.push(li('', `Initial fireball with a heating radius of approximately <strong>${r.fireballMi.toFixed(1)} miles</strong>.`));
      if (I.fireballDeaths) fireRows.push(li('', `<span class="badge-num">${withSep(Math.min(deathsFireball,WORLD_POP))}</span> potential deaths caused by the initial thermal pulse.`));
      if (I.burns3rd) fireRows.push(li('', `<span class="badge-num">${withSep(Math.min(burns3rd,WORLD_POP))}</span> victims with 3rd degree burns within the critical zone.`));
      if (I.burns2nd) fireRows.push(li('', `<span class="badge-num">${withSep(Math.min(burns2nd,WORLD_POP))}</span> victims with 2nd degree burns in the outer ring.`));
      if (I.clothesIgnite) fireRows.push(li('', `Clothes and light materials may ignite up to about <strong>${r.dClothesMi.toFixed(1)} miles</strong> from the impact point.`));
      if (I.treesIgnite) fireRows.push(li('', `Vegetation and trees may catch fire up to <strong>${r.dTreesMi.toFixed(1)} miles</strong>.`));
    }
    if (S.shock){
      if (I.shockDb) shockRows.push(li('', `Shock wave front with an estimated peak of <strong>${withSep(r.shockDb)} dB</strong> near the impact.`));
      if (I.shockDeaths) shockRows.push(li('', `<span class="badge-num">${withSep(Math.min(deathsShock,WORLD_POP))}</span> deaths due to overpressure and trauma from the shock wave.`));
      if (I.lungDamage) shockRows.push(li('', `Severe lung damage possible up to <strong>${r.dLungMi.toFixed(1)} miles</strong>.`));
      if (I.earDamage) shockRows.push(li('', `Eardrum rupture possible up to <strong>${r.dEarMi.toFixed(1)} miles</strong>.`));
      if (I.buildingsCollapse) shockRows.push(li('', `Structural collapse of robust buildings up to <strong>${r.dBldgMi.toFixed(0)} miles</strong>.`));
      if (I.homesCollapse) shockRows.push(li('', `Collapse of standard homes up to <strong>${r.dHomesMi.toFixed(0)} miles</strong>.`));
    }
    if (S.wind){
      if (I.windPeak) windRows.push(li('', `Estimated peak wind gust: <strong>${withSep(r.windPeakMph)} mph</strong>.`));
      if (I.windDeaths) windRows.push(li('', `<span class="badge-num">${withSep(Math.min(deathsWind,WORLD_POP))}</span> deaths associated with debris and extreme winds.`));
      if (I.windJupiter) windRows.push(li('', `Wind speeds comparable to the largest cyclones on Jupiter within <strong>${r.dJupiterMi.toFixed(1)} miles</strong>.`));
      if (I.homesLeveled) windRows.push(li('', `Homes may be swept from their foundations up to <strong>${r.dLevelMi.toFixed(1)} miles</strong>.`));
      if (I.ef5Feel) windRows.push(li('', `EF5 tornado-like intensities experienced up to <strong>${r.dEF5Mi.toFixed(1)} miles</strong>.`));
      if (I.treesDown) windRows.push(li('', `Widespread tree fall up to <strong>${r.dTrees2Mi.toFixed(0)} miles</strong>.`));
    }
    if (S.quake){
      if (I.quakeMag) quakeRows.push(li('', `Induced seismic tremor equivalent to magnitude <strong>${r.mag.toFixed(1)}</strong> (local scale).`));
      if (I.quakeDeaths) quakeRows.push(li('', `<span class="badge-num">${withSep(Math.min(quakeDeaths,WORLD_POP))}</span> estimated deaths associated with secondary seismic effects.`));
      if (I.quakeFelt) quakeRows.push(li('', `Tremor felt by the population up to approximately <strong>${r.feltMi.toFixed(0)} miles</strong> away.`));
    }

    const sectionsHTML = [
      makeSection('crater', 'Crater', craterRows),
      makeSection('fireball','Fireball', fireRows),
      makeSection('shock','Shock Wave', shockRows),
      makeSection('wind','Wind Blast', windRows),
      makeSection('quake','Earth Quake', quakeRows)
    ].filter(Boolean).join('');

    listContainer.innerHTML = sectionsHTML || '<div style="padding:12px;font-size:11px;opacity:.7;">No visible lines.</div>';
    attachSectionBehavior(listContainer);
    panel.style.display='block';
  }

  // ----- Eventos -----
  window.addEventListener('MeteorImpact', (ev)=>{
    const d = ev.detail || {};
    const diamEl=document.getElementById('ui-diam'), speedEl=document.getElementById('ui-speed'), densEl=document.getElementById('ui-density');
    const diamM = Number.isFinite(d.diamM) ? d.diamM : (diamEl ? parseFloat(diamEl.value) : 100);
    const speed = Number.isFinite(d.speedKmps) ? d.speedKmps : (speedEl ? parseFloat(speedEl.value) : 20);
    const rho   = Number.isFinite(d.densityKgM3) ? d.densityKgM3 : (densEl ? parseFloat(densEl.value) : 3000);
    const lat = typeof d.lat==='number'? d.lat : 0;
    const lon = typeof d.lon==='number'? d.lon : 0;
    renderResults(lat, lon, diamM, speed, rho);
  });

  // Substituído: no lançamento apenas esconde (não mostra resultados antes do impacto)
  window.addEventListener('MeteorLaunch', ()=>{
    if (panel) panel.style.display='none';
  });

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', ensurePanel);
  } else {
    ensurePanel();
  }
})(window);