// Simplified Config (rollback sem retorno orbital)
const Config = {
  meteorRadius: 0.5,
  meteorColor: 0xffaa00,
  meteorSpeed: 18.0,

  fragmentCount: 230,
  fragmentColor: 0x4e3b31,

  // Velocidade base (novo range maior para compensar delta = 0.125 * rawDelta)
  fragmentSpeedMin: 60,
  fragmentSpeedMax: 360,

  fragmentSize: 0.13,
  fragmentSizeJitter: 0.4,

  // Spray controlado
  fragmentConeAngleDeg: 50,
  fragmentSpawnOffset: 3,
  fragmentLateralSpread: 3.0,

  // Limite remoção distante
  fragmentDespawnRadius: 130,

  // Gravidade simples
  fragmentGravity: 115550000000,          // aumenta p/ puxar mais forte
  fragmentGravityFalloff: 4.8,    // 2 = 1/r^2 | diminuir para puxar melhor longe
  fragmentDrag: 15.05,             // arrasto (0.0–0.2)
  fragmentReentryRadius: 50.8,     // raio para sumir ao “tocar” a Terra

  

  meteorTailEnabled: true,
  meteorTailMaxParticles: 2500,
  meteorTailEmitRate: 2000,        // partículas por segundo
  meteorTailParticleLife: 0.7,    // segundos
  meteorTailParticleSize: 0.6,    // tamanho base
  meteorTailBaseSpeed: 12,        // meteoro "escapa" da cauda
  meteorTailSpread: 0.18,         // mantém
  meteorTailConeDeg: 120,          // abre um pouco a direção
  meteorTailDrift: 0.8,           // leve turbulência
  meteorTailLateralFactor: 5.22,  // permite mais componente lateral
  meteorTailCollimation: 0.05,    // menos colimação
  meteorTailFadeExp: 1.3,     // fade mais rápido (opcional)
  meteorTailColorStart: 0x211b15, // início
  meteorTailColorEnd: 0x223355,   // fim (mais escuro / frio)
  meteorTailOpacity: 0.6,
  meteorTailBackShift: 0.10,   // desloca a emissão da cauda para trás

   // Fire (aura) ao redor do meteoro
  meteorFlameEnabled: true,
  meteorFlameEmitRate: 2000,        // partículas/segundo
  meteorFlameParticleLife: 0.4,   // segundos (curto)
  meteorFlameParticleSize: 0.15,
  meteorFlameInnerOffset: 0.05,    // começa um pouco acima da superfície
  meteorFlameThickness: 0.1,      // espessura do “anel” de emissão
  meteorFlameExpansionSpeed: 0.1,   // velocidade radial para fora
  meteorFlameDrift: 10.0,           // turbulência leve
  meteorFlameFadeExp: 1.1,
  meteorFlameColorStart: 0xffe08a, // amarelo quente
  meteorFlameColorEnd:   0xff4c22, // laranja/vermelho
  meteorFlameOpacity: 0.85,
  
  meteorFlameBackShift: 0.04,  // desloca o fogo levemente para trás


  
};
window.Config = Config;
