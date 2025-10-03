// main.js - Final Optimized Version with Take 13 Update - BUG FIXES APPLIED
// This file must be loaded AFTER xg.min.eb2.js

// ========== GLOBAL VARIABLES ==========
let currentSection = 0;
const totalSections = 20;
let isTransitioning = false;
let asteroid;
let scrollTimeout;
let animationManager;
let physics;
let nasaData;
let infoPanelPositioner;
let enhancedPanel;
let stars = [];
let waterSurface, waterMesh;
let freeLook = false;
window.mainSceneReady = false; // Flag to signal when main scene is loaded
let asteroidWatchInterval; // Timer for the asteroid watch widget
let scrollWarningTimeout; // Timer for the scroll warning message
let shockwave; // For impact effect
let isExperienceStarted = false; // Prevents scroll during intro
let isResourcesReady = false; // NEW: Track if all resources are loaded

let inputLocked = false; // NEW: Lock user input during cutscenes

let isPanelVisible = false;

// XG/WebGL Variables
var hasWebGL1 = true;
var hasWebGL2 = false;
var hudVisible = true;
var useDeferred = true;
var backend = "webgl1";
var isMobile = false;
var useMRT = true;

// Platform fixes
var isOSX = navigator.platform.toLowerCase().indexOf("mac") >= 0;
var isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") >= 0;
if (isOSX && isFirefox) useMRT = false;

var SCALE = 1.0 / window.devicePixelRatio;
var MARGIN = 0;
var BRIGHTNESS = 2;
var SCREEN_WIDTH = window.innerWidth;
var SCREEN_HEIGHT = window.innerHeight - 2 * MARGIN;
var rotationEnabled = false;
var container, camera, scene;
var renderer;
var dayLight;
var meshRoot;
var normalEarthMaterial, normalMapWater;
var assets = {};
var planets = [];
var spheres = [];
var currentLOD = 0;
var loadCounter = 0;
var clock;

// Camera control variables
var mouseX = 0;
var mouseY = 0;
var targetX = 0.0;
var targetY = 0.0;
var angle = 0.0;
var height = 0.0;
var target;
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

// ========== ANIMATION STATE MANAGER ==========
class AnimationStateManager {
    constructor() {
        this.currentAnimations = [];
        this.isAnimating = false;
        this.pendingAnimation = null; // NEW: Track pending animations
    }
    
    clearAnimations() {
        // Cancel any pending animation
        if (this.pendingAnimation) {
            clearTimeout(this.pendingAnimation);
            this.pendingAnimation = null;
        }
        
        this.currentAnimations.forEach(anim => anim.pause());
        if (typeof anime !== 'undefined') {
            anime.remove(camera.position.data);
            anime.remove(meshRoot.rotation.data);
            anime.remove(meshRoot.scale.data);
            if(asteroid) {
                anime.remove(asteroid.position.data);
                anime.remove(asteroid.scale.data); 
                if (asteroid.materials[0] && asteroid.materials[0].emissive) {
                    anime.remove(asteroid.materials[0]);
                }
            }
            if(dayLight) anime.remove(dayLight.position.data);
        }
        this.currentAnimations = [];
    }
    
    transitionToState(toIndex, duration = 2500) {
        if (freeLook) return;
        this.clearAnimations();
        this.isAnimating = true;
        
        const targetState = this.getTakeTargetState(toIndex);
        
        const onComplete = () => {
            this.isAnimating = false;
            camera.position.set(targetState.camera.x, targetState.camera.y, targetState.camera.z);
            meshRoot.rotation.set(targetState.earth.rotation.x, targetState.earth.rotation.y, targetState.earth.rotation.z);
            meshRoot.scale.set(targetState.earth.scale.x, targetState.earth.scale.y, targetState.earth.scale.z);
            if (asteroid) {
                asteroid.position.set(targetState.asteroid.position.x, targetState.asteroid.position.y, targetState.asteroid.position.z);
                asteroid.scale.set(targetState.asteroid.scale.x, targetState.asteroid.scale.y, targetState.asteroid.scale.z);
            }
            if (dayLight) {
                dayLight.position.set(targetState.light.x, targetState.light.y, targetState.light.z);
            }
        };

        if (typeof anime !== 'undefined') {
            const timeline = anime.timeline({
                duration: duration,
                easing: 'easeInOutQuart',
                complete: onComplete
            });

            timeline.add({
                targets: camera.position.data,
                0: targetState.camera.x,
                1: targetState.camera.y,
                2: targetState.camera.z,
                update: () => {
                    if (toIndex !== 7) { 
                        camera.lookAt(new XG.Vector3(0, 0, 0));
                    }
                }
            }, 0);

            timeline.add({
                targets: dayLight.position.data,
                0: targetState.light.x,
                1: targetState.light.y,
                2: targetState.light.z,
            }, 0);

            if (asteroid) {
                timeline.add({
                    targets: asteroid.position.data,
                    0: targetState.asteroid.position.x,
                    1: targetState.asteroid.position.y,
                    2: targetState.asteroid.position.z,
                }, 0);
            }

            if (toIndex === 3) {
                const phase1Duration = duration * 0.6; 
                const phase2Delay = duration * 0.55; 
                const phase2Duration = duration * 0.45; 

                timeline.add({
                    targets: meshRoot.scale.data,
                    0: targetState.earth.scale.x,
                    1: targetState.earth.scale.y,
                    2: targetState.earth.scale.z,
                    duration: phase1Duration,
                }, 0);
                timeline.add({
                    targets: meshRoot.rotation.data,
                    0: targetState.earth.rotation.x,
                    1: targetState.earth.rotation.y,
                    2: targetState.earth.rotation.z,
                    duration: phase1Duration,
                }, 0);

                if (asteroid) {
                    timeline.add({
                        targets: asteroid.scale.data,
                        0: targetState.asteroid.scale.x,
                        1: targetState.asteroid.scale.y,
                        2: targetState.asteroid.scale.z,
                        duration: phase2Duration,
                    }, phase2Delay);
                }

            } else {
                timeline.add({
                    targets: meshRoot.rotation.data,
                    0: targetState.earth.rotation.x,
                    1: targetState.earth.rotation.y,
                    2: targetState.earth.rotation.z,
                }, 0);
                timeline.add({
                    targets: meshRoot.scale.data,
                    0: targetState.earth.scale.x,
                    1: targetState.earth.scale.y,
                    2: targetState.earth.scale.z,
                }, 0);
                if (asteroid) {
                    timeline.add({
                        targets: asteroid.scale.data,
                        0: targetState.asteroid.scale.x,
                        1: targetState.asteroid.scale.y,
                        2: targetState.asteroid.scale.z,
                    }, 0);
                }
            }
            
            this.currentAnimations.push(timeline); // Track the animation
        } else {
            onComplete();
        }
    }
    
    getTakeTargetState(index) {
        const HIDDEN_SCALE = { x: 0.001, y: 0.001, z: 0.001 };
        const VISIBLE_SCALE = { x: 1, y: 1, z: 1 };
        const DEFAULT_LIGHT_POS = { x: 0, y: 250, z: 500 };

        const asteroidStates = [
            { position: { x: 0, y: 0, z: 0 }, scale: HIDDEN_SCALE }, // 0
            { position: { x: 0, y: 0, z: 0 }, scale: HIDDEN_SCALE }, // 1
            { position: { x: 300, y: 0, z: 0 }, scale: HIDDEN_SCALE },     // 2 
            { position: { x: 0, y: 0, z: 0 }, scale: VISIBLE_SCALE },     // 3 
            { position: { x: 0, y: 0, z: 0 }, scale: VISIBLE_SCALE }, // 4
            { position: { x: 0, y: 0, z: 0 }, scale: VISIBLE_SCALE }, // 5
            { position: { x: 100, y: 50, z: -150 }, scale: { x: 1.5, y: 1.5, z: 1.5 } }, // 6
            { position: { x: 0, y: 0, z: 0 }, scale: { x: 15, y: 15, z: 15 } }, // 7
            { position: { x: 0, y: 0, z: 0 }, scale: HIDDEN_SCALE }, // 8
            { position: { x: 0, y: 0, z: 0 }, scale: HIDDEN_SCALE }, // 9
            { position: { x: 0, y: 0, z: 0 }, scale: VISIBLE_SCALE }, // 10
            { position: { x: 0, y: 0, z: 0 }, scale: VISIBLE_SCALE }, // 11
            { position: { x: 0, y: 0, z: 0 }, scale: VISIBLE_SCALE }, // 12 - Updated for take 13
            { position: { x: 37.5, y: 12.5, z: 0 }, scale: VISIBLE_SCALE }, // 13
            { position: { x: -50, y: 25, z: 25 }, scale: VISIBLE_SCALE }, // 14
            { position: { x: 0, y: 0, z: 5 }, scale: VISIBLE_SCALE }, // 15
            { position: { x: 150, y: 75, z: -75 }, scale: VISIBLE_SCALE }, // 16
            { position: { x: 250, y: 125, z: -125 }, scale: VISIBLE_SCALE }, // 17
            { position: { x: 0, y: 0, z: 0 }, scale: HIDDEN_SCALE }, // 18
            { position: { x: 0, y: 0, z: 0 }, scale: HIDDEN_SCALE } // 19
        ];

        const configs = [
            { camera: { x: 0, y: 0, z: 600 }, earth: { rotation: { x: 0.25, y: 0, z: 0 }, scale: VISIBLE_SCALE }, light: DEFAULT_LIGHT_POS }, // 0
            { camera: { x: 0, y: 0, z: 850 }, earth: { rotation: { x: 0.25, y: -Math.PI / 2, z: 0 }, scale: { x: 1.2, y: 1.2, z: 1.2 } }, light: DEFAULT_LIGHT_POS }, // 1
            { camera: { x: 0, y: 0, z: 1300 }, earth: { rotation: { x: 0.1, y: Math.PI / 4, z: 0 }, scale: { x: 1.1, y: 1.1, z: 1.1 } }, light: DEFAULT_LIGHT_POS }, // 2
            { camera: { x: 0, y: 15, z: 35 }, earth: { rotation: { x: 0.2, y: 1.5, z: 0 }, scale: HIDDEN_SCALE }, light: { x: 20, y: 20, z: 40 } }, // 3
            { camera: { x: 5, y: 10, z: 1 }, earth: { rotation: { x: 0, y: 1.8, z: 0 }, scale: HIDDEN_SCALE }, light: { x: 10, y: 15, z: 20 } }, // 4
            { camera: { x: -15, y: 5, z: 18 }, earth: { rotation: { x: 0, y: 2.2, z: 0 }, scale: HIDDEN_SCALE }, light: { x: -5, y: 10, z: 25 } }, // 5
            { camera: { x: 150, y: 100, z: 800 }, earth: { rotation: { x: 0.2, y: -1.0, z: 0 }, scale: VISIBLE_SCALE }, light: { x: 150, y: 100, z: 400 } }, // 6
            { camera: { x: 0, y: 0, z: 5 }, earth: { rotation: { x: 0, y: 2.5, z: 0 }, scale: HIDDEN_SCALE }, light: { x: 10, y: 10, z: 10 } }, // 7
            { camera: { x: 0, y: 0, z: 850 }, earth: { rotation: { x: -0.26, y: -0.96, z: 0 }, scale: { x: 1.1, y: 1.1, z: 1.1 } }, light: { x: -100, y: 100, z: 300 } }, // 8
            { camera: { x: 0, y: 25, z: 850 }, earth: { rotation: { x: -0.26, y: -0.96, z: 0 }, scale: { x: 1.2, y: 1.2, z: 1.2 } }, light: { x: -100, y: 100, z: 300 } }, // 9
            { camera: { x: -150, y: 50, z: 950 }, earth: { rotation: { x: 0.3, y: -1.0, z: 0 }, scale: { x: 1.4, y: 1.4, z: 1.4 } }, light: DEFAULT_LIGHT_POS }, // 10
            { camera: { x: 0, y: 100, z: 950 }, earth: { rotation: { x: 0.1, y: -1.2, z: 0 }, scale: { x: 1.1, y: 1.1, z: 1.1 } }, light: DEFAULT_LIGHT_POS }, // 11
            { camera: { x: 0, y: 200, z: 900 }, earth: { rotation: { x: -0.5, y: 0, z: 0 }, scale: { x: 1.6, y: 1.6, z: 1.6 } }, light: { x: -200, y: -150, z: 400 } }, // 12
           
                // Take 14 - Vista ampla mostrando Terra e asteroide distante
                {
                    camera: { x: -200, y: 150, z: 800 },  // Câmera posicionada para mostrar ambos
                    earth: { 
                        rotation: { x: 0, y: Math.PI / 3, z: 0 },  // Terra rotacionada mostrando Américas
                        scale: { x: 1.0, y: 1.0, z: 1.0 }  // Terra em escala normal
                    },
                    light: { x: -150, y: 200, z: 500 },  // Iluminação dramática lateral
                    asteroid: {
                        position: { x: -350, y: 200, z: -300 },  // Asteroide distante mas visível
                        scale: { x: 2.5, y: 2.5, z: 2.5 }  // Asteroide maior para ser visível à distância
                    }
                },     
                
                
                // Take 15 - Vista orbital mostrando Terra, asteroide e trajetórias de interceptação
                {
                    camera: { x: 0, y: 300, z: 700 },  // Vista superior para mostrar trajetórias
                    earth: { 
                        rotation: { x: -0.3, y: 0, z: 0 },  // Terra inclinada para mostrar polo norte
                        scale: { x: 1.2, y: 1.2, z: 1.2 }
                    },
                    light: { x: 0, y: 300, z: 400 },
                    asteroid: {
                        position: { x: -200, y: 100, z: -150 },  // Asteroide em posição de aproximação
                        scale: { x: 3, y: 3, z: 3 }  // Visível claramente
                    }
                } , // 14


                // Take 16 - Kinetic Impact: Vista dinâmica mostrando trajetória de impacto
                {
                    camera: { x: -75, y: -50, z: 800 },
                    earth: { rotation: { x: -0.1, y: Math.PI / 3, z: 0 }, scale: VISIBLE_SCALE },
                    light: DEFAULT_LIGHT_POS,
                    asteroid: { position: { x: 150, y: 75, z: -75 }, scale: VISIBLE_SCALE }
                },

                // Take 17 - Gravity Tractor: Vista lateral mostrando espaçonave próxima
                {
                    camera: { x: 50, y: 100, z: 800 },
                    earth: { rotation: { x: 0.2, y: 0, z: 0.1 }, scale: { x: 1.2, y: 1.2, z: 1.2 } },
                    light: DEFAULT_LIGHT_POS,
                    asteroid: { position: { x: 250, y: 125, z: -125 }, scale: VISIBLE_SCALE }
                },

                // Take 18 - Laser Ablation: Vista ampla mostrando feixe de laser
                {
                    camera: { x: 0, y: 0, z: 800 },
                    earth: { rotation: { x: 0, y: Math.PI * 2, z: 0 }, scale: { x: 1.5, y: 1.5, z: 1.5 } },
                    light: DEFAULT_LIGHT_POS,
                    asteroid: { position: { x: 0, y: 0, z: 0 }, scale: HIDDEN_SCALE }
                }, // 17

            { camera: { x: 0, y: 0, z: 900 }, earth: { rotation: { x: 0, y: Math.PI * 2, z: 0 }, scale: { x: 1.5, y: 1.5, z: 1.5 } }, light: DEFAULT_LIGHT_POS }, // 18
            { camera: { x: 0, y: 75, z: 250 }, earth: { rotation: { x: 0, y: 0, z: 0 }, scale: VISIBLE_SCALE }, light: DEFAULT_LIGHT_POS } // 19
        ];
        
        const finalConfig = configs[index] || configs[0];
        finalConfig.asteroid = asteroidStates[index] || asteroidStates[0];

        return finalConfig;
    }
}


// ========== PHYSICS CALCULATIONS ==========
class ImpactPhysics {
    constructor() {
        this.G = 6.67430e-11;
        this.earthMass = 5.972e24;
        this.earthRadius = 6371000;
    }
    
    calculateImpactEnergy(mass, velocity) {
        const energy = 0.5 * mass * Math.pow(velocity, 2);
        const megatons = energy / 4.184e15;
        return megatons;
    }
    
    calculateCraterDiameter(energy) {
        const density = 2650;
        const diameter = 2 * Math.pow(energy / density, 1/3.4);
        return diameter;
    }
    
    calculateSeismicMagnitude(energy) {
        const joules = energy * 4.184e15;
        const magnitude = (2/3) * Math.log10(joules) - 6.07;
        return Math.min(9.5, magnitude);
    }
}

// ========== NASA DATA INTEGRATION ==========
class NASADataIntegration {
    constructor() {
        this.apiKey = '';
        this.neoAPI = 'https://api.nasa.gov/neo/rest/v1/';
    }
    
    async fetchNearEarthObjects() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const url = `${this.neoAPI}feed?start_date=${today}&api_key=${this.apiKey}`;
            
            const response = await fetch(url);
            const data = await response.json();
            return this.processNEOData(data);
        } catch (error) {
            console.log('Using fallback NASA data');
            return this.getFallbackData();
        }
    }
    
    processNEOData(data) {
        const neos = data.near_earth_objects;
        let hazardousCount = 0;
        let closestApproach = Infinity;
        
        Object.values(neos).forEach(dayObjects => {
            dayObjects.forEach(neo => {
                if (neo.is_potentially_hazardous_asteroid) {
                    hazardousCount++;
                }
                const distance = parseFloat(neo.close_approach_data[0]?.miss_distance?.kilometers || Infinity);
                closestApproach = Math.min(closestApproach, distance);
            });
        });
        
        return {
            totalTracked: data.element_count,
            hazardous: hazardousCount,
            closestDistance: closestApproach
        };
    }
    
    getFallbackData() {
        return {
            totalTracked: 33846,
            hazardous: 2354,
            closestDistance: 384400
        };
    }

    async fetchCloseApproaches(count = 5) {
        try {
            throw new Error('CORS policy blocks direct API call. Using fallback data.');
        } catch (error) {
            console.warn(`NASA API Call Note: ${error.message}`);
            return this.getFallbackCloseApproachData();
        }
    }

    getFallbackCloseApproachData() {
        const now = new Date();
        const createFutureDate = (h, m, s) => {
            const date = new Date();
            date.setSeconds(now.getSeconds() + s);
            date.setMinutes(now.getMinutes() + m);
            date.setHours(now.getHours() + h);
            return date;
        };
        
        return [
            { name: "2025 RE5", date: createFutureDate(1, 10, 17), distance: 6761909, diameter: 26.5 },
            { name: "2025 SU3", date: createFutureDate(3, 20, 21), distance: 7037821, diameter: 42.2 },
            { name: "2025 SS7", date: createFutureDate(15, 34, 11), distance: 286767, diameter: 3.5 },
            { name: "2025 QW2", date: createFutureDate(28, 5, 50), distance: 8901234, diameter: 89.1 },
            { name: "2025 TX9", date: createFutureDate(48, 15, 0), distance: 9123456, diameter: 15.8 }
        ];
    }
}

// ========== INFO PANEL POSITIONER ==========
class InfoPanelPositioner {
    constructor() {
        this.panel = document.getElementById('info-panel');
        this.positions = this.definePositions();
    }
    
    definePositions() {
        return [
            { right: '100px', left: 'auto', top: '20%', bottom: 'auto', transform: 'translateY(-50%)' }, // 0
            { right: '100px', left: 'auto', top: '25%', bottom: 'auto', transform: 'translateY(-50%)' }, // 1
            { right: '100px', left: 'auto', top: '25%', bottom: 'auto', transform: 'translateY(-50%)' }, // 2
            { right: '100px', left: 'auto', top: '50%', bottom: 'auto', transform: 'translateY(-50%)' }, // 3
            { left: '50px', right: 'auto', top: '80px', bottom: 'auto', transform: 'none' }, // 4
            { right: '50px', left: 'auto', top: '80px', bottom: 'auto', transform: 'none' }, // 5
            { left: '50px', right: 'auto', top: '80px', bottom: 'auto', transform: 'none' }, // 6
            { right: '100px', left: 'auto', top: '35%', bottom: 'auto', transform: 'translateY(-50%)' }, // 7
            { right: '100px', left: 'auto', top: '30%', bottom: 'auto', transform: 'translateY(-50%)' }, // 8
            { right: '100px', left: 'auto', top: '30%', bottom: 'auto', transform: 'none' }, // 9
            { left: '100px', right: 'auto', top: '40%', bottom: 'auto', transform: 'translateY(-50%)' }, // 10
            { left: '100px', right: 'auto', top: '30%', bottom: 'auto', transform: 'translateY(-50%)' }, // 11
            { right: '50px', left: 'auto', bottom: '150px', top: 'auto', transform: 'none' }, // 12 - Updated for take 13
            { right: '100px', left: 'auto', top: '30%', bottom: 'auto', transform: 'translateY(-50%)' }, // 13
            { right: '100px', left: 'auto', top: '80px', bottom: 'auto', transform: 'none' }, // 14
            { right: '100px', left: 'auto', top: '80px', bottom: 'auto', transform: 'none' }, // 15
            { right: '100px', left: 'auto', bottom: '150px', top: 'auto', transform: 'none' }, // 16
            { right: '100px', left: 'auto', bottom: '150px', top: 'auto', transform: 'none' }, // 17
            { right: '80px', left: 'auto', top: '30%', bottom: 'auto', transform: 'none' }, // 18
            { right: '50px', left: 'auto', top: '30%', bottom: 'auto', transform: 'scale(0.9)', opacity: '0.8' } // 19
        ];
    }
    
    updatePosition(takeIndex) {
        if (!this.panel) return;
        
        const position = this.positions[takeIndex] || this.positions[0];
        
        this.panel.style.transition = 'none'; 
        
        this.panel.style.left = position.left;
        this.panel.style.right = position.right;
        this.panel.style.top = position.top;
        this.panel.style.bottom = position.bottom;
        this.panel.style.transform = position.transform || 'none';
        
        this.panel.offsetHeight; 

        this.panel.style.transition = `all 0.4s var(--easing)`;
        
        if (window.innerWidth < 768) {
            this.adjustForMobile();
        }
    }
    
    adjustForMobile() {
        if (!this.panel) return;
        
        const isTakeWithBottomContent = [2, 12, 15, 18, 19].includes(currentSection);
        
        if (isTakeWithBottomContent) {
            this.panel.style.top = '60px';
            this.panel.style.bottom = 'auto';
        } else {
            this.panel.style.bottom = '60px';
            this.panel.style.top = 'auto';
        }
        
        this.panel.style.left = '50%';
        this.panel.style.right = 'auto';
        this.panel.style.transform = 'translateX(-50%)';
        this.panel.style.width = 'calc(100% - 40px)';
        this.panel.style.maxWidth = '400px';
    }
}

const infoData = [
,
    { title: "The Atmospheric Shield", content: "Our atmosphere disintegrates tons of space rock every day, protecting us from a constant, invisible bombardment.", stats: [ { label: "Daily Meteoroid Mass", value: "~48,5 tons" }, { label: "Chelyabinsk Event Energy", value: "~440 kilotons" } ], links: [ { text: "NASA: Meteors & Meteorites", url: "https://solarsystem.nasa.gov/asteroids-comets-and-meteors/meteors-and-meteorites/overview/" } ] },
    { title: "Cosmic Neighborhood", content: "NASA tirelessly monitors the skies, cataloging thousands of Near-Earth Objects (NEOs) and potential threats.", stats: [{ label: "NEOs Tracked", value: "33,846" }, { label: "Known PHAs", value: "2,354" }], links: [{ text: "NEO Database", url: "https://cneos.jpl.nasa.gov" }] },
    { type: "widget", widgetId: "asteroid-watch" },
    { 
        title: "The Hunter Encounter", 
        content: "A C-type (carbonaceous) asteroid, a primitive relic from the formation of the solar system. Its dark, carbon-rich surface makes it nearly invisible against the vacuum.", 
        stats: [
            { label: "Diameter", value: "~330 meters" }, 
            { label: "Time to Impact", value: "7 days" }
        ], 
        links: [{ text: "NASA: Asteroid Types", url: "https://solarsystem.nasa.gov/asteroids-comets-and-meteors/asteroids/in-depth/" }] 
    },
{
  title: "The Cosmic Fossil (Rubble-Pile)",
  content:
    "Remote sensing and mission analogs (e.g., Bennu/Ryugu) point to a porous rubble-pile rather than a monolithic rock — dark, low-cohesion material with hydrated minerals and organics. Such bodies can fragment during entry or respond unpredictably to forces, which matters for mitigation choices.",
  stats: [
    { label: "Bulk Density", value: "~1.2–1.6 g/cm³" },
    { label: "Porosity", value: "~40–60%" },
    { label: "Geometric Albedo", value: "< 0.05" },
    { label: "Estimated Cohesion", value: "≲ 100 Pa" }
  ],
  links: [
    { text: "NASA OSIRIS-REx (Bennu) — properties", url: "https://www.nasa.gov/osiris-rex" },
    { text: "JAXA Hayabusa2 (Ryugu) — mission", url: "https://global.jaxa.jp/projects/sas/hayabusa2/" }
  ]
},
    { title: "The Hidden Energy", content: "Despite its low density, its immense mass and velocity of 25 km/s would unleash unimaginable energy. It's not just a rock; it's a messenger from our solar system's primitive past, carrying the power to cause an extinction-level event.", stats: [{ label: "Impact Energy", value: "~2,390 MT" }, { label: "Velocity", value: "25 km/s" }], links: [{ text: "Impact Calculator", url: "https://www.purdue.edu/impactearth" }] },
    { title: "The Final Countdown", content: "Earth's gravity is now the dominant force. The silent hunt is about to end.", stats: [{ label: "Time to Impact", value: "T-60:00" }], links: [] },
    { 
        title: "Fragmentation Event", 
        content: "Drag pressure overcomes the asteroid's structural integrity. An airburst releases a fraction of the energy, but the 150-meter diameter core survives for the final impact, now an even more concentrated projectile.", 
        stats: [
            { label: "Airburst Altitude", value: "20 km" }, 
            { label: "Surviving Core", value: "150 m" },
          
        ], 
        links: [{ text: "Airburst Effects", url: "https://www.nasa.gov/history/115-years-ago-the-tunguska-asteroid-impact-event/" }] 
    },
        { 
        "title": "Global Shockwave", 
        "content": "The impact energy of the surviving core (~224 Mt) vaporizes rock and water, driving a supersonic atmospheric shockwave. This wave expands across continents and, like Krakatoa in 1883, can circle the globe.", 
        "stats": [
            { "label": "Wave Speed", "value": "343 m/s" }, 
            { "label": "Overpressure", "value": "15 PSI" }
        ], 
        "links": [
            { "text": "Shockwave Effects", "url": "https://www.grc.nasa.gov/www/k-12/VirtualAero/BottleRocket/airplane/shock.html" }
        ] 
        },
        { 
        "title": "Seismic Effects", 
        "content": "The impact generates powerful seismic waves (P & S). The rigid geology of the Brazilian Shield transmits these waves with unusual efficiency across vast distances.", 
        "stats": [
            { "label": "Magnitude", "value": "6.6 Mw (equivalent)" }, 
            { "label": "Affected Area", "value": "≈4.2M km²" }
        ], 
        "links": [
            { "text": "USGS Earthquake Data", "url": "https://earthquake.usgs.gov/" }
        ] 
        },
        { 
        "title": "Atmospheric Effects", 
        "content": "Dust and aerosols from a ~330 m impact darken skies locally and regionally for weeks to months. Only kilometer-scale events like Chicxulub produce long-lived global 'impact winters'.", 
        "stats": [
            { "label": "Global 'Impact Winter'", "value": "Unlikely at ~330 m" }, 
            { "label": "Cooling Duration", "value": "Days–months (regional)" }
        ], 
        "links": [
            { "text": "Chicxulub Impact Effects (comparison)", "url": "https://www.lpi.usra.edu/science/kring/Chicxulub/global-effects/" }
        ] 
        },
        { 
        "title": "Early Warning = Survival", 
        "content": "With 180 days of warning, humanity has options. Early detection transforms certain catastrophe into a solvable challenge. Multiple defense strategies (kinetic impactors, gravity tractors, civil protection) become viable with sufficient lead time.", 
        "stats": [
            { "label": "Detection Time", "value": "180 days" }, 
            { "label": "Success Rate", "value": ">95%" }
        ], 
        "links": [
            { "text": "Planetary Defense", "url": "https://www.nasa.gov/planetarydefense" }
        ] 
        },
{
    title: "Hope Through Science",
    content: "At 43.2 million kilometers away, Impactor-2025 is detected by NASA's enhanced NEO surveillance network. This early warning transforms everything. With 180 days, multiple deflection strategies become viable: kinetic impactors, gravity tractors, even nuclear options if necessary.",
    stats: [
        { label: "Detection Range", value: "389M km" },
        { label: "Response Window", value: "180 days" },

    ],
    links: [
        { text: "ESA Space Safety", url: "https://www.esa.int/Space_Safety" }
    ]
    },


{
  title: "Planetary Defense Arsenal",
  content:
    "No single method fits every asteroid. With 180 days, we must combine rapid orbit refinement with the fastest workable deflection. Kinetic impact is flight-proven (DART, 2022). Gravity tractors excel with years of lead time. Laser ablation is promising but not yet fielded.",
  stats: [
    { label: "DART Success", value: "2022 (β > 3)" },
    { label: "Methods Available", value: "3+" }
  ],
  links: [
    { text: "Become a Defender", url: "https://dart.jhuapl.edu/Planetary-Defender/" },
  ]
},

{
  title: "DART Mission Success",
  content:
    "The Double Asteroid Redirection Test (DART) impacted Dimorphos on 26 Sep 2022 at ~14,000 mph (~6.1 km/s). Telescopes confirmed a ~32-minute orbital period reduction. Ejecta acted like a rocket plume, boosting momentum transfer (β) well above 1.",
  stats: [
    { label: "Target Size", value: "≈160 m" },
    { label: "Impact Energy", value: "~11 GJ",
      tooltip: "Kinetic energy = ½ m v² ≈ 0.5 × 570 kg × (6100 m/s)² ≈ 1.06×10¹⁰ J." },
    { label: "β (Momentum Enhancement)", value: "≈2.2–4.9",
      tooltip: "β = (effective momentum transfer) / (spacecraft momentum). β>1 due to ejecta thrust." },
    { label: "Success Threshold", value: "≥ 73 s",
      tooltip: "Minimum period change chosen to unambiguously confirm a measurable deflection." }
  ],
  links: [
    { text: "DART Impact Results", url: "https://www.nasa.gov/press-release/nasa-confirms-dart-mission-impact-changed-asteroid-s-motion-in-space" },
    { text: "Mission Details", url: "https://dart.jhuapl.edu/Mission/Impactor-Spacecraft.php" }
  ]
},

    {
  title: "Gravitational Deflection",
  content:
    "A gravity tractor never touches the asteroid—ideal for fragile rubble piles. A massive spacecraft hovers offset and cancels the mutual attraction with ion thrusters, creating a continuous, gentle tug. With decade-class lead times, small steady accelerations build large miss distances.",
  stats: [
    { label: "Fuel Type", value: "Xenon" },
    { label: "Power Source", value: "Solar / RTG" },
    { label: "Standoff Control", value: "±10 m",
      tooltip: "Precision station-keeping to hold a fixed offset (tens of meters) from the surface." },
    { label: "Tug Force @ 20 t, 50 m", value: "≈0.92 N",
      tooltip: "F = G m_s m_a / r² with r≈215 m (center-to-center)." },

  ],
  links: [
    { text: "Gravity Tractor Concept", url: "https://www.nasa.gov/image-article/asteroid-redirect-mission-planetary-defense-demonstration/" },
    { text: "Ion Propulsion (Dawn heritage)", url: "https://science.nasa.gov/mission/dawn/technology/ion-propulsion/" }
  ]
    },

{
  title: "Directed Energy Defense",
  content:
    "Laser ablation vaporizes surface material; the exhaust plume pushes the asteroid. At 1 AU, a ~100 MW phased array could deliver ~10–100 N of effective thrust depending on coupling and pointing. For ~200 m bodies, ~30 N sustained over 3 years can yield an Earth-diameter miss; a 330 m body needs ~90–100 N over the same span—or more time.",
  stats: [
    { label: "Spot Size @ 1 AU", value: "≈ 10 m",
      tooltip: "Implies a very large phased aperture to limit beam spread at interplanetary ranges." },
    { label: "Surface Temp", value: "≈ 3000 K",
      tooltip: "Order needed for robust rock vaporization and plume formation." },
    { label: "System Efficiency", value: "≈ 35%",
      tooltip: "Electrical→optical→coupled thrust chain; concept-level estimate." },
    { label: "Representative Thrust", value: "~30 N",
      tooltip: "Illustrative point for 100 MW at favorable coupling; actual thrust depends on material/geometry." }
   
  ],
  links: [
    { text: "DE-STAR Research", url: "https://www.deepspace.ucsb.edu/projects/directed-energy-planetary-defense" },
  ]
},

    {
  title: "Damage Mitigation",
  content:
    "If impact is unavoidable, priority shifts to reducing casualties. Five layers of action: 1) evacuate coastal/valley zones; 2) immediate sheltering inside basements/parking structures away from windows; 3) ignition control & firebreaks; 4) backup for water, power, comms; 5) protect air quality & provide trauma care.",
  stats: [
    { label: "Priority Evacuation", value: "Coastal & valley zones" },
    { label: "Minimum Shelter Time", value: "48–72 h",
      tooltip: "Critical supplies must last until fallout of dust/debris clears and basic services restart." }
  ],
  links: [
    { text: "How do you prepare for an astreoid impact?", url: "https://www.usgs.gov/centers/astrogeology-science-center/news/asteroid-day-how-do-you-prepare-asteroid-impact" },
  ]
},

];


// ========== INITIALIZATION ==========
function init() {
    console.log('Initializing XG scene...');
    if (typeof XG === 'undefined') { console.error('XG library not loaded!'); return; }
    
    clock = new XG.Clock();
    target = new XG.Vector3();
    
    var pars = {"width": SCREEN_WIDTH, "height": SCREEN_HEIGHT, "scale": SCALE, "antialias": true, "tonemapping": XG.PhotographicOperator, "brightness": BRIGHTNESS, "clearColor": 0x020202, "clearAlpha": 1.0, "dither": true, "alpha": false, "useMultipleRenderTargets": useMRT, "backend": backend };
    container = document.getElementById('container');
	
    camera = new XG.PerspectiveCamera(17.5, SCREEN_WIDTH / SCREEN_HEIGHT, 1, 1500);
    
    camera.position.set(0, 0, 600);
    scene = new XG.Scene();
    scene.add(camera);
    dayLight = new XG.DayLight(0xffffff);
    dayLight.position.set(0, 0.5, 1).multiplyScalar(500);
    scene.add(dayLight);
    dayLight.sunIntensity = 1.5;
    if (useDeferred) { renderer = new XG.DeferredRenderer(pars); } 
    else { renderer = new XG.ForwardRenderer(pars); }
    container.appendChild(renderer.domElement);
    
    meshRoot = new XG.Node();
    meshRoot.rotation.set(0.25, 0, 0);
    scene.add(meshRoot);

    var geo512 = new XG.SphereGeometry(50, 512, 256);
    var glossMap = XG.ImageUtils.loadTexture("img/bathymetry_gloss_4k.jpg", checkLoaded);
    var bumpMap = XG.ImageUtils.loadTexture("img/bathymetry_bw_composite_4k.jpg", checkLoaded);
    
    assets.earthDiffuse = XG.ImageUtils.loadTexture("img/bathymetry_diffuse_4k.jpg", checkLoaded);

    normalMapWater = XG.ImageUtils.loadTexture("img/water-normal.jpg", checkLoaded);
    normalMapWater.wrapS = normalMapWater.wrapT = XG.RepeatWrapping;
    glossMap.wrapS = glossMap.wrapT = XG.RepeatWrapping;
    bumpMap.wrapS = bumpMap.wrapT = XG.RepeatWrapping;
    assets.earthDiffuse.wrapS = assets.earthDiffuse.wrapT = XG.RepeatWrapping;

    normalEarthMaterial = new XG.PhongMaterial({
        color: 0xffffff,
        map: assets.earthDiffuse,
        glossMap: glossMap,
        displacementMap: bumpMap,
        displacementScale: 10.0,
        shininess: 0.5,
        bumpMap: bumpMap,
        bumpScale: 0.5
    });

    var planet = new XG.Mesh(geo512, normalEarthMaterial);
    assets.planetMesh = planet;

    planet.castShadow = true; planet.receiveShadow = true;
    meshRoot.add(planet);
    
    createAsteroid();
    addWaterFancy();
    createShockwave();

    createStars();
    createRuler();
    initScrollHandler();
    initializePhysics();
    loadNASAData();
    updateProgressBar();
    infoPanelPositioner = new InfoPanelPositioner();
    animationManager = new AnimationStateManager();
    
    initLearnMoreAnimation();
    initFreeLook();

    // Enable click → take navigation on defense strategy cards
    if (typeof setupStrategyCardNavigation === 'function') {
        setupStrategyCardNavigation();
    }

    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onWindowResize, false);

    toggleUIForTake(0, 0);
    console.log('Initialization complete');
}

function createAsteroid() {
    if (typeof XG === 'undefined') return;

    function createRealisticAsteroidGeometry(radius, detail) {
        const geometry = new XG.SphereGeometry(radius, detail, detail / 2);
        const vertices = geometry.attributes.position.array;

        const applyPseudoNoise = (vertices, frequency, magnitude) => {
            for (let i = 0; i < vertices.length; i += 3) {
                const p = new XG.Vector3(vertices[i], vertices[i+1], vertices[i+2]);
                let displacement = 0;
                
                displacement += Math.sin(p.x * frequency) * Math.sin(p.y * frequency) * Math.sin(p.z * frequency);
                displacement += 0.5 * Math.sin(p.y * frequency * 2.1) * Math.sin(p.z * frequency * 2.1) * Math.sin(p.x * frequency * 2.1);
                displacement *= magnitude;
                
                const normal = p.clone().normalize();
                const finalPos = p.addSelf(normal.multiplyScalar(displacement));
                vertices[i] = finalPos.x;
                vertices[i+1] = finalPos.y;
                vertices[i+2] = finalPos.z;
            }
        };

        const addCrater = (vertices, center, radius, depth) => {
            const radiusSq = radius * radius;
            for (let i = 0; i < vertices.length; i += 3) {
                const p = new XG.Vector3(vertices[i], vertices[i+1], vertices[i+2]);
                const distSq = p.distanceToSquared(center);
                
                if (distSq < radiusSq) {
                    const falloff = 1.0 - distSq / radiusSq;
                    const smoothFalloff = falloff * falloff * (3.0 - 2.0 * falloff); 
                    
                    const displacement = center.clone().normalize().multiplyScalar(-depth * smoothFalloff);
                    p.addSelf(displacement);
                    
                    vertices[i] = p.x;
                    vertices[i+1] = p.y;
                    vertices[i+2] = p.z;
                }
            }
        };

        applyPseudoNoise(vertices, 1.2, radius * 0.15);
        applyPseudoNoise(vertices, 2.5, radius * 0.05);

        const numCraters = 15;
        for (let i = 0; i < numCraters; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const center = new XG.Vector3();
            center.set(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi)
            );

            const craterRadius = radius * (Math.random() * 0.25 + 0.1); 
            const craterDepth = craterRadius * (Math.random() * 0.5 + 0.2); 
            
            addCrater(vertices, center, craterRadius, craterDepth);
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        return geometry;
    }

    var asteroidDiffuseMap = XG.ImageUtils.loadTexture("texture_pbr_20250901.png", checkLoaded);
    var asteroidNormalMap = XG.ImageUtils.loadTexture("texture_pbr_20250901_normal.png", checkLoaded);
    var asteroidRoughnessMap = XG.ImageUtils.loadTexture("texture_pbr_20250901_roughness.png", checkLoaded);
    var asteroidMetallicMap = XG.ImageUtils.loadTexture("texture_pbr_20250901_metallic.png", checkLoaded);

    var asteroidMaterial = new XG.PhongMaterial({
        color: 0xffffff,
        map: asteroidDiffuseMap,
        bumpMap: asteroidNormalMap,
        bumpScale: 0.8,
        glossMap: asteroidRoughnessMap,
        shininess: 0.4,
        emissive: new XG.Color(0xffaa00),
        emissiveIntensity: 0
    });

    var asteroidGeo = createRealisticAsteroidGeometry(0.825, 64);
    asteroid = new XG.Mesh(asteroidGeo, asteroidMaterial);
    
    asteroid.visible = true; 
    asteroid.scale.set(0.001, 0.001, 0.001);
    asteroid.position.set(0, 0, 0);
    
    scene.add(asteroid);
}


function addWaterFancy() {
    if (typeof XG === 'undefined') return;
    var waterBlue = new XG.HeightFog({
        height: 1, visibilityDistance: 48.0, fadeSpeed: 0.8,
        shallowDepthColor: new XG.Color().setRGB(0.10, 0.48, 0.98),
        deepDepthColor: new XG.Color().setRGB(0.05, 0.10, 0.28),
        rgbExtinctionDistance: new XG.Vector3(6.0, 11.0, 30.0)
    });
    scene.heightFog = waterBlue;
    var mm = 2; var WATER_OPACITY = 0.78;
    var waterGeo = new XG.SphereGeometry(50, 256, 128);
    var innerRenderer = renderer instanceof XG.DeferredRenderer ? renderer.renderer : renderer;
    waterSurface = new XG.WaterSurface(innerRenderer, {
        clipBias: 0.0, textureWidth: 1024, textureHeight: 1024,
        specular: 0x050505, normalMap: normalMapWater, normalScale: 3,
        gloss: 0.9, repeat: [2 * mm, mm], opacity: WATER_OPACITY
    });
    var waterMaterial = waterSurface.material;
    waterMaterial.transparent = true;
    waterMaterial.defines["USE_REFLECTION"] = false;
    waterMaterial.defines["WATER_SURFACE_SPHERE"] = true;
    waterMaterial.uniforms["refractionScale"].value = 0.006;
    waterMaterial.uniforms["globalLightScale"].value = 0.035;
    waterMaterial.isMirror = true;
    waterMesh = new XG.Mesh(waterGeo, waterMaterial);
    waterMesh.scale.multiplyScalar(1.11);
    waterMesh.receiveShadow = true;
    waterMesh.add(waterSurface);
    meshRoot.add(waterMesh);
    scene.properties = scene.properties || {};
    scene.properties.mirrors = [waterSurface];
}

function createShockwave() {
    if (typeof XG === 'undefined' || shockwave) return;
    const shockwaveGeo = new XG.RingGeometry(0.1, 20, 64);
    const shockwaveMat = new XG.EmissiveMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: XG.DoubleSide });
    shockwave = new XG.Mesh(shockwaveGeo, shockwaveMat);
    shockwave.visible = false;
    shockwave.rotation.x = -Math.PI / 2;
    meshRoot.add(shockwave);
}

function checkLoaded() {
    loadCounter += 1;
    console.log(`Loaded ${loadCounter}/8 textures`); 
    if (loadCounter >= 8) {
        console.log("Main scene textures loaded and ready.");
        window.mainSceneReady = true;
        isResourcesReady = true; // NEW: Set resources ready flag
        
        // NEW: If experience was waiting for resources, start it now
        if (window.pendingExperienceStart) {
            window.pendingExperienceStart();
            window.pendingExperienceStart = null;
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    if (!clock || !renderer || !scene || !camera) return;
    var rawDelta = clock.getDelta();
    if (waterSurface) waterSurface.material.uniforms.time.value += 0.01;
    if (asteroid && asteroid.visible) {
        asteroid.rotation.x += 0.012; asteroid.rotation.y += 0.008;
    }
    if (freeLook) {
        targetX = mouseX * 0.04; targetY = mouseY * 0.04;
        angle += 0.05 * (targetX - angle); height += 0.05 * (targetY - height);
        
        var d;
        if (currentSection === 3 || currentSection === 4 || currentSection === 5) {
            d = 30; 
        } else {
            d = 380; 
        }

        var n = 0.075;
        var x = -Math.sin(angle * n) * d; var z = Math.cos(angle * n) * d;
        var y = 15.5 * height + 0;
        camera.position.set(x, y, z);
        camera.lookAt(target);
    } else if (!animationManager.isAnimating && rotationEnabled) {
        meshRoot.rotation.y += rawDelta * 0.05;
    }
    renderer.render(scene, camera);
}

// ========== UI FUNCTIONS ==========
function revealSectionContent(index, delay = 600) {
    const section = document.getElementById(`section-${index}`);
    if (!section) return;

    section.classList.add('active');
    section.style.opacity = 1;
    const elements = section.querySelectorAll('.section-number, .section-title, .section-subtitle, .section-text, .data-grid, .data-card, .hero-button, .countdown-card');
    
    if (typeof anime !== 'undefined') {
        anime.set(elements, { opacity: 0, translateY: '20px' });
        anime({
            targets: elements,
            opacity: 1,
            translateY: '0px',
            duration: 800,
            easing: 'easeOutQuad',
            delay: anime.stagger(100, { start: delay })
        });
    } else {
        elements.forEach(el => {
            el.style.opacity = 1;
            el.style.transform = 'translateY(0)';
        });
    }

        // Trigger per-take scramble text
    if (window.ScrambleStory) {
        const after = (typeof anime !== 'undefined') ? (delay + 200) : 0;
        setTimeout(() => window.ScrambleStory.runForSection(index), after);
    }
}

function showScrollWarning() {
    const warningEl = document.getElementById('scroll-warning');
    const activeSection = document.querySelector('.content-section.active');
    if (!warningEl || !activeSection) return;

    activeSection.appendChild(warningEl);
    clearTimeout(scrollWarningTimeout);

    warningEl.style.display = 'inline-block';
    setTimeout(() => {
        warningEl.style.opacity = '1';
    }, 10);

    scrollWarningTimeout = setTimeout(() => {
        warningEl.style.opacity = '0';
        setTimeout(() => {
            warningEl.style.display = 'none';
        }, 300);
    }, 2000);
}

function hideInfoPanel() {
    if (!isPanelVisible) return;
    isPanelVisible = false;

    if (asteroidWatchInterval) {
        clearInterval(asteroidWatchInterval);
        asteroidWatchInterval = null;
    }

    const panel = document.getElementById('info-panel');
    if (!panel) return;

    const widget = panel.querySelector('#asteroid-watch-widget');
    if (widget) {
        widget.remove();
    }
    
    anime.remove(panel);
    anime({
        targets: panel,
        duration: 300,
        easing: 'easeInCubic',
        opacity: 0,
        translateY: 20,
        scale: 0.98,
        complete: () => {
            panel.style.pointerEvents = 'none';
            panel.classList.remove('is-widget');
            const contentWrapper = document.getElementById('info-panel-content-wrapper');
            if (contentWrapper) contentWrapper.style.display = 'block';
            const previewContainer = panel.querySelector('.preview-container');
            if (previewContainer) previewContainer.style.display = 'flex';
        }
    });
}

function showInfoPanel(index) {
    // FIX: Simplified logic - always update panel if data exists
    if (isPanelVisible && currentSection === index) return; // Only skip if same section
    
    isPanelVisible = true;

    const panel = document.getElementById('info-panel');
    const data = infoData[index];
    if (!panel || !data) {
        isPanelVisible = false;
        return;
    };

    const contentWrapper = document.getElementById('info-panel-content-wrapper');
    const previewContainer = panel.querySelector('.preview-container');

    if (data.type === 'widget' && data.widgetId === 'asteroid-watch') {
        panel.classList.add('is-widget');
        contentWrapper.style.display = 'none';
        previewContainer.style.display = 'none';
        createAsteroidWatchWidget(panel); 
    } 
    else {
        panel.classList.remove('is-widget');
        contentWrapper.style.display = 'block';
        previewContainer.style.display = 'flex';

        const titleEl = contentWrapper.querySelector('.info-title');
        if (titleEl) titleEl.textContent = data.title;
        const contentEl = contentWrapper.querySelector('#info-content');
        if (contentEl) contentEl.textContent = data.content;
        const statsEl = contentWrapper.querySelector('#info-stats');
        if (statsEl) {
            statsEl.innerHTML = data.stats ? data.stats.map(stat => `
                <div class="info-stat"><div class="info-stat-label">${stat.label}</div><div class="info-stat-value">${stat.value}</div></div>
            `).join('') : '';
        }
        const linksEl = contentWrapper.querySelector('#info-links');
        if (linksEl) {
            linksEl.innerHTML = data.links ? data.links.map(link => `
                <a href="${link.url}" target="_blank" class="info-link">${link.text}</a>
            `).join('') : '';
        }
        setupPreviewHandlers(index);
    }

    if (infoPanelPositioner) {
        infoPanelPositioner.updatePosition(index);
    }

    panel.style.pointerEvents = 'all';
    anime.remove(panel);
    anime({
        targets: panel,
        duration: 600,
        easing: 'easeOutCubic',
        opacity: [0, 1],
        translateY: [20, 0],
        scale: [0.98, 1]
    });
}


function createStars() {
    const starsContainer = document.getElementById('stars');
    if (!starsContainer) return;
    for (let i = 0; i < 200; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.style.animationDuration = (3 + Math.random() * 3) + 's';
        starsContainer.appendChild(star);
        stars.push(star);
    }
}

function createRuler() {
    const markersContainer = document.getElementById('ruler-markers');
    const indicator = document.getElementById('ruler-indicator');
    if (!markersContainer) return;
    for (let i = 0; i < totalSections; i++) {
        const marker = document.createElement('div');
        marker.className = 'ruler-marker';
        if (i === 0) marker.classList.add('active');
        marker.style.top = (i * (100 / (totalSections - 1))) + '%';
        marker.addEventListener('click', () => { if (inputLocked) return; navigateToSection(i); });
markersContainer.appendChild(marker);
    }
    if(indicator) indicator.style.top = '0%';
}

function initScrollHandler() {
    let touchStartY = 0;
    const handleScroll = (down) => {
        if (inputLocked) return;
        if (!isExperienceStarted || isTransitioning) return;
        if (freeLook) {
            showScrollWarning();
            return;
        }
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (down && currentSection < totalSections - 1) {
                navigateToSection(currentSection + 1);
            } else if (!down && currentSection > 0) {
                navigateToSection(currentSection - 1);
            }
        }, 100);
    };
    window.addEventListener('wheel', (e) => { e.preventDefault(); handleScroll(e.deltaY > 0); }, { passive: false });
    window.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; });
    window.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touchEndY = e.touches[0].clientY;
        if (Math.abs(touchStartY - touchEndY) > 30) {
            handleScroll(touchStartY - touchEndY > 0);
            touchStartY = touchEndY;
        }
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); handleScroll(true); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); handleScroll(false); }
    });
}

function toggleUIForTake(index, duration = 600) {
    const uiElements = [
        document.querySelector('.nav-ruler'),
        document.querySelector('.hud-top-right'),
    ];
    const learnMoreButton = document.getElementById('learn-more-button');

    const shouldShowUI = index !== 0;
    const shouldShowButton = index === 0;

    if (typeof anime !== 'undefined') {
        anime({
            targets: uiElements,
            opacity: shouldShowUI ? 1 : 0,
            translateX: shouldShowUI ? '0%' : '100px',
            duration: duration,
            easing: 'easeInOutCubic',
            begin: (anim) => {
                uiElements.forEach(el => {
                    if (el) el.style.pointerEvents = shouldShowUI ? 'all' : 'none';
                });
            }
        });

        if (learnMoreButton) {
            anime({
                targets: learnMoreButton,
                opacity: shouldShowButton ? 1 : 0,
                translateY: shouldShowButton ? '0%' : '100%',
                duration: duration,
                easing: 'easeInOutCubic',
                begin: () => {
                    learnMoreButton.style.pointerEvents = shouldShowButton ? 'all' : 'none';
                }
            });
        }
    }
}

function initLearnMoreAnimation() {
    const arrows = document.querySelectorAll('.learn-more-button .arrow');
    if (arrows.length > 0 && typeof anime !== 'undefined') {
        anime.timeline({
            targets: arrows,
            loop: true
        }).add({
            translateY: [0, 10],
            opacity: [1, 0],
            duration: 1500,
            delay: anime.stagger(200),
            easing: 'easeInOutQuad'
        });
    }
}

function initFreeLook() {
    const button = document.getElementById('free-look-toggle');
    if (button) {
        button.addEventListener('click', () => {
            const event = new KeyboardEvent('keydown', { 'key': 'l' });
            document.dispatchEvent(event);
        });
    }
}

function updateFreeLookButton() {
    const button = document.getElementById('free-look-toggle');
    if (!button) return;

    const textTo = freeLook 
        ? 'Press [L] to disable' 
        : 'Press [L] to enable free look';
    
    if (freeLook) {
        button.style.backgroundColor = '#F6AD06';
        button.style.color = '#000000';
        button.style.borderColor = '#F6AD06';
    } else {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        button.style.color = 'var(--accent)';
        button.style.borderColor = 'var(--accent)';
    }
    
    if (typeof anime !== 'undefined') {
        anime({
            targets: button,
            opacity: 0,
            duration: 200,
            easing: 'easeOutQuad',
            complete: () => {
                button.textContent = textTo;
                anime({
                    targets: button,
                    opacity: 1,
                    duration: 300,
                    easing: 'easeInQuad'
                });
            }
        });
    } else {
        button.textContent = textTo;
    }
}


// ========== STRATEGY CARD → TAKE NAVIGATION ==========
function setupStrategyCardNavigation() {
    try {
        const map = { kinetic: 15, gravity: 16, laser: 17 }; // Take numbers (0-indexed ids)
        const cards = document.querySelectorAll('.strategy-card');
        if (!cards || cards.length === 0) return;
        cards.forEach((card) => {
            const key = card.getAttribute('data-strategy');
            const targetIndex = map[key];
            if (typeof targetIndex === 'number') {
                // Make it feel interactive
                card.style.cursor = 'pointer';
                // Click to navigate
                card.addEventListener('click', (e) => {
                    if (typeof navigateToSection !== 'function') return;
                    if (typeof inputLocked !== 'undefined' && inputLocked) return;
                    e.preventDefault();
                    navigateToSection(targetIndex);
                });
                // Keyboard access: Enter / Space
                card.setAttribute('tabindex', '0');
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigateToSection(targetIndex);
                    }
                });
            }
        });
    } catch (err) {
        console.error('setupStrategyCardNavigation error:', err);
    }
}

// ========== CUTSCENE INPUT LOCK (mouse/scroll/clicks) ==========
function lockInput() {
    inputLocked = true;
    // Disable pointer interactions on the navigation ruler during cutscenes
    const nav = document.querySelector('.nav-ruler');
    if (nav) nav.style.pointerEvents = 'none';
}

function unlockInput() {
    inputLocked = false;
    const nav = document.querySelector('.nav-ruler');
    if (nav) nav.style.pointerEvents = '';
}

function navigateToSection(index) {
    // BUG FIX: If the interruptible "Take 13" animation is running,
    // clean it up and reset the transition lock to allow new navigation.
    if (window.take13Timeline) {
        cleanupTake13Animation();
        isTransitioning = false;
    }

    if (isTransitioning || index === currentSection || index < 0 || index >= totalSections) return;
    
    // FIX: Complete cleanup before starting new navigation
    if (typeof anime !== 'undefined') {
        // Stop ALL anime animations
        anime.running.forEach(anim => anim.pause());
        
        // Remove animations from all possible targets
        const allContent = document.querySelectorAll('.section-number, .section-title, .section-subtitle, .section-text, .data-grid, .data-card, .hero-button, .countdown-card');
        anime.remove(allContent);
        
        // Clear animation manager animations
        if (animationManager) {
            animationManager.clearAnimations();
        }
    }
    
    isTransitioning = true;

    hideInfoPanel();
    
    // Clean up take 7 specific effects
    if (currentSection === 7 && index !== 7) {
        if (asteroid) {
            if (asteroid.materials && asteroid.materials[0]) {
                asteroid.materials[0].emissiveIntensity = 0;
                asteroid.materials[0].emissive = new XG.Color(0xffaa00);
            }
        }
    }
    
    const oldSection = document.getElementById(`section-${currentSection}`);
    if (oldSection) {
        oldSection.classList.remove('active');
        oldSection.style.opacity = 0;
        // Immediately hide old content
        const oldElements = oldSection.querySelectorAll('.section-number, .section-title, .section-subtitle, .section-text, .data-grid, .data-card, .hero-button, .countdown-card');
        oldElements.forEach(el => {
            el.style.opacity = 0;
            el.style.transform = 'translateY(-10px)';
        });
    }

    const newSection = document.getElementById(`section-${index}`);
    if (newSection) {
        revealSectionContent(index, 600);
    }
    
    // Special transitions
    if (currentSection === 6 && index === 7) {
        const overlay = document.getElementById('fade-overlay');
        if (overlay) {
            anime({
                targets: overlay,
                opacity: 1,
                duration: 1000,
                easing: 'easeInQuad'
            });
        }
    } 
    else if (currentSection === 11 && index === 12) {
        animateTake13Transition();
    } 
    else if (animationManager && index !== 7) {
        animationManager.transitionToState(index, 2500);
    }
    
    // Update UI elements
    document.querySelectorAll('.ruler-marker').forEach((m, i) => m.classList.toggle('active', i === index));
    const indicator = document.getElementById('ruler-indicator');
    if (indicator) indicator.style.top = (index * (100 / (totalSections - 1))) + '%';

    // Schedule info panel after animation
    if (animationManager) {
        animationManager.pendingAnimation = setTimeout(() => showInfoPanel(index), 1200);
    } else {
        setTimeout(() => showInfoPanel(index), 1200);
    }
    
    toggleUIForTake(index);
    applyTakeEffects(index);
    updateDistanceForTake(index);
    // Disable and hide Free Look during Take 08 (index 7) — cutscene lock
    (function() {
        const flBtn = document.getElementById('free-look-toggle');
        if (!flBtn) return;
        if (index === 7) {
            // Ensure Free Look is OFF and hide the toggle
            if (freeLook) { freeLook = false; }
            flBtn.style.display = 'none';
        } else {
            // Restore the toggle outside the cutscene
            flBtn.style.display = '';
            updateFreeLookButton();
        }
    })();

    
    
    // Hide 'Skip to the end' during Take 08 (index 7) to prioritize the cutscene
    (function() {
        const skipBtn = document.querySelector('.bottom-left-controls button[onclick="skipToEnd()"]');
        if (!skipBtn) return;
        if (index === 7) {
            skipBtn.style.display = 'none';
        } else {
            skipBtn.style.display = '';
        }
    })();
const skipButton = document.getElementById('skip-button');
    if (skipButton) {
        if (index === 19) { skipButton.textContent = 'Restart Story'; } 
        else { skipButton.textContent = 'Skip to Simulator →'; }
    }

    currentSection = index;
    updateProgressBar();
    
    setTimeout(() => {
        isTransitioning = false;
        if (index === 7) {
            animateTake08();
        } else {
            startTakeAnimation(index);
        }
    }, 2500);
}

function animateTake13Transition() {
    lockInput();
const overlay = document.getElementById('fade-overlay');
    const message = document.getElementById('secondChanceMessage');
    
    // Store animation reference globally to allow interruption
    window.take13Timeline = null;
    window.take13Timeout = null;
    
    if (overlay && message) {
        // Clear any existing take 13 animations
        if (window.take13Timeline) {
            window.take13Timeline.pause();
            window.take13Timeline = null;
        }
        if (window.take13Timeout) {
            clearTimeout(window.take13Timeout);
            window.take13Timeout = null;
        }
        
        window.take13Timeline = anime.timeline({
            complete: () => {
                                unlockInput();
// Clean up the message and overlay
                message.style.opacity = '0';
                overlay.style.opacity = '0';
                window.take13Timeline = null;
                
                if (animationManager) {
                    animationManager.transitionToState(12, 3000);
                }
            }
        })
        .add({
            targets: overlay,
            opacity: [0, 1],
            duration: 2000,
            easing: 'easeInOutQuad'
        })
        .add({
            targets: message,
            opacity: [0, 1],
            duration: 1500,
            easing: 'easeOutQuad'
        }, 2000)
        .add({
            targets: message,
            opacity: 1,
            duration: 3000
        })
        .add({
            targets: message,
            opacity: [1, 0],
            duration: 1000,
            easing: 'easeInQuad'
        })
        .add({
            targets: overlay,
            opacity: [1, 0],
            duration: 2000,
            easing: 'easeOutQuad'
        }, '-=500');
        
        if (dayLight) {
            anime({
                targets: dayLight,
                sunIntensity: 0.8,
                duration: 4000,
                easing: 'easeInOutQuad'
            });
        }
        
        window.take13Timeout = setTimeout(() => {
            if (dayLight) {
                anime({
                    targets: dayLight,
                    sunIntensity: 1.5,
                    duration: 2000,
                    easing: 'easeInOutQuad'
                });
            }
            window.take13Timeout = null;
        }, 8000);
    } else {
        if (animationManager) {
            animationManager.transitionToState(12, 2500);
        }
    }
}

function cleanupTake13Animation() {
    // Helper function to clean up take 13 animation
    const overlay = document.getElementById('fade-overlay');
    const message = document.getElementById('secondChanceMessage');
    
    if (window.take13Timeline) {
        window.take13Timeline.pause();
        window.take13Timeline = null;
    }
    
    if (window.take13Timeout) {
        clearTimeout(window.take13Timeout);
        window.take13Timeout = null;
    }
    
    // Reset visual states
    if (overlay) {
        anime.remove(overlay);
        overlay.style.opacity = '0';
    }
    
    if (message) {
        anime.remove(message);
        message.style.opacity = '0';
    }
    
    // Reset light intensity
    if (dayLight) {
        anime.remove(dayLight);
        dayLight.sunIntensity = 1.5;
    
}

    // Ensure input is restored if we abort the cutscene
    unlockInput();
}

function updateProgressBar() {
    const percentage = (currentSection / (totalSections - 1)) * 100;
    const progressBar = document.getElementById('storyProgress');
    if (progressBar) progressBar.style.width = `${percentage}%`;
    const currentStep = document.getElementById('currentStep');
    if (currentStep) currentStep.textContent = currentSection + 1;
    const totalSteps = document.getElementById('totalSteps');
    if (totalSteps) totalSteps.textContent = totalSections;
}

function initializePhysics() {
    physics = new ImpactPhysics();
    const asteroidMass = 8.1e9; const asteroidVelocity = 25000;
    const impactEnergy = physics.calculateImpactEnergy(asteroidMass, asteroidVelocity);
    const craterSize = physics.calculateCraterDiameter(impactEnergy);
    const seismicMag = physics.calculateSeismicMagnitude(impactEnergy);
    
    const energyEl = document.getElementById('impact-energy');
    if (energyEl) energyEl.textContent = impactEnergy.toFixed(0);
    const craterEl = document.getElementById('crater-size');
    if (craterEl) craterEl.textContent = (craterSize/1000).toFixed(1);
    const seismicEl = document.getElementById('seismic-mag');
    if (seismicEl) seismicEl.textContent = seismicMag.toFixed(1);
}

async function loadNASAData() {
    nasaData = new NASADataIntegration();
    const today = new Date().toISOString().split('T')[0];
    const neosTrackedEl = document.getElementById('neos-tracked');
    const timestampEl = document.getElementById('neo-timestamp');
    const cardEl = document.getElementById('daily-neo-card');

    try {
        const data = await nasaData.fetchNearEarthObjects();
        if (neosTrackedEl) neosTrackedEl.textContent = data.totalTracked.toLocaleString();
        if (timestampEl) timestampEl.textContent = `Data for: ${today}`;
        if (cardEl) {
            cardEl.classList.add('live-data-loaded');
            setTimeout(() => cardEl.classList.remove('live-data-loaded'), 1000);
        }
    } catch (error) {
        if (neosTrackedEl) neosTrackedEl.textContent = 'N/A';
        if (timestampEl) timestampEl.textContent = 'NASA API Error';
    }
}

function applyTakeEffects(index) {
    const warningOverlay = document.getElementById('warning-overlay');
    const successOverlay = document.getElementById('success-overlay');
    const impactAlert = document.getElementById('impact-alert');
    if (warningOverlay) warningOverlay.classList.remove('active');
    if (successOverlay) successOverlay.classList.remove('active');
    if (impactAlert) impactAlert.classList.remove('active');
    if ([3, 6, 13, 15].includes(index) && warningOverlay) warningOverlay.classList.add('active');
    if ([9, 12, 16, 18, 19].includes(index) && successOverlay) successOverlay.classList.add('active');
}

function updateDistanceForTake(index) {
    const distances = [
        750000000, 700000000, 500000000, 390000000, 15120000, 10500000, 2160000, 400000, 
        0, 0, 0, 0, 43200000, 43200000, 0, 0, 0, 0, 0, 0
    ];
    updateDistance(distances[index]);
}

function updateDistance(km) {
    const formatted = km > 0 ? km.toLocaleString() + ' KM' : 'IMPACT';
    const distanceEl = document.getElementById('distance');
    if (distanceEl) {
        distanceEl.textContent = formatted;
        if (km === 0) {
            distanceEl.style.color = 'var(--danger)';
        } else if (km < 100000) {
            distanceEl.style.color = 'var(--danger)';
        } else if (km < 2000000) {
            distanceEl.style.color = 'var(--warning)';
        } else {
            distanceEl.style.color = 'var(--text-dim)';
        }
    }
}

function startTakeAnimation(index) {
    if (!animationManager) return;
    animationManager.clearAnimations();
    // Take 16 (index 15): REMOVIDO banner !MPACT e tremor da câmera
if (index === 15 && asteroid && asteroid.visible) {
    // Intencionalmente vazio – sem alerta e sem shake no take 16
}

// Take 11 (index 10): tremor da câmera deslocado para 'Seismic impacts'
if (index === 10) {
    if (typeof anime !== 'undefined') {
        animationManager.currentAnimations.push(
            anime({
                targets: camera.position.data,
                0: [camera.position.x, camera.position.x + 5, camera.position.x - 5, camera.position.x],
                1: [camera.position.y, camera.position.y + 5, camera.position.y - 5, camera.position.y],
                duration: 200, loop: 5, direction: 'alternate', easing: 'easeInOutQuad'
            })
        );
    }
}

}

const particleGeo = new XG.SphereGeometry(0.2, 8, 8);
const particleMat = new XG.EmissiveMaterial({
    color: 0xffddaa,
    transparent: true,
    opacity: 0.8,
    blending: XG.AdditiveBlending
});


function animateTake08() {
    // trava input durante a cutscene
    lockInput();
    animationManager.clearAnimations();

    const overlay = document.getElementById('fade-overlay');

    // DURAÇÕES
    const totalDuration = 15000;
    const setupDuration = 1000;
    const impactDuration = totalDuration - setupDuration;

    // Alvo do impacto (mantém seu ponto no Brasil)
    const earthRadius = 50;
    const lat = -28.0 * (Math.PI / 180);
    const lon = -28.0 * (Math.PI / 180);
    const brazilRotationY = -lon - Math.PI / 2;

    const impactPoint = new XG.Vector3(
        earthRadius * Math.cos(lat) * Math.sin(lon),
        earthRadius * Math.sin(lat),
        earthRadius * Math.cos(lat) * Math.cos(lon)
    );

    // Posições inicial/final do meteoro (iguais às suas)
    const asteroidStartPos = { x: 0, y: 100, z: 300 };
    const asteroidEndPos = {
        x: impactPoint.x * 1.05,
        y: impactPoint.y * 1.05,
        z: impactPoint.z * 1.05
    };

    // === NOVO: Base da câmera lateral (sem usar XG.Vector3.cross) ===
    // dir = direção de queda (normalizada)
    const dir = new XG.Vector3(
        asteroidEndPos.x - asteroidStartPos.x,
        asteroidEndPos.y - asteroidStartPos.y,
        asteroidEndPos.z - asteroidStartPos.z
    );
    const lenDir = Math.max(1e-6, Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z));
    dir.x /= lenDir; dir.y /= lenDir; dir.z /= lenDir;

    // up “mundo”
    let up = new XG.Vector3(0, 1, 0);

    // cross manual: right = dir × up
    function cross(a, b) {
        return new XG.Vector3(
            a.y * b.z - a.z * b.y,
            a.z * b.x - a.x * b.z,
            a.x * b.y - a.y * b.x
        );
    }

    let right = cross(dir, up);
    let rightLen = Math.sqrt(right.x * right.x + right.y * right.y + right.z * right.z);

    // fallback se dir ~ paralelo a up → use outro up
    if (rightLen < 1e-5) {
        up = new XG.Vector3(0, 0, 1);
        right = cross(dir, up);
        rightLen = Math.max(1e-6, Math.sqrt(right.x * right.x + right.y * right.y + right.z * right.z));
    }
    // normaliza right
    right.x /= rightLen; right.y /= rightLen; right.z /= rightLen;

    // Distâncias para a vista “de lado” (pode ajustar a gosto)
    const SIDE_DIST = 3.0;   // afastamento lateral
    const UP_DIST   = 1.5;    // ligeiro acima
    const BACK_DIST = 30.0;    // um pouco atrás ao longo de -dir (0 = bem lateral)

    function cameraSideFrom(astPos) {
        return new XG.Vector3(
            astPos.x + right.x * SIDE_DIST + up.x * UP_DIST - dir.x * BACK_DIST,
            astPos.y + right.y * SIDE_DIST + up.y * UP_DIST - dir.y * BACK_DIST,
            astPos.z + right.z * SIDE_DIST + up.z * UP_DIST - dir.z * BACK_DIST
        );
    }
    // === Fim da base lateral ===

    // Prepara meteoro
    asteroid.visible = true;
    asteroid.scale.set(0.25, 0.25, 0.25);
    asteroid.position.set(asteroidStartPos.x, asteroidStartPos.y, asteroidStartPos.z);
    if (asteroid.materials && asteroid.materials[0]) {
        asteroid.materials[0].emissiveIntensity = 0;
    }

    // Posição inicial da câmera: já lateral ao meteoro
    const camStart = cameraSideFrom(new XG.Vector3(asteroidStartPos.x, asteroidStartPos.y, asteroidStartPos.z));
    camera.position.set(camStart.x, camStart.y, camStart.z);
    camera.lookAt(new XG.Vector3(asteroidStartPos.x, asteroidStartPos.y, asteroidStartPos.z));

    // Timeline
    const timeline = anime.timeline({
        easing: 'linear',
        complete: () => {
            unlockInput();

            // Garantia do alerta !MPACT no final
            if (!impactAlertFired_T8) {
                const _el = document.getElementById('impact-alert');
                if (_el) {
                    _el.classList.add('active');
                    setTimeout(() => _el.classList.remove('active'), 1500);
                }
                impactAlertFired_T8 = true;
            }

            // Pico de emissivo
            if (asteroid && asteroid.materials && asteroid.materials[0]) {
                anime({
                    targets: asteroid.materials[0],
                    emissiveIntensity: [8.0, 12.0, 8.0],
                    duration: 300,
                    easing: 'easeInOutQuad'
                });
            }

            // Tremor de câmera
            anime({
                targets: camera.position.data,
                0: [camera.position.x, camera.position.x + 10, camera.position.x - 10, camera.position.x],
                1: [camera.position.y, camera.position.y + 10, camera.position.y - 10, camera.position.y],
                2: [camera.position.z, camera.position.z + 10, camera.position.z - 10, camera.position.z],
                duration: 500,
                loop: 2,
                direction: 'alternate',
                easing: 'easeInOutQuad'
            });

            // Avança automaticamente para o próximo take
            setTimeout(() => { try { navigateToSection(8); } catch(e) { console.warn(e); } }, 800);
        }
    });

    if (overlay) {
        timeline.add({
            targets: overlay,
            opacity: 0,
            duration: 1200,
            easing: 'easeOutQuad'
        }, 0);
    }

    // Gira a Terra para alinhar o Brasil (mantido)
    timeline.add({
        targets: meshRoot.rotation.data,
        1: brazilRotationY,
        0: 0.2,
        duration: totalDuration,
        easing: 'easeInOutQuad'
    }, 0);

    let lastParticleTime = 0;

    // Queda do meteoro
    timeline.add({
        targets: asteroid.position.data,
        0: [asteroidStartPos.x, asteroidEndPos.x],
        1: [asteroidStartPos.y, asteroidEndPos.y],
        2: [asteroidStartPos.z, asteroidEndPos.z],
        duration: impactDuration,
        delay: setupDuration,
        easing: 'easeInQuad',
        update: () => {
            // Atualiza câmera sempre do lado do meteoro (vista lateral)
            const ap = asteroid.position; // XG.Vector3
            const camPos = cameraSideFrom(ap);
            camera.position.set(camPos.x, camPos.y, camPos.z);
            camera.lookAt(ap);

            // pequena rotação do meteoro
            asteroid.rotation.x += 0.02;
            asteroid.rotation.y += 0.015;

            // partículas de trilha (mantidas)
            const now = performance.now();
            if (now - lastParticleTime > 25) {
                lastParticleTime = now;
                const particle = new XG.Mesh(particleGeo, particleMat.clone());
                particle.position.copy(asteroid.position);
                scene.add(particle);
                const spread = 2.5;
                anime({
                    targets: particle.position.data,
                    0: particle.position.x + (Math.random() - 0.5) * spread,
                    1: particle.position.y + (Math.random() - 0.5) * spread,
                    2: particle.position.z + (Math.random() - 0.5) * spread,
                    duration: 1500,
                    easing: 'easeOutQuad'
                });
                anime({
                    targets: particle.material,
                    opacity: 0,
                    duration: 1500,
                    easing: 'easeOutQuad',
                    complete: () => scene.remove(particle)
                });
                anime({
                    targets: particle.scale.data,
                    0: 0.01, 1: 0.01, 2: 0.01,
                    duration: 1500,
                    easing: 'easeInQuad'
                });
            }
        }
    }, 0);

    // Brilho/“aquecimento” do meteoro (mantido)
    timeline.add({
        targets: asteroid.materials && asteroid.materials[0] ? asteroid.materials[0] : {},
        emissiveIntensity: [0, 8.0],
        duration: impactDuration * 0.7,
        delay: setupDuration + impactDuration * 0.3,
        easing: 'easeInExpo'
    }, 0);

    // Gradiente de cor emissiva durante a queda (mantido)
    timeline.add({
        duration: impactDuration * 0.5,
        delay: setupDuration + impactDuration * 0.5,
        update: (anim) => {
            const progress = anim.progress / 100;
            const r = 1.0;
            const g = 0.67 + (0.87 - 0.67) * progress;
            const b = 0.0 + (0.67 - 0.0) * progress;
            if (asteroid && asteroid.materials && asteroid.materials[0]?.emissive?.setRGB) {
                asteroid.materials[0].emissive.setRGB(r, g, b);
            }
        }
    }, 0);

    // Contagem regressiva do painel do take 08 (mantido)
    const countdown = { minutes: 60 };
    let impactAlertFired_T8 = false;
    const statsEl = document.querySelector('#info-stats');
    if (statsEl && currentSection === 7) {
        statsEl.innerHTML = `<div class="info-stat"><div class="info-stat-label">TIME TO IMPACT</div><div class="info-stat-value" id="impact-countdown">T-60:00</div></div>`;
    }
    timeline.add({
        targets: countdown,
        minutes: 0,
        duration: impactDuration,
        delay: setupDuration,
        easing: 'linear',
        update: () => {
            const mins = Math.floor(countdown.minutes);
            const secs = Math.floor((countdown.minutes - mins) * 60);
            const timeString = `T-${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            const countdownEl = document.getElementById('impact-countdown');
            if (countdownEl) {
                countdownEl.textContent = timeString;
                if (!impactAlertFired_T8 && mins <= 0 && secs <= 0) {
                    const el = document.getElementById('impact-alert');
                    if (el) {
                        el.classList.add('active');
                        setTimeout(() => el.classList.remove('active'), 1500);
                    }
                    impactAlertFired_T8 = true;
                }
            }
        }
    }, 0);

    // registra para permitir cleanup
    animationManager.currentAnimations.push(timeline);
}

// ========== EVENT HANDLERS ==========
function onDocumentMouseMove(event) {
    if (freeLook) { mouseX = (event.clientX - windowHalfX) * 1; mouseY = (event.clientY - windowHalfY) * 1; }
}

function onKeyDown(event) {
    if (inputLocked) { if (event && typeof event.preventDefault === 'function') event.preventDefault(); return; }
if (event.key.toLowerCase() === 'l') {
        // Disable free look during Take 08 (index 7) — this is a cutscene
        if (currentSection === 7) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            return; // Ignore 'L' while the cutscene is playing
        }
        freeLook = !freeLook;
        updateFreeLookButton();
        if (freeLook) {
            if (animationManager) animationManager.clearAnimations();
            isTransitioning = true; 
        } else {
            isTransitioning = false; 
            navigateToSection(currentSection);
        }
    }
}

function onWindowResize(event) {
    SCREEN_WIDTH = window.innerWidth; SCREEN_HEIGHT = window.innerHeight;
    windowHalfX = SCREEN_WIDTH / 2; windowHalfY = SCREEN_HEIGHT / 2;
    if (renderer) renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    if (camera) { camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT; camera.updateProjectionMatrix(); }
}

// ========== GLOBAL FUNCTIONS ==========
// Replace both occurrences of skipToEnd with this version
window.skipToEnd = function () {
  const lastIndex = totalSections - 1; // 20 takes -> índice final = 19
  if (currentSection === lastIndex) {
    // Estamos no take 20 → voltar ao topo (take 01)
    navigateToSection(0);
  } else {
    // Ainda não estamos no último → pular para o final (take 20)
    navigateToSection(lastIndex);
  }
};


// ========== OPTIMIZED INITIAL LOAD FUNCTION ==========
window.startMainExperience = function() {
    console.log('startMainExperience called!');
    
    // NEW: Check if resources are ready
    if (!isResourcesReady) {
        console.log('Resources not ready yet, waiting...');
        window.pendingExperienceStart = window.startMainExperience;
        return;
    }
    
    const introContainer = document.getElementById('introContainer');
    if (introContainer && !introContainer.classList.contains('hidden')) {
        introContainer.classList.add('hidden');
    }
    
    currentSection = 0;
    
    toggleUIForTake(0, 0);
    
    const section0 = document.getElementById('section-0');
    if (section0) {
        section0.style.opacity = '1';
        section0.classList.add('active');
    // Start scramble for first take
    if (window.ScrambleStory) { setTimeout(() => window.ScrambleStory.runForSection(0), 250); }
        
        const elements = section0.querySelectorAll('.section-number, .section-title, .section-subtitle, .section-text, .data-grid, .data-card, .hero-button, .countdown-card');
        
        if (typeof anime !== 'undefined') {
            anime.set(elements, { opacity: 0, translateY: '20px' });
            anime({
                targets: elements,
                opacity: 1,
                translateY: '0px',
                duration: 800,
                easing: 'easeOutQuad',
                delay: anime.stagger(100, { start: 0 })
            });
        } else {
            elements.forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            });
        }
    } else {
        console.error('Section 0 not found!');
    }
    
    setTimeout(() => {
        if (infoPanelPositioner) {
            infoPanelPositioner.updatePosition(0);
        }
        showInfoPanel(0);
        
        // NEW: Enable scrolling after everything is ready
        isExperienceStarted = true;
    }, 500);
    
    const skipButton = document.getElementById('skip-button');
    if (skipButton) {
        skipButton.classList.add('visible');
    }
    
    console.log('startMainExperience completed');
};

// ========== START APPLICATION ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting initialization...');
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.error('WebGL not supported!');
        alert('Your browser does not support WebGL. Please use a modern browser.');
        return;
    }
    setTimeout(() => {
        if (typeof XG === 'undefined') {
            console.error('XG library not found!');
            return;
        }
        init();
        animate();
    }, 100);
});

// ========== ENHANCED INFO PANEL WITH PREVIEW AND WIDGET ==========
async function createAsteroidWatchWidget(panel) {
    const widgetWrapper = document.createElement('div');
    widgetWrapper.id = 'asteroid-watch-widget';
    widgetWrapper.innerHTML = `<div style="color: var(--text-dim); text-align: center;">Loading Asteroid Watch Data...</div>`;
    panel.appendChild(widgetWrapper);

    const data = await nasaData.fetchCloseApproaches();
    
    if (!data || data.length === 0) {
        widgetWrapper.innerHTML = `<div style="color: var(--warning);">Could not load live asteroid data.</div>`;
        return;
    }

    let currentIndex = 0;

    widgetWrapper.innerHTML = `
        <div class="aw-header">
            <div class="aw-title-group">
                <h2 class="aw-title">NASA Asteroid Watch</h2>
                <p class="aw-subtitle">API - Next closest approaches to Earth</p>
            </div>
            <div class="aw-pagination">1 / ${data.length}</div>
        </div>
        <div class="aw-main-content">
            <div class="aw-details-grid">
                <h3 class="aw-asteroid-name"></h3>
                <div class="aw-detail-item">
                    <div class="label">DATE</div>
                    <div class="value value-date"></div>
                </div>
                <div class="aw-detail-item">
                    <div class="label">DISTANCE</div>
                    <div class="value value-distance"></div>
                </div>
            </div>
            <div class="aw-asteroid-graphic">
                <div>
                <img style="width: 78%" src="./img/asteroid.png"></img>
                </div>
                <div class="size-label">ESTIMATED DIAMETER</div>
                <div class="size-value"></div>
            </div>
        </div>
        <div class="countdown-container">
            <div class="countdown-title">LIVE COUNTDOWN TO CLOSEST APPROACH</div>
            <div class="countdown-grid">
                <div class="countdown-item"><div class="value" id="cd-days">00</div><div class="label">Days</div></div>
                <div class="countdown-item"><div class="value" id="cd-hours">00</div><div class="label">Hours</div></div>
                <div class="countdown-item"><div class="value" id="cd-minutes">00</div><div class="label">Minutes</div></div>
                <div class="countdown-item"><div class="value" id="cd-seconds">00</div><div class="label">Seconds</div></div>
            </div>
        </div>
        <div class="aw-nav">
            <button class="aw-prev">← Previous</button>
            <div class="aw-dots"></div>
            <button class="aw-next">Next →</button>
        </div>
    `;

    const prevBtn = widgetWrapper.querySelector('.aw-prev');
    const nextBtn = widgetWrapper.querySelector('.aw-next');
    const dotsContainer = widgetWrapper.querySelector('.aw-dots');

    for (let i = 0; i < data.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'aw-dot';
        dot.dataset.index = i;
        dotsContainer.appendChild(dot);
    }
    
    const renderSlide = (index) => {
        const asteroid = data[index];
        const approachDate = new Date(asteroid.date);
        
        widgetWrapper.querySelector('.aw-pagination').textContent = `${index + 1} / ${data.length}`;
        widgetWrapper.querySelector('.aw-asteroid-name').textContent = asteroid.name;
        
        const dateOptions = { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        widgetWrapper.querySelector('.value-date').textContent = approachDate.toLocaleDateString('en-US', dateOptions).replace(',', '');
        
        widgetWrapper.querySelector('.value-distance').textContent = `${Math.round(asteroid.distance).toLocaleString()} km`;
        widgetWrapper.querySelector('.size-value').textContent = `${asteroid.diameter.toFixed(1)} m`;

        widgetWrapper.querySelectorAll('.aw-dot').forEach((d, i) => d.classList.toggle('active', i === index));
        
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === data.length - 1;

        if (asteroidWatchInterval) clearInterval(asteroidWatchInterval);
        
        const countdownElements = {
            days: document.getElementById('cd-days'),
            hours: document.getElementById('cd-hours'),
            minutes: document.getElementById('cd-minutes'),
            seconds: document.getElementById('cd-seconds')
        };
        
        const update = () => updateCountdown(approachDate, countdownElements);
        update();
        asteroidWatchInterval = setInterval(update, 1000);
    };

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            renderSlide(currentIndex);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex < data.length - 1) {
            currentIndex++;
            renderSlide(currentIndex);
        }
    });

    renderSlide(currentIndex);
}

function updateCountdown(targetDate, elements) {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) {
        elements.days.textContent = '00';
        elements.hours.textContent = '00';
        elements.minutes.textContent = '00';
        elements.seconds.textContent = '00';
        if(asteroidWatchInterval) clearInterval(asteroidWatchInterval);
        return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    
    elements.days.textContent = String(d).padStart(2, '0');
    elements.hours.textContent = String(h).padStart(2, '0');
    elements.minutes.textContent = String(m).padStart(2, '0');
    elements.seconds.textContent = String(s).padStart(2, '0');
}

function setupPreviewHandlers(takeIndex) {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    panel.addEventListener('mouseenter', function() { showPreview(panel); });
    panel.addEventListener('mouseleave', function() { hidePreview(panel); });
    
    const previewContainer = panel.querySelector('.preview-container');
    if (!previewContainer) return;
    
    if (!previewContainer.querySelector('.preview-window')) {
        previewContainer.innerHTML = `<div class="preview-window"><div class="preview-content" id="preview-content"><div class="preview-loading">HOVER OVER A LINK</div></div><div class="preview-label" id="preview-label">PREVIEW</div></div>`;
    }

    const newLinks = panel.querySelectorAll('.info-link');
    newLinks.forEach((link, index) => {
        link.addEventListener('mouseenter', function() {
            updatePreviewContent(getPreviewData(takeIndex, index));
        });
    });
}

function showPreview(panel) {
    // FIX: Do not run preview logic if the panel is a widget
    if (!panel || panel.classList.contains('is-widget')) {
        return;
    }

    const previewContainer = panel.querySelector('.preview-container');
    const previewWindow = panel.querySelector('.preview-window');

    if (previewContainer && previewWindow) {
        if (panel.dataset.isRepositioning === 'true') return;
        
        const rect = panel.getBoundingClientRect();
        const vh = window.innerHeight;
        const previewHeight = 180;
        const previewMargin = 20;
        const safeMargin = 20;
        const totalAddedHeight = previewHeight + previewMargin;

        const isBottomAnchored = !panel.style.top || panel.style.top === 'auto';
        
        if (!isBottomAnchored && (rect.top + rect.height + totalAddedHeight > vh - safeMargin)) {
            panel.dataset.originalTop = panel.style.top;
            panel.style.top = 'auto';
            panel.style.bottom = `${safeMargin}px`;
            panel.dataset.isRepositioning = 'true';
        }
        else if (isBottomAnchored && (rect.bottom - rect.height - totalAddedHeight < safeMargin)) {
            panel.dataset.originalBottom = panel.style.bottom;
            panel.style.bottom = 'auto';
            panel.style.top = `${safeMargin}px`;
            panel.dataset.isRepositioning = 'true';
        }

        previewContainer.style.height = `${previewHeight}px`;
        previewContainer.style.marginTop = `${previewMargin}px`;
        previewContainer.style.opacity = '1';
        previewContainer.style.pointerEvents = 'all';
        previewWindow.style.opacity = '1';
        previewWindow.style.transform = 'translateY(0)';
    }
}

function hidePreview(panel) {
    if (!panel) return;
    
    const previewContainer = panel.querySelector('.preview-container');
    const previewWindow = panel.querySelector('.preview-window');

    if (previewContainer && previewWindow) {
        previewContainer.style.height = '0';
        previewContainer.style.marginTop = '0';
        previewContainer.style.opacity = '0';
        previewContainer.style.pointerEvents = 'none';
        previewWindow.style.opacity = '0';
        previewWindow.style.transform = 'translateY(10px)';

        setTimeout(() => {
            if (panel.dataset.originalTop) {
                panel.style.top = panel.dataset.originalTop;
                panel.style.bottom = 'auto';
            }
            if (panel.dataset.originalBottom) {
                panel.style.bottom = panel.dataset.originalBottom;
                panel.style.top = 'auto';
            }
            delete panel.dataset.originalTop;
            delete panel.dataset.originalBottom;
            delete panel.dataset.isRepositioning;
        }, 400);
    }
}

function updatePreviewContent(previewData) {
    if (!previewData) return;
    const previewContent = document.getElementById('preview-content');
    const previewLabel = document.getElementById('preview-label');
    if (!previewContent || !previewLabel) return;
    let contentHTML = ''; let labelText = 'PREVIEW';
    switch(previewData.type) {
        case 'chart':
            contentHTML = createMiniChart(previewData.data);
            labelText = 'DATA VISUALIZATION';
            break;
        case 'live':
            contentHTML = `<div style="text-align: center; padding: 20px;"><div style="width: 10px; height: 10px; background: #32ADF5; border-radius: 50%; margin: 0 auto 10px; animation: pulse 1.5s infinite;"></div><div style="color: #32ADF5; font-size: 10px;">LIVE DATA</div><div style="color: white; font-size: 12px; margin-top: 5px;">${previewData.data || '384,400 km'}</div></div>`;
            labelText = 'LIVE FEED';
            break;
        case 'image':
            contentHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"><img src="./img/earth1.jpg"></img><rect width="40" height="40" rx="4" stroke="#32ADF5" stroke-width="2" fill="none"/><circle cx="20" cy="15" r="6" fill="#32ADF5" opacity="0.5"/><path d="M5 35 L15 25 L25 30 L35 20" stroke="#32ADF5" stroke-width="2" fill="none"/></svg></div>`;
            labelText = 'IMAGE PREVIEW';
            break;
        default:
            contentHTML = `<div style="text-align: center; padding: 20px; color: #32ADF5;"><div>HOVER OVER A LINK</div></div>`;
            labelText = 'PREVIEW';
    }
    previewContent.innerHTML = contentHTML;
    previewLabel.textContent = labelText;
}

function createMiniChart(data) {
    if (!data) return '<div>No data</div>';
    if (Array.isArray(data)) {
        const max = Math.max(...data);
        return `<div style="padding: 10px;">${data.map(val => `<div style="margin: 4px 0;"><div style="width: 100%; height: 6px; background: rgba(0,255,170,0.1); border-radius: 3px; overflow: hidden;"><div style="width: ${(val/max) * 100}%; height: 100%; background: linear-gradient(90deg, #32ADF5 0%, #FF3C00 100%); border-radius: 3px;"></div></div></div>`).join('')}</div>`;
    } else if (typeof data === 'object') {
        const values = Object.values(data).filter(v => typeof v === 'number');
        if (values.length === 0) return '<div>No data</div>';
        const max = Math.max(...values);
        return `<div style="padding: 10px;">${Object.entries(data).map(([key, val]) => {
            if (typeof val === 'number') {
                return `<div style="margin: 8px 0;"><div style="font-size: 8px; color: rgba(255,255,255,0.5); text-transform: uppercase;">${key}</div><div style="width: 100%; height: 6px; background: rgba(0,255,170,0.1); border-radius: 3px; overflow: hidden; margin-top: 2px;"><div style="width: ${(val/max) * 100}%; height: 100%; background: linear-gradient(90deg, #32ADF5 0%, #FF3C00 100%); border-radius: 3px;"></div></div><div style="font-size: 7px; color: #32ADF5; margin-top: 2px;">${val.toLocaleString()}</div></div>`;
            } return '';
        }).join('')}</div>`;
    }
    return '<div>No data</div>';
}

function getPreviewData(takeIndex, linkIndex) {
    const previewConfigs = [
        [], // Take 0
        [{type: 'chart', data: {mass: 100, energy: 440, count: 5000}}], // Take 1
        [{type: 'live', data: '33,846 TRACKED'}], // Take 2
        [], // Take 3 (Now a widget)
        [{type: 'chart', data: {mass: 8.1, velocity: 25, diameter: 330}}], // Take 4
        [{type: 'live', data: 'APPROACHING'}], // Take 5
        [{type: 'chart', data: {energy: 2400, crater: 2.7, magnitude: 8.2}}], // Take 6
        [{type: 'image'}], // Take 7
        [{type: 'live', data: 'SUCCESS: 94%'}], // Take 8
        [{type: 'image'}], // Take 9
        [{type: 'chart', data: {telescopes: 28, images: 50000}}], // Take 10
        [{type: 'live', data: 'ORBIT PRECISION: ±50 km'}], // Take 11
        [{type: 'live', data: 'DEFENSE READY'}], // Take 12 - Updated for second chance
        [{type: 'chart', data: {pacific: 42, atlantic: 23, land: 29}}], // Take 13
        [{type: 'image'}], // Take 14
        [{type: 'live', data: 'TSUNAMI WAVE: 30m'}], // Take 15
        [{type: 'chart', data: [8.2, 7.5, 6.8, 5.2]}], // Take 16
        [{type: 'image'}], // Take 17
        [{type: 'live', data: 'GLOBAL COORDINATION'}], // Take 18
        [{type: 'live', data: 'JOIN THE MISSION'}] // Take 19
    ];
    const takes = previewConfigs[takeIndex];
    if (takes && takes[linkIndex]) return takes[linkIndex];
    return { type: 'image' }; 
}


// ======================= SCRAMBLE TEXT (per-take) =======================
// This block adds a text scramble effect that triggers each time a "take" (section)
// becomes active. It supports forward and backward navigation.
(function(){
    if (window.TypewriterScramble && window.ScrambleStory) return; // avoid double inject

    const RANDOM_CHARS = '!%$#@*ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    const CONFIG = {
        typeSpeed: 0,
        scrambleTime: 100,
        changeRate: 30,
        cascadeDelay: 300
    };

    class TypewriterScramble {
        constructor(element, autoStart = false) {
            this.element = element;
            this.originalText = element.getAttribute('data-text') || element.textContent;
            this.currentText = '';
            this.intervals = [];
            this.timeouts = [];
            this.isAnimating = false;
            this.hasAnimated = false;

            if (!element.getAttribute('data-text')) {
                element.setAttribute('data-text', this.originalText);
            }
            if (autoStart) this.animate();
        }

        getRandomChar() {
            return RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)];
        }

        async animate() {
            if (this.isAnimating || this.hasAnimated) return;
            this.isAnimating = true;
            this.hasAnimated = true;
            this.stop();
            this.currentText = '';
            this.element.textContent = '';
            this.element.classList.add('animating');

            for (let i = 0; i < this.originalText.length; i++) {
                await this._addCharacter(i);
                if (CONFIG.typeSpeed) await new Promise(r => setTimeout(r, CONFIG.typeSpeed));
            }

            setTimeout(() => {
                this.element.classList.remove('animating');
                this.isAnimating = false;
            }, 200);
        }

        _addCharacter(index) {
            return new Promise((resolve) => {
                this.currentText += this.getRandomChar();
                this.element.textContent = this.currentText;

                const interval = setInterval(() => {
                    const arr = this.currentText.split('');
                    arr[index] = this.getRandomChar();
                    this.currentText = arr.join('');
                    this.element.textContent = this.currentText;
                }, CONFIG.changeRate);
                this.intervals.push(interval);

                const timeout = setTimeout(() => {
                    clearInterval(interval);
                    const arr = this.currentText.split('');
                    arr[index] = this.originalText[index];
                    this.currentText = arr.join('');
                    this.element.textContent = this.currentText;
                    resolve();
                }, CONFIG.scrambleTime);
                this.timeouts.push(timeout);
            });
        }

        stop() {
            this.intervals.forEach(clearInterval);
            this.timeouts.forEach(clearTimeout);
            this.intervals = [];
            this.timeouts = [];
            this.isAnimating = false;
            this.element.classList.remove('animating');
        }

        replay() {
            this.stop();
            this.hasAnimated = false;
            this.originalText = this.element.getAttribute('data-text') || this.originalText;
            this.element.textContent = '';
            this.animate();
        }
    }

    function initStoryScramble() {
        document.querySelectorAll('.scramble-text-story').forEach(el => {
            if (!el.getAttribute('data-text')) el.setAttribute('data-text', el.textContent);
        });
    }

    const ScrambleStory = (function() {
        const instances = new WeakMap();
        function ensure(el) {
            let inst = instances.get(el);
            if (!inst) {
                inst = new TypewriterScramble(el, false);
                instances.set(el, inst);
            }
            return inst;
        }
        function runForSection(index, startDelay = 0) {
            const sec = document.getElementById(`section-${index}`);
            if (!sec) return;
            const items = sec.querySelectorAll('.scramble-text-story');
            items.forEach((el, i) => {
                const inst = ensure(el);
                setTimeout(() => inst.replay(), startDelay + i * CONFIG.cascadeDelay);
            });
        }
        function resetSection(index) {
            const sec = document.getElementById(`section-${index}`);
            if (!sec) return;
            sec.querySelectorAll('.scramble-text-story').forEach(el => {
                const inst = ensure(el);
                inst.stop();
                const original = el.getAttribute('data-text') || el.textContent;
                el.textContent = original;
            });
        }
        return { runForSection, resetSection, _ensure: ensure };
    })();

    window.TypewriterScramble = { TypewriterScramble, initStoryScramble, CONFIG };
    window.ScrambleStory = ScrambleStory;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStoryScramble);
    } else {
        initStoryScramble();
    }
})();
// ===================== END SCRAMBLE TEXT (per-take) =====================

/* =========================================================
   STORY SKIP BUTTON UPGRADE
   - At take 20: label -> "Skip to the top" and action -> go to take 0
   - Other takes: label -> "Skip to the end" and action -> go to take 19
   - No HTML changes required (uses existing button with onclick="skipToEnd()")
   ========================================================= */
(function () {
  // Helper: updates the label based on current take
  function updateStorySkipButtonLabel() {
    const btn = document.querySelector('.bottom-left-controls button[onclick="skipToEnd()"]');
    if (!btn) return;

    // keep existing hide/show rules from the app (e.g., take 08) intact;
    // just update the label when visible
    const atLastTake =
      typeof totalSections === 'number' &&
      typeof currentSection === 'number' &&
      currentSection === totalSections - 1;

    btn.textContent = atLastTake ? 'Skip to the top' : 'Skip to the end';
  }

  // Override skipToEnd behavior WITHOUT touching HTML:
  // - on last take -> back to top
  // - otherwise -> jump to last take
  const fallbackSkipToEnd = function () {
    if (typeof navigateToSection === 'function') navigateToSection(totalSections - 1);
  };

  window.skipToEnd = function () {
    try {
      const atLastTake =
        typeof totalSections === 'number' &&
        typeof currentSection === 'number' &&
        currentSection === totalSections - 1;

      if (atLastTake) {
        // Back to the top (take 0)
        if (typeof navigateToSection === 'function') navigateToSection(0);
      } else {
        // Go to the last take (take 19)
        if (typeof navigateToSection === 'function') navigateToSection(totalSections - 1);
      }
    } catch (e) {
      // Fallback to original behavior if anything goes wrong
      fallbackSkipToEnd();
    }
  };

  // Hook: after any navigation, refresh the label
  if (typeof window.navigateToSection === 'function') {
    const __origNavigateToSection = window.navigateToSection;
    window.navigateToSection = function (index) {
      __origNavigateToSection(index);
      // Run after UI updates
      setTimeout(updateStorySkipButtonLabel, 0);
    };
  }

  // Initial label once the DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateStorySkipButtonLabel, 300);
  });
})();



/* TooltipManager: inicializa tooltips em qualquer .has-tooltip */
(function () {
  const SELECTOR = '.has-tooltip';
  let tooltipEl = null;
  let visibleFor = null; // elemento atualmente com tooltip visível

  function ensureEl() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'c-tooltip';
      tooltipEl.setAttribute('role', 'tooltip');
      tooltipEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function buildContent(target) {
    const title = target.getAttribute('data-tooltip-title');
    const body  = target.getAttribute('data-tooltip') || '';
    const source= target.getAttribute('data-tooltip-source');
    const url   = target.getAttribute('data-tooltip-url');

    const titleHtml = title ? `<strong class="tt-title">${title}</strong>` : '';
    const metaHtml  = (source || url)
      ? `<span class="tt-meta">${source ? source : ''}${(source && url) ? ' — ' : ''}${url ? `<a href="${url}" target="_blank" rel="noopener">Fonte</a>` : ''}</span>`
      : '';
    return `${titleHtml}<span class="tt-body">${body}</span>${metaHtml}`;
  }

  function showTooltip(e) {
    const t = e.currentTarget;
    const tip = ensureEl();
    tip.innerHTML = buildContent(t);
    tip.classList.add('is-visible');
    tip.setAttribute('aria-hidden', 'false');
    visibleFor = t;

    // vínculo ARIA
    if (!t.id) t.id = 'tt-' + Math.random().toString(36).slice(2);
    tip.id = t.id + '-popup';
    t.setAttribute('aria-describedby', tip.id);

    positionTooltip(t, tip);
    window.addEventListener('scroll', onScrollResize, { passive: true });
    window.addEventListener('resize', onScrollResize);
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('is-visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
    if (visibleFor) {
      visibleFor.removeAttribute('aria-describedby');
    }
    visibleFor = null;
    window.removeEventListener('scroll', onScrollResize);
    window.removeEventListener('resize', onScrollResize);
  }

  function onScrollResize() {
    if (visibleFor && tooltipEl?.classList.contains('is-visible')) {
      positionTooltip(visibleFor, tooltipEl);
    }
  }

  function positionTooltip(target, tip) {
    const r = target.getBoundingClientRect();
    const padding = 8;
    const cx = r.left + r.width / 2;
    let x = cx;
    let y = r.top - padding; // acima do alvo

    // garantir dentro da viewport
    const vw = window.innerWidth;
    const margin = 12;
    const tipW = Math.min(tip.offsetWidth || 280, 360);
    x = Math.max(margin + tipW/2, Math.min(vw - margin - tipW/2, x));
    // se não couber acima, joga abaixo
    const enoughTop = r.top > (tip.offsetHeight + 16);
    if (!enoughTop) y = r.bottom + padding + 12, tip.style.setProperty('--arrow-dir','up');

    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  function bind(el) {
    el.classList.add('has-tooltip'); // garante classe, caso venha só com data-tooltip
    el.setAttribute('tabindex', el.tabIndex >= 0 ? el.tabIndex : 0); // foco teclado
    el.addEventListener('mouseenter', showTooltip);
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('focus', showTooltip);
    el.addEventListener('blur', hideTooltip);
    // toque: primeiro toque mostra, segundo (fora) esconde
    el.addEventListener('touchstart', (e) => {
      if (visibleFor === el) { hideTooltip(); }
      else { showTooltip(e); }
    }, { passive: true });
    document.addEventListener('touchstart', (e) => {
      if (visibleFor && !e.target.closest('.has-tooltip')) hideTooltip();
    }, { passive: true });
  }

  function initTooltips() {
    document.querySelectorAll(SELECTOR).forEach(bind);
    // opcional: MutationObserver se conteúdos são dinâmicos
    const mo = new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes?.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches?.(SELECTOR)) bind(node);
          node.querySelectorAll?.(SELECTOR).forEach(bind);
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState !== 'loading') initTooltips();
  else document.addEventListener('DOMContentLoaded', initTooltips);
})();


function addTooltipToWord(container, word, attrs = {}) {
  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && node.nodeValue.toLowerCase().includes(word.toLowerCase())
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }
  });

  const re = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')})\\b`,'i');
  let n;
  while ((n = walker.nextNode())) {
    const m = re.exec(n.nodeValue);
    if (!m) continue;
    const before = n.nodeValue.slice(0, m.index);
    const match  = n.nodeValue.slice(m.index, m.index + m[0].length);
    const after  = n.nodeValue.slice(m.index + m[0].length);

    const span = document.createElement('span');
    span.className = 'has-tooltip';
    span.textContent = match;
    if (attrs.tooltip) span.setAttribute('data-tooltip', attrs.tooltip);
    if (attrs.title)   span.setAttribute('data-tooltip-title', attrs.title);
    if (attrs.source)  span.setAttribute('data-tooltip-source', attrs.source);
    if (attrs.url)     span.setAttribute('data-tooltip-url', attrs.url);

    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));
    n.parentNode.replaceChild(frag, n);
    break; // só a primeira ocorrência
  }
}





/* Arrow Keys UI – mostra só no Take 01 (currentSection === 0) */
(function () {
  const ui = document.getElementById('arrowKeysUI');
  const up = document.getElementById('btnArrowUp');
  const dn = document.getElementById('btnArrowDown');

  function go(delta){
    if (typeof window.currentSection !== 'number') return;
    const total = (typeof window.totalSections === 'number') ? window.totalSections : 20;
    const next  = Math.min(total - 1, Math.max(0, window.currentSection + delta));
    if (typeof window.navigateToSection === 'function') window.navigateToSection(next);
    refresh();
  }

  function refresh(){
    // aparece somente na Take 01
    const onFirst = (typeof window.currentSection === 'number') ? window.currentSection === 0 : true;
    ui.classList.toggle('visible', onFirst);
  }

  up?.addEventListener('click', () => go(-1));
  dn?.addEventListener('click', () => go(+1));

  /* acompanha a navegação existente, sem mexer no main.js */
  if (typeof window.navigateToSection === 'function') {
    const _nav = window.navigateToSection;
    window.navigateToSection = function(){
      const r = _nav.apply(this, arguments);
      try { refresh(); } catch(e){}
      return r;
    };
  }

  refresh();
  setTimeout(refresh, 250); // garante sync após boot
})();



/* Arrow Keys UI — visíveis somente no Take 01 (#section-0) */
(function () {
  const ui    = document.getElementById('arrowKeysUI');
  const first = document.getElementById('section-0');  // Take 01

  if (!ui || !first) return;

  function shouldShow() {
    // 1) regra principal: #section-0 está ativo
    if (first.classList.contains('active')) return true;

    // 2) fallback se o app expõe currentSection
    if (typeof window.currentSection === 'number') {
      return window.currentSection === 0;
    }
    return false;
  }

  function updateArrows() {
    ui.classList.toggle('visible', shouldShow());
  }

  // Observa mudanças de classe no #section-0 e no wrapper (navegação/scroll)
  const mo = new MutationObserver(updateArrows);
  mo.observe(first, { attributes: true, attributeFilter: ['class'] });
  const wrapper = document.querySelector('.content-wrapper');
  if (wrapper) {
    mo.observe(wrapper, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // Hook na navegação, se existir
  if (typeof window.navigateToSection === 'function') {
    const _nav = window.navigateToSection;
    window.navigateToSection = function () {
      const r = _nav.apply(this, arguments);
      requestAnimationFrame(updateArrows);
      return r;
    };
  }

  // Segurança: poll curto após boot (cobre transições/intro)
  const pollId = setInterval(updateArrows, 300);
  setTimeout(() => clearInterval(pollId), 4000);

  // estado inicial
  updateArrows();
})();