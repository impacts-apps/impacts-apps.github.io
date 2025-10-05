// Grid global 5x5° para densidade populacional.
// Use PopGrid.lookup(lat, lon).
(function (global) {
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const wrapLon = lon => ((lon+180)%360+360)%360-180; // [-180,180)

  function generateFullGrid(stepDeg){
    const cells = [];
    for (let latMin = -90; latMin < 90; latMin += stepDeg){
      const latMax = Math.min(latMin + stepDeg, 90);
      for (let lonMin = -180; lonMin < 180; lonMin += stepDeg){
        const lonMax = Math.min(lonMin + stepDeg, 180);
        cells.push({
          latMin,
          latMax,
          lonMin,
          lonMax,
          density: null, // preencha
          label: ""
        });
      }
    }
    return cells;
  }

  const PopGrid = {
    config: {
      stepDeg: 5,
      avgDensity: 60,
      defaultDensity: 30,
      labelDefault: 'World avg'
    },
    cells: generateFullGrid(5),

    // Chave única para facilitar edição em massa
    cellKey(latMin, lonMin){ return `${latMin}_${lonMin}`; },

    // Busca célula pelo canto SW
    find(latMin, lonMin){
      return this.cells.find(c=>c.latMin===latMin && c.lonMin===lonMin) || null;
    },

    setDensity(latMin, lonMin, density, label){
      const c = this.find(latMin, lonMin);
      if (!c) return false;
      c.density = density;
      if (label !== undefined) c.label = label;
      return true;
    },

    // Preenche várias: obj { "lat_lon": {d:valor, l:"label"} }
    setBulk(map){
      for (const k in map){
        const parts = k.split('_');
        const latMin = parseFloat(parts[0]);
        const lonMin = parseFloat(parts[1]);
        const item = map[k];
        this.setDensity(latMin, lonMin, item.d, item.l);
      }
    },

    // Retorna célula contendo (lat,lon)
    lookup(lat, lon){
      lon = wrapLon(lon);
      for (const c of this.cells){
        if (lat >= c.latMin && lat < c.latMax && lon >= c.lonMin && lon < c.lonMax){
          const dens = (c.density == null ? this.config.defaultDensity : c.density);
            return {
              density: dens,
              label: (c.label || this.config.labelDefault),
              box: c
            };
        }
      }
      return {
        density: this.config.defaultDensity,
        label: this.config.labelDefault,
        box: null
      };
    },

    localFactor(lat, lon){
      const d = this.lookup(lat, lon).density;
      return clamp(d / this.config.avgDensity, 0.1, 5.0);
    },

    // Exporta array JS para copiar
    exportTemplate(){
      const lines = this.cells.map(c =>
        `{ latMin:${c.latMin}, latMax:${c.latMax}, lonMin:${c.lonMin}, lonMax:${c.lonMax}, density:${c.density==null?'':c.density}, label:"${c.label}" }`
      );
      const txt = '[\n  ' + lines.join(',\n  ') + '\n]';
      console.log(txt);
      return txt;
    },

    // Exporta CSV (latMin,lonMin,latMax,lonMax,density,label)
    exportCSV(){
      const header = 'latMin,lonMin,latMax,lonMax,density,label';
      const rows = this.cells.map(c =>
        [c.latMin,c.lonMin,c.latMax,c.lonMax,(c.density==null?'':c.density), `"${c.label.replace(/"/g,'""')}"`].join(',')
      );
      const csv = [header, ...rows].join('\n');
      console.log(csv);
      return csv;
    },

    // Imprime linha de uma faixa de latitude (tabela horizontal)
    printBand(latMin){
      const row = this.cells.filter(c=>c.latMin===latMin).sort((a,b)=>a.lonMin-b.lonMin);
      const arr = row.map(c => {
        const d = c.density==null?'--':c.density;
        return `[${c.lonMin}..${c.lonMax}]=${d}`;
      });
      console.log(`Lat ${latMin}..${latMin+this.config.stepDeg}:`, arr.join(' | '));
    },

    // Imprime várias faixas
    printMatrix(latStart=-90, latEnd=90){
      for (let lat = latStart; lat < latEnd; lat += this.config.stepDeg){
        this.printBand(lat);
      }
    },

    // Listas completas (latMin e lonMin) em passos de 5°
    LATS: (()=>{ const a=[]; for(let l=-90;l<90;l+=5) a.push(l); return a; })(),
    LONS: (()=>{ const a=[]; for(let l=-180;l<180;l+=5) a.push(l); return a; })(),

    // Índice plano (ordenado por lat depois lon)
    allCellsIndex: (function(){
      const idx=[];
      for(let lat=-90;lat<90;lat+=5){
        for(let lon=-180;lon<180;lon+=5){
          idx.push({latMin:lat, lonMin:lon});
        }
      }
      return idx;
    })(),

    // Imprime todas as chaves agrupadas por latitude
    printKeys(){
      let currentLat=null;
      let line='';
      for(const c of this.allCellsIndex){
        if(c.latMin!==currentLat){
          if(line) console.log(line);
          currentLat=c.latMin;
          line=`lat ${currentLat>=0?'+':''}${currentLat}: `;
        }
        line+=`${c.lonMin>=0?'+':''}${c.lonMin},`;
      }
      if(line) console.log(line);
    },

    // Gera um objeto template só de uma latitude (para você copiar e preencher)
    templateForLat(latMin){
      if(!this.LATS.includes(latMin)){
        console.warn('Latitude inválida. Use múltiplos de 5 entre -90 e 85.');
        return {};
      }
      const out={};
      for(const lon of this.LONS){
        out[`${latMin}_${lon}`]={ d:'', l:'' };
      }
      console.log(out);
      return out;
    },

    // Gera template completo (cuidado: grande ~5184 células)
    fullTemplateObject(){
      const o={};
      for(const lat of this.LATS){
        for(const lon of this.LONS){
          o[`${lat}_${lon}`]={ d:'', l:'' };
        }
      }
      console.log(o);
      return o;
    },

    // Exemplo de preenchimento rápido
    exampleFill(){
      this.setBulk({
        "-15_35": { d:45, l:"N Mozambique / S Tanzania" },
        "20_70":  { d:400, l:"N India / Bangladesh" },
        "35_-10": { d:200, l:"S Europe" },
        "35_-90": { d:150, l:"E USA" }
      });
    }
  };

  // --------- EXEMPLOS PRÉ-CARREGADOS (edite livremente) ----------
  // Chaves: "latMin_lonMin" (múltiplos de 5). density = pessoas/km² (estimativas simplificadas)
  (function populateExampleDensities(){
    PopGrid.setBulk({
      "-15_35": { d:45, l:"N Mozambique / S Tanzania" },
      "20_70":  { d:400, l:"N India / Bangladesh" },
      "35_-10": { d:200, l:"S Europe" },
      "35_-90": { d:150, l:"E USA" }
    });
  })();

  // --------- MAPEAMENTO AUTOMÁTICO POR CONTINENTES ----------
  (function populateExampleDensities(){
    
    // Função que determina o continente baseado em lat/lon
    function getContinentDensity(lat, lon) {
      // América do Norte: lat 25-65, lon -160 a -80
      if (lat >= 25 && lat <= 65 && lon >= -160 && lon <= -80) {
        return { d: 29.4, l: "North America" };
      }
      
      // América do Sul: lat -55 a 15, lon -80 a -35  
      if (lat >= -55 && lat <= 15 && lon >= -80 && lon <= -35) {
        return { d: 25.1, l: "South America" };
      }
      
      // Europa: lat 35-70, lon -10 a 60
      if (lat >= 35 && lat <= 70 && lon >= -10 && lon <= 60) {
        return { d: 33.7, l: "Europe" };
      }
      
      // África: lat -35 a 35, lon -20 a 50
      if (lat >= -35 && lat <= 35 && lon >= -20 && lon <= 50) {
        return { d: 51.8, l: "Africa" };
      }
      
      // Ásia: lat -10 a 75, lon 25 a 180
      if (lat >= -10 && lat <= 75 && lon >= 25 && lon <= 180) {
        return { d: 155.4, l: "Asia" };
      }
      
      // Oceania: lat -50 a -10, lon 110 a 180
      if (lat >= -50 && lat <= -10 && lon >= 110 && lon <= 180) {
        return { d: 5.5, l: "Oceania" };
      }
      
      // Oceano/Antártida
      return { d: 1, l: "Ocean" };
    }
    
    // Aplica automaticamente para todas as células do grid
    const bulk = {};
    for (let lat = -90; lat < 90; lat += 5) {
      for (let lon = -180; lon < 180; lon += 5) {
        const continent = getContinentDensity(lat, lon);
        bulk[`${lat}_${lon}`] = continent;
      }
    }
    
    PopGrid.setBulk(bulk);
  })();

  // Expor o objeto globalmente
  global.PopGrid = PopGrid;

})(this);
