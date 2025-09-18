// Game state management
    const GAME_STATES = {
        MENU: 'menu',
        STAGE_SELECTION: 'stageSelection',
        PLAYING: 'playing',
        GAME_OVER: 'gameOver',
        VICTORY: 'victory',
        CONGRATULATIONS: 'congratulations',
        BONUS_STAGE: 'bonusStage',
        STAGE2_INTRO: 'stage2Intro',
        STAGE3_INTRO: 'stage3Intro'
    };

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = GAME_STATES.MENU;
        this.score = 0;
        this.lives = 3;
        
        // Game objects
        this.hero = null;
        this.robots = [];
        this.bullets = [];
        this.robberBullets = []; // New array for robber's bullets
        this.robber = null;
        this.currentLevel = 0;
        this.currentStage = 1; // Track which stage we're on (1 or 2)
        this.levels = [];
        
        // Drill attack system for mole boss
        this.drillAttacks = []; // Array to track active drill attacks
        this.playerTargetPosition = { x: 0, y: 0 }; // Where player was when drill was fired
        
        // Victory animation
        this.victoryAnimation = {
            active: false,
            timer: 0,
            duration: 180, // 3 seconds at 60fps
            balloons: [],
            confetti: [],
            robberFallen: false
        };
        
        // Bonus stage properties
        this.bonusStage = {
            active: false,
            timer: 0,
            duration: 600, // 10 seconds at 60fps
            aquaPower: 0,
            maxAquaPower: 20, // Need 20 drops to complete
            heroFlying: false,
            flashTimer: 0,
            flashDuration: 60, // 1 second flash
            clouds: [],
            raindrops: [],
            cloudSpawnTimer: 0,
            raindropSpawnTimer: 0,
            transitionTimer: 0,
            transitionPhase: 'flashing', // 'flashing', 'black', 'flying'
            emergencyMessage: false,
            // Back layer clouds (behind normal clouds)
            backClouds: [],
            backCloudSpawnTimer: 0,
            // Front layer clouds (fast-moving, different sizes, transparent)
            frontClouds: [],
            frontCloudSpawnTimer: 0
        };
        
        // Stage 2 intro properties
        this.stage2Intro = {
            active: false,
            flashTimer: 0
        };
        
        // Stage 3 intro properties
        this.stage3Intro = {
            active: false,
            flashTimer: 0
        };
        
        // Stage selection properties
        this.stageSelection = {
            selectedStage: 1,
            maxStage: 3
        };
        
        // Images
        this.images = {
            hero: null,
            robot: null,
            robber: null,
            bullet: null,
            menuBackground: null,
            levelBackground: null,
            shield: null,
            stairs: null,
            fireBullet: null,
            // Level 2 images
            alien: null,
            mutant: null,
            ladder: null,
            l2Background: null,
            worm: null,
            mole: null,
            rope: null,
            l3Background: null,
            cloud: null,
            rainbow: null,
            sun: null,
            victory: null,
            gameOver: null
        };
        this.imagesLoaded = 0;
        this.totalImages = 22;
        
        // Audio context and sounds
        this.audioContext = null;
        this.sounds = {
            shoot: null,
            explosion: null,
            shield: null,
            hit: null,
            victory: null,
            gameOver: null,
            monkey: null,
            cheer: null,
            laser: null,
            drill: null
        };
        this.soundEnabled = true;
        
        // Input handling
        this.keys = {};
        this.setupEventListeners();
        
        // Initialize game
        this.initAudio();
        this.loadImages();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            if (this.state === GAME_STATES.MENU && e.code === 'KeyX') {
                this.startGame();
            } else if (this.state === GAME_STATES.MENU && e.code === 'KeyS') {
                this.state = GAME_STATES.STAGE_SELECTION;
            } else if (this.state === GAME_STATES.STAGE_SELECTION) {
                if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
                    this.stageSelection.selectedStage = Math.max(1, Math.min(this.stageSelection.maxStage, 
                        this.stageSelection.selectedStage + (e.code === 'ArrowUp' ? -1 : 1)));
                } else if (e.code === 'KeyX') {
                    this.startSelectedStage();
                } else if (e.code === 'Escape') {
                    this.state = GAME_STATES.MENU;
                }
            } else if (this.state === GAME_STATES.CONGRATULATIONS && e.code === 'KeyX') {
                this.startLevel2();
            } else if ((this.state === GAME_STATES.GAME_OVER || this.state === GAME_STATES.VICTORY) && e.code === 'KeyX') {
                this.resetGame();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Initialize audio on first user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.initAudio();
            }
        }, { once: true });
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createSounds();
        } catch (e) {
            console.log('Audio not supported');
            this.soundEnabled = false;
        }
    }
    
    createSounds() {
        if (!this.audioContext) return;
        
        // Water pistol sound - splashy water effect
        this.sounds.shoot = this.createWaterSplash();
        
        // Explosion sound - noise burst
        this.sounds.explosion = this.createNoise(0.2);
        
        // Shield sound - electric buzz
        this.sounds.shield = this.createTone(200, 0.3, 'sawtooth');
        
        // Hit sound - low thud
        this.sounds.hit = this.createTone(150, 0.2, 'square');
        
        // Fire sound - for robber's fireballs
        this.sounds.fire = this.createFireSound();
        
        // Victory sound - ascending melody
        this.sounds.victory = this.createMelody([523, 659, 784, 1047], 0.3);
        
        // Game over sound - descending tone
        this.sounds.gameOver = this.createTone(200, 1.0, 'triangle');
        
        // Monkey sound - high-pitched chattering
        this.sounds.monkey = this.createMonkeySound();
        
        // Cheer sound - celebratory fanfare
        this.sounds.cheer = this.createCheerSound();
        
        // Laser sound - high-pitched laser beam
        this.sounds.laser = this.createLaserSound();
        
        // Drill sound - mechanical drilling noise
        this.sounds.drill = this.createDrillSound();
        this.sounds.drillFire = this.createDrillFireSound();
        this.sounds.drillScraping = this.createDrillScrapingSound();
        this.sounds.drillBurst = this.createDrillBurstSound();
    }
    
    createTone(frequency, duration, type = 'sine') {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    createNoise(duration) {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            const bufferSize = this.audioContext.sampleRate * duration;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            
            const whiteNoise = this.audioContext.createBufferSource();
            whiteNoise.buffer = buffer;
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            whiteNoise.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            whiteNoise.start(this.audioContext.currentTime);
        };
    }
    
    createMelody(frequencies, noteDuration) {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + noteDuration);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + noteDuration);
                }, index * noteDuration * 1000);
            });
        };
    }
    
    createWaterSplash() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Create a splashy water sound using filtered noise and bubbles
            const duration = 0.3;
            const bufferSize = this.audioContext.sampleRate * duration;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            
            // Generate water-like noise with bubbles
            for (let i = 0; i < bufferSize; i++) {
                const t = i / this.audioContext.sampleRate;
                const noise = Math.random() * 2 - 1;
                const bubble = Math.sin(t * 2000) * Math.exp(-t * 8); // Bubble effect
                const splash = noise * Math.exp(-t * 6); // Decaying splash
                output[i] = (splash + bubble * 0.3) * 0.4;
            }
            
            const waterNoise = this.audioContext.createBufferSource();
            waterNoise.buffer = buffer;
            
            // Add a filter to make it sound more watery
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(800, this.audioContext.currentTime);
            filter.Q.setValueAtTime(1, this.audioContext.currentTime);
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            waterNoise.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            waterNoise.start(this.audioContext.currentTime);
        };
    }
    
    createFireSound() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Create a fire sound using filtered noise
            const duration = 0.4;
            const bufferSize = this.audioContext.sampleRate * duration;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            
            // Generate fire-like noise
            for (let i = 0; i < bufferSize; i++) {
                const t = i / this.audioContext.sampleRate;
                const noise = Math.random() * 2 - 1;
                const crackle = Math.sin(t * 3000) * Math.exp(-t * 4); // Fire crackle
                const roar = noise * Math.exp(-t * 3); // Fire roar
                output[i] = (roar + crackle * 0.4) * 0.3;
            }
            
            const fireNoise = this.audioContext.createBufferSource();
            fireNoise.buffer = buffer;
            
            // Add a filter to make it sound more like fire
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1200, this.audioContext.currentTime);
            filter.Q.setValueAtTime(2, this.audioContext.currentTime);
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0.12, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            fireNoise.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            fireNoise.start(this.audioContext.currentTime);
        };
    }
    
    createMonkeySound() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Create monkey chattering sound with multiple high-pitched tones
            const duration = 0.6;
            const frequencies = [800, 1000, 1200, 1500];
            
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                    oscillator.type = 'sawtooth';
                    
                    gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                }, index * 100);
            });
        };
    }
    
    createCheerSound() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Create celebratory fanfare with ascending notes
            const notes = [523, 659, 784, 1047, 1319]; // C, E, G, C, E
            const duration = 0.3;
            
            notes.forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                    oscillator.type = 'triangle';
                    
                    gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + duration);
                }, index * 150);
            });
        };
    }
    
    createLaserSound() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Create a laser beam sound with high frequency and modulation
            const duration = 0.3;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // High frequency laser sound
            oscillator.frequency.setValueAtTime(2000, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(4000, this.audioContext.currentTime + duration);
            oscillator.type = 'sawtooth';
            
            // Filter to make it sound more laser-like
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3000, this.audioContext.currentTime);
            filter.Q.setValueAtTime(10, this.audioContext.currentTime);
            
            // Volume envelope
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    createDrillSound() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Create a mechanical drilling sound
            const duration = 0.4;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Low frequency mechanical sound
            oscillator.frequency.setValueAtTime(80, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(120, this.audioContext.currentTime + duration);
            oscillator.type = 'sawtooth';
            
            // Filter to make it sound more mechanical
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, this.audioContext.currentTime);
            filter.Q.setValueAtTime(5, this.audioContext.currentTime);
            
            // Volume envelope with mechanical pulsing
            gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.05, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    createDrillFireSound() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Sound 1: Drill firing - sharp mechanical click
            const duration = 0.3;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Sharp mechanical click
            oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + duration);
            oscillator.type = 'square';
            
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(100, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    createDrillScrapingSound() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Sound 2: Scraping noise as drill travels underground
            const duration = 1.5;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Scraping/grinding sound
            oscillator.frequency.setValueAtTime(60, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + duration);
            oscillator.type = 'sawtooth';
            
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(120, this.audioContext.currentTime);
            filter.Q.setValueAtTime(3, this.audioContext.currentTime);
            
            // Gradual volume increase
            gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.15, this.audioContext.currentTime + duration * 0.7);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    createDrillBurstSound() {
        return () => {
            if (!this.audioContext || !this.soundEnabled) return;
            
            // Sound 3: Burst and damage - explosive impact
            const duration = 0.8;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Explosive burst sound
            oscillator.frequency.setValueAtTime(40, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(20, this.audioContext.currentTime + duration);
            oscillator.type = 'sawtooth';
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(150, this.audioContext.currentTime);
            filter.Q.setValueAtTime(2, this.audioContext.currentTime);
            
            // Sharp impact with decay
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    playSound(soundName) {
        if (this.sounds[soundName] && this.soundEnabled) {
            this.sounds[soundName]();
        }
    }
    
    startVictoryAnimation() {
        this.victoryAnimation.active = true;
        this.victoryAnimation.timer = 0;
        this.victoryAnimation.robberFallen = true; // Boss falls immediately
        this.victoryAnimation.balloons = [];
        this.victoryAnimation.confetti = [];
        
        // Create balloons
        for (let i = 0; i < 8; i++) {
            this.victoryAnimation.balloons.push({
                x: Math.random() * this.canvas.width,
                y: this.canvas.height + 50,
                vx: (Math.random() - 0.5) * 2,
                vy: -2 - Math.random() * 3,
                color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'][i % 8],
                size: 20 + Math.random() * 15
            });
        }
        
        // Create confetti
        for (let i = 0; i < 50; i++) {
            this.victoryAnimation.confetti.push({
                x: Math.random() * this.canvas.width,
                y: -10,
                vx: (Math.random() - 0.5) * 4,
                vy: 1 + Math.random() * 3,
                color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'][Math.floor(Math.random() * 8)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }
    
    updateVictoryAnimation() {
        if (!this.victoryAnimation.active) return;
        
        this.victoryAnimation.timer++;
        
        // Robber falls immediately when victory animation starts (no timer needed)
        
        // Update balloons
        this.victoryAnimation.balloons.forEach(balloon => {
            balloon.x += balloon.vx;
            balloon.y += balloon.vy;
            balloon.vy += 0.05; // Gravity
        });
        
        // Update confetti
        this.victoryAnimation.confetti.forEach(confetti => {
            confetti.x += confetti.vx;
            confetti.y += confetti.vy;
            confetti.vy += 0.1; // Gravity
            confetti.rotation += confetti.rotationSpeed;
        });
        
        // End animation after duration
        if (this.victoryAnimation.timer >= this.victoryAnimation.duration) {
            this.victoryAnimation.active = false;
            if (this.currentStage === 1) {
                this.startBonusStage();
            } else if (this.currentStage === 2) {
                this.startBonusStage();
            } else {
                this.state = GAME_STATES.VICTORY;
            }
        }
    }
    
    updateBonusStage() {
        if (!this.bonusStage.active) return;
        
        this.bonusStage.timer++;
        this.bonusStage.transitionTimer++;
        
        // Handle transition phases
        if (this.bonusStage.transitionPhase === 'flashing') {
            this.bonusStage.flashTimer++;
            // Wait for X key press to start flying (or auto-advance after 3 seconds)
            if (this.keys['KeyX'] || this.bonusStage.transitionTimer >= 180) { // 3 seconds max
                this.bonusStage.transitionPhase = 'flying';
                this.bonusStage.heroFlying = true;
                this.bonusStage.transitionTimer = 0;
            }
        } else if (this.bonusStage.transitionPhase === 'black') {
            // This phase is no longer needed, but keep for safety
            if (this.keys['KeyX']) {
                this.bonusStage.transitionPhase = 'flying';
                this.bonusStage.heroFlying = true;
                this.bonusStage.transitionTimer = 0;
            }
        } else if (this.bonusStage.transitionPhase === 'flying') {
            // Update flying hero
            this.updateFlyingHero();
            
            // Spawn clouds and raindrops
            this.updateBackClouds();
            this.updateClouds();
            this.updateFrontClouds();
            this.updateRaindrops();
            
            // Check for raindrop collection
            this.checkRaindropCollection();
            
            // Check if aqua power is full (30 drops collected)
            if (this.bonusStage.aquaPower >= this.bonusStage.maxAquaPower) {
                this.bonusStage.flashTimer++;
                if (this.bonusStage.flashTimer >= this.bonusStage.flashDuration) {
                    this.completeBonusStage();
                }
            }
            
            // End bonus stage after duration (DISABLED - only end when 20 drops collected)
            // if (this.bonusStage.timer >= this.bonusStage.duration && this.bonusStage.aquaPower < this.bonusStage.maxAquaPower) {
            //     this.completeBonusStage();
            // }
        }
    }
    
    updateStage2Intro() {
        if (!this.stage2Intro.active) return;
        
        this.stage2Intro.flashTimer++;
        
        // Wait for X key press to start Stage 2
        if (this.keys['KeyX']) {
            this.stage2Intro.active = false;
            this.startLevel2();
        }
    }
    
    updateStage3Intro() {
        if (!this.stage3Intro.active) return;
        
        this.stage3Intro.flashTimer++;
        
        // Wait for X key press to start Stage 3
        if (this.keys['KeyX']) {
            this.stage3Intro.active = false;
            this.startLevel3();
        }
    }
    
    updateFlyingHero() {
        // Hero moves up and down with arrow keys
        if (this.keys['ArrowUp'] && this.hero.y > 0) {
            this.hero.y -= 4;
        }
        if (this.keys['ArrowDown'] && this.hero.y < this.canvas.height - this.hero.height) {
            this.hero.y += 4;
        }
        
        // Hero moves quickly right, slowly left (flying effect)
        if (this.keys['ArrowRight']) {
            this.hero.x += 6; // Fast right movement
        }
        if (this.keys['ArrowLeft']) {
            this.hero.x -= 2; // Slow left movement
        }
        
        // Keep hero on screen
        if (this.hero.x < 0) this.hero.x = 0;
        if (this.hero.x > this.canvas.width - this.hero.width) {
            this.hero.x = this.canvas.width - this.hero.width;
        }
    }
    
    updateBackClouds() {
        // Spawn new back layer clouds (large to very large, half speed of middle layer)
        this.bonusStage.backCloudSpawnTimer++;
        if (this.bonusStage.backCloudSpawnTimer >= 120) { // Spawn every 2 seconds
            // Random size from large to very large
            const sizeVariants = [
                { width: 240, height: 120 },  // Large
                { width: 320, height: 160 },  // Very large
                { width: 400, height: 200 }   // Extra large
            ];
            const size = sizeVariants[Math.floor(Math.random() * sizeVariants.length)];
            
            this.bonusStage.backClouds.push({
                x: this.canvas.width + 50,
                y: Math.random() * this.canvas.height, // Any height randomly (full screen)
                width: size.width,
                height: size.height,
                speed: 1 // Half speed of middle layer (middle layer is 2px)
            });
            this.bonusStage.backCloudSpawnTimer = 0;
        }
        
        // Update back cloud positions
        this.bonusStage.backClouds = this.bonusStage.backClouds.filter(cloud => {
            cloud.x -= cloud.speed;
            return cloud.x > -400; // Remove when off screen (larger for very large clouds)
        });
    }
    
    updateClouds() {
        // Spawn new clouds
        this.bonusStage.cloudSpawnTimer++;
        if (this.bonusStage.cloudSpawnTimer >= 90) { // Spawn every 1.5 seconds
            this.bonusStage.clouds.push({
                x: this.canvas.width + 50,
                y: Math.random() * (this.canvas.height / 2) + 50, // Random height, not below halfway
                width: 160, // 100% bigger (was 80)
                height: 80, // 100% bigger (was 40)
                speed: 2
            });
            this.bonusStage.cloudSpawnTimer = 0;
        }
        
        // Update cloud positions
        this.bonusStage.clouds = this.bonusStage.clouds.filter(cloud => {
            cloud.x -= cloud.speed;
            return cloud.x > -200; // Remove when off screen (increased for bigger clouds)
        });
    }
    
    updateFrontClouds() {
        // Spawn new front layer clouds (3x faster than normal clouds)
        this.bonusStage.frontCloudSpawnTimer++;
        if (this.bonusStage.frontCloudSpawnTimer >= 30) { // Spawn every 0.5 seconds (3x faster)
            // Random size from small to medium
            const sizeVariants = [
                { width: 80, height: 40 },   // Small
                { width: 120, height: 60 },  // Medium-small
                { width: 160, height: 80 }   // Medium
            ];
            const size = sizeVariants[Math.floor(Math.random() * sizeVariants.length)];
            
            this.bonusStage.frontClouds.push({
                x: this.canvas.width + 50,
                y: Math.random() * this.canvas.height, // Any height randomly
                width: size.width,
                height: size.height,
                speed: 6 // 3x faster than normal clouds (was 2)
            });
            this.bonusStage.frontCloudSpawnTimer = 0;
        }
        
        // Update front cloud positions
        this.bonusStage.frontClouds = this.bonusStage.frontClouds.filter(cloud => {
            cloud.x -= cloud.speed;
            return cloud.x > -200; // Remove when off screen
        });
    }
    
    updateRaindrops() {
        // Spawn raindrops under clouds (75% less drops)
        this.bonusStage.raindropSpawnTimer++;
        if (this.bonusStage.raindropSpawnTimer >= 10) { // Spawn frequently
            this.bonusStage.clouds.forEach(cloud => {
                if (Math.random() < 0.075) { // 7.5% chance per cloud (75% reduction from 30%)
                    this.bonusStage.raindrops.push({
                        x: cloud.x + Math.random() * cloud.width,
                        y: cloud.y + cloud.height,
                        width: 4,
                        height: 8,
                        speedX: -1, // Move left with clouds
                        speedY: 3   // Fall down
                    });
                }
            });
            this.bonusStage.raindropSpawnTimer = 0;
        }
        
        // Update raindrop positions
        this.bonusStage.raindrops = this.bonusStage.raindrops.filter(drop => {
            drop.x += drop.speedX;
            drop.y += drop.speedY;
            return drop.x > -20 && drop.y < this.canvas.height + 20; // Remove when off screen
        });
    }
    
    checkRaindropCollection() {
        this.bonusStage.raindrops = this.bonusStage.raindrops.filter(drop => {
            if (this.isColliding(this.hero, drop)) {
                this.bonusStage.aquaPower += 1; // Collect 1 drop (need 20 total)
                this.playSound('shoot'); // Use water sound for collection
                return false; // Remove raindrop
            }
            return true; // Keep raindrop
        });
    }
    
    completeBonusStage() {
        this.bonusStage.active = false;
        // Check which stage we just completed to determine next stage
        if (this.currentStage === 1) {
            this.startStage2Intro();
        } else if (this.currentStage === 2) {
            this.startStage3Intro();
        }
    }
    
    startStage2Intro() {
        this.stage2Intro.active = true;
        this.stage2Intro.flashTimer = 0;
        this.state = GAME_STATES.STAGE2_INTRO;
    }
    
    startStage3Intro() {
        this.stage3Intro.active = true;
        this.stage3Intro.flashTimer = 0;
        this.state = GAME_STATES.STAGE3_INTRO;
    }
    
    renderStairs(stair) {
        let stairsImage;
        if (this.currentStage === 2) {
            stairsImage = this.images.ladder;
        } else if (this.currentStage === 3) {
            stairsImage = this.images.rope;
        } else {
            stairsImage = this.images.stairs;
        }
        
        if (stairsImage) {
            // Use custom stairs/ladder image
            this.ctx.drawImage(stairsImage, stair.x, stair.y, stair.width, stair.height);
        } else {
            // Fallback to code-generated stairs
            const stepCount = 5; // Number of steps
            const stepWidth = stair.width / stepCount;
            const stepHeight = stair.height / stepCount;
            
            // Draw each step
            for (let i = 0; i < stepCount; i++) {
                const stepX = stair.x + (i * stepWidth);
                const stepY = stair.y + (i * stepHeight);
                const currentStepWidth = stair.width - (i * stepWidth);
                const currentStepHeight = stepHeight;
                
                // Step top (light brown)
                this.ctx.fillStyle = "#d2b48c";
                this.ctx.fillRect(stepX, stepY, currentStepWidth, currentStepHeight);
                
                // Step front (dark brown)
                this.ctx.fillStyle = "#8b4513";
                this.ctx.fillRect(stepX, stepY + currentStepHeight, currentStepWidth, 3);
                
                // Step side (medium brown)
                this.ctx.fillStyle = "#a0522d";
                this.ctx.fillRect(stepX + currentStepWidth - 3, stepY, 3, currentStepHeight + 3);
                
                // Step highlight (light edge)
                this.ctx.fillStyle = "#f5deb3";
                this.ctx.fillRect(stepX, stepY, currentStepWidth, 2);
            }
            
            // Add a handrail
            this.ctx.fillStyle = "#654321";
            this.ctx.fillRect(stair.x - 5, stair.y - 10, 10, stair.height + 20);
            
            // Handrail posts
            for (let i = 0; i <= stepCount; i++) {
                const postX = stair.x - 5 + (i * stepWidth);
                const postY = stair.y - 10;
                this.ctx.fillStyle = "#654321";
                this.ctx.fillRect(postX, postY, 3, 8);
            }
        }
    }
    
    renderFireball(bullet) {
        if (this.images.fireBullet) {
            // Use custom fire bullet image
            this.ctx.drawImage(this.images.fireBullet, bullet.x, bullet.y, bullet.width, bullet.height);
        } else {
            // Fallback to code-generated fireball
            const centerX = bullet.x + bullet.width / 2;
            const centerY = bullet.y + bullet.height / 2;
            const radius = Math.max(bullet.width, bullet.height) / 2;
            
            // Outer fire (bright orange)
            this.ctx.fillStyle = "#ff4500";
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Middle fire (yellow-orange)
            this.ctx.fillStyle = "#ff6600";
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Inner fire (bright yellow)
            this.ctx.fillStyle = "#ffaa00";
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Core (white-hot)
            this.ctx.fillStyle = "#ffffff";
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius * 0.2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add some flame flicker effect
            const flicker = Math.sin(Date.now() * 0.01) * 2;
            this.ctx.fillStyle = "#ff2200";
            this.ctx.beginPath();
            this.ctx.arc(centerX + flicker, centerY, radius * 0.8, 0, Math.PI * 2);
            this.ctx.globalAlpha = 0.6;
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
        }
    }
    
    loadImages() {
        // Load images - you can replace these with your own image files
        const imageFiles = {
            hero: 'hero.png',           // Your hero image
            robot: 'robot.png',         // Your robot monkey image  
            robber: 'robber.png',       // Your bank robber image
            bullet: 'bullet.png',       // Your bullet/water pistol image
            menuBackground: 'menu.png', // Your menu background image
            levelBackground: 'levels.png', // Your level background image
            shield: 'shield.png',       // Your shield image
            stairs: 'stairs.png',       // Your stairs image
            fireBullet: 'firebullet.png', // Your fire bullet image
            // Level 2 images
            alien: 'alien.png',         // Your alien image for Level 2
            mutant: 'mutant.png',       // Your mutant image for Level 2
            ladder: 'ladder.png',       // Your industrial ladder image for Level 2
            l2Background: 'l2-background.png', // Your Level 2 background image
            // Level 3 images
            worm: 'worm.png',           // Your worm image for Level 3
            mole: 'mole.png',           // Your mole image for Level 3
            rope: 'rope.png',           // Your rope ladder image for Level 3
            l3Background: 'lv3-background.png', // Your Level 3 background image
            // Bonus stage images
            cloud: 'cloud.png',         // Your cloud image for bonus stage
            rainbow: 'rainbow.png',     // Your rainbow image for bonus stage
            sun: 'sun.png',             // Your sun image for bonus stage
            // Victory screen image
            victory: 'victory.png',     // Your victory background image
            // Game over screen image
            gameOver: 'gameover.png',    // Your game over background image
            // Drill attack images
            drill: 'drill.png',          // Your drill image for mole attacks
            ripple: 'ripple.png',        // Your ripple image for underground effects
            burst: 'burst.png'           // Your burst image for drill explosion
        };
        
        let loadedCount = 0;
        
        Object.keys(imageFiles).forEach(key => {
            const img = new Image();
            img.onload = () => {
                this.images[key] = img;
                loadedCount++;
                if (loadedCount === this.totalImages) {
                    this.init();
                    this.gameLoop();
                }
            };
            img.onerror = () => {
                console.log(`Image ${imageFiles[key]} not found, using fallback`);
                this.images[key] = null; // Will use colored rectangles as fallback
                loadedCount++;
                if (loadedCount === this.totalImages) {
                    this.init();
                    this.gameLoop();
                }
            };
            img.src = imageFiles[key];
        });
    }
    
    init() {
        this.createLevels();
        this.createHero();
        this.createRobber();
    }
    
    createLevels() {
        this.levels = [
            {
                name: "Bank Offices",
                y: 0,
                height: 200,
                color: "#4a4a4a",
                stairs: [{ x: 700, y: 150, width: 100, height: 50 }] // Top to middle stairs on the right
            },
            {
                name: "Bank Lobby",
                y: 200,
                height: 200,
                color: "#8b4513",
                stairs: [{ x: 0, y: 350, width: 100, height: 50 }] // Middle to bottom stairs on the left
            },
            {
                name: "Vault",
                y: 400,
                height: 200,
                color: "#ffd700",
                stairs: [] // No stairs - bottom level
            }
        ];
    }
    
    createHero() {
        this.hero = {
            x: 100,
            y: 50,
            width: 90,  // Tripled from 30
            height: 120, // Tripled from 40
            speed: 5,
            color: "#00ff00",
            level: 0,
            canShoot: true,
            shootCooldown: 0,
            direction: 1, // 1 for right, -1 for left
            shieldActive: false,
            shieldEnergy: 100,
            shieldCooldown: 0,
            // Jumping mechanics
            isJumping: false,
            jumpVelocity: 0,
            jumpPower: 15,
            gravity: 0.8,
            groundY: 50 // Base Y position for current level
        };
    }
    
    createRobber(health = 3) {
        this.robber = {
            x: 400,
            y: 420, // Position on the vault level (level 2)
            width: 120,  // Tripled from 40
            height: 150, // Tripled from 50
            color: "#ff0000",
            health: health,
            defeated: false,
            level: 2, // Explicitly set to vault level
            canShoot: true,
            shootCooldown: 0,
            lastShotTime: 0,
            // Movement and jumping
            speed: 2,
            direction: 1, // 1 for right, -1 for left
            isJumping: false,
            jumpVelocity: 0,
            jumpPower: 12,
            gravity: 0.6,
            groundY: 420,
            moveTimer: 0,
            moveInterval: 120 + Math.random() * 120, // 2-4 seconds at 60fps
            lastMoveTime: 0,
            // Burst firing for Level 2
            burstMode: false,
            burstCount: 0,
            burstDelay: 0,
            burstCooldown: 0
        };
    }
    
    spawnRobots(count = 4) {
        this.robots = [];
        
        // Spawn robots on bottom level and middle level
        const bottomLevel = this.levels[2]; // Bottom level (index 2)
        const middleLevel = this.levels[1]; // Middle level (index 1)
        
        const bottomCount = Math.floor(count / 2);
        const middleCount = count - bottomCount;
        
        // First robots start on bottom level - just patrol back and forth
        for (let i = 0; i < bottomCount; i++) {
            this.robots.push({
                x: 150 + i * 150 + Math.random() * 30, // Better spacing, avoid stairs area
                y: bottomLevel.y + 20,
                width: 75,  // Tripled from 25
                height: 90, // Tripled from 30
                speed: 2 + Math.random() * 2,
                direction: Math.random() > 0.5 ? 1 : -1,
                color: "#ff6600",
                level: 2, // Stay on bottom level (Vault)
                // Jumping mechanics
                isJumping: false,
                jumpVelocity: 0,
                jumpPower: 12,
                gravity: 0.8,
                groundY: bottomLevel.y + 20,
                jumpTimer: 0,
                jumpDelay: 120 + Math.random() * 120 // 2-4 seconds at 60fps
            });
        }
        
        // Next robots start on middle level - just patrol back and forth
        for (let i = bottomCount; i < count; i++) {
            this.robots.push({
                x: 150 + (i - bottomCount) * 150 + Math.random() * 30, // Better spacing, avoid stairs area
                y: middleLevel.y + 20,
                width: 75,  // Tripled from 25
                height: 90, // Tripled from 30
                speed: 2 + Math.random() * 2,
                direction: Math.random() > 0.5 ? 1 : -1,
                color: "#ff6600",
                level: 1, // Stay on middle level (Bank Lobby)
                // Jumping mechanics
                isJumping: false,
                jumpVelocity: 0,
                jumpPower: 12,
                gravity: 0.8,
                groundY: middleLevel.y + 20,
                jumpTimer: 0,
                jumpDelay: 120 + Math.random() * 120 // 2-4 seconds at 60fps
            });
        }
    }
    
    startGame() {
        this.state = GAME_STATES.PLAYING;
        this.score = 0;
        this.lives = 3;
        this.currentLevel = 0;
        this.createHero();
        this.createRobber();
        this.spawnRobots();
        this.bullets = [];
    }
    
    resetGame() {
        this.state = GAME_STATES.MENU;
        this.currentStage = 1; // Always reset to Stage 1 (Bank)
        this.currentLevel = 0; // Reset to top level
        this.bullets = [];
        this.robberBullets = [];
        this.robots = [];
        this.drillAttacks = []; // Reset drill attacks
        
        // Reset to Stage 1 levels (Bank)
        this.createLevels();
        this.createHero();
        this.createRobber();
        this.spawnRobots(4); // Spawn 4 robots for Stage 1
        
        // Reset victory animation
        this.victoryAnimation.active = false;
        this.victoryAnimation.timer = 0;
        this.victoryAnimation.robberFallen = false;
        this.victoryAnimation.balloons = [];
        this.victoryAnimation.confetti = [];
        
        // Reset bonus stage
        this.bonusStage.active = false;
        this.bonusStage.timer = 0;
        this.bonusStage.aquaPower = 0;
        this.bonusStage.heroFlying = false;
        this.bonusStage.flashTimer = 0;
        this.bonusStage.clouds = [];
        this.bonusStage.raindrops = [];
        this.bonusStage.cloudSpawnTimer = 0;
        this.bonusStage.raindropSpawnTimer = 0;
        this.bonusStage.transitionTimer = 0;
        this.bonusStage.transitionPhase = 'flashing';
        this.bonusStage.emergencyMessage = false;
        this.bonusStage.backClouds = [];
        this.bonusStage.backCloudSpawnTimer = 0;
        this.bonusStage.frontClouds = [];
        this.bonusStage.frontCloudSpawnTimer = 0;
        
        // Reset stage 2 intro
        this.stage2Intro.active = false;
        this.stage2Intro.flashTimer = 0;
        
        // Reset stage 3 intro
        this.stage3Intro.active = false;
        this.stage3Intro.flashTimer = 0;
    }
    
    update() {
        // Always update victory animation, bonus stage, and stage intros regardless of state
        this.updateVictoryAnimation();
        this.updateBonusStage();
        this.updateStage2Intro();
        this.updateStage3Intro();
        
        // Only update game logic when playing
        if (this.state !== GAME_STATES.PLAYING) return;
        
        this.updateHero();
        this.updateRobots();
        this.updateRobber();
        this.updateBullets();
        this.updateRobberBullets();
        this.updateDrillAttacks();
        this.checkCollisions();
        this.checkLevelCompletion();
    }
    
    updateHero() {
        // Horizontal movement
        if (this.keys['ArrowLeft'] && this.hero.x > 0) {
            this.hero.x -= this.hero.speed;
            this.hero.direction = -1; // Facing left
        }
        if (this.keys['ArrowRight'] && this.hero.x < this.canvas.width - this.hero.width) {
            this.hero.x += this.hero.speed;
            this.hero.direction = 1; // Facing right
        }
        
        // Jumping mechanics
        if (this.keys['ArrowUp'] && !this.hero.isJumping) {
            this.hero.isJumping = true;
            this.hero.jumpVelocity = -this.hero.jumpPower; // Negative for upward movement
        }
        
        // Apply gravity and jumping physics
        if (this.hero.isJumping) {
            this.hero.y += this.hero.jumpVelocity;
            this.hero.jumpVelocity += this.hero.gravity;
            
            // Check if landed back on ground
            if (this.hero.y >= this.hero.groundY) {
                this.hero.y = this.hero.groundY;
                this.hero.isJumping = false;
                this.hero.jumpVelocity = 0;
            }
        }
        
        // Shooting
        if (this.hero.shootCooldown > 0) {
            this.hero.shootCooldown--;
        }
        
        if (this.keys['KeyX'] && this.hero.canShoot && this.hero.shootCooldown === 0) {
            this.shoot();
            this.hero.shootCooldown = 20; // Cooldown frames
            this.playSound('shoot');
        }
        
        // Shield system
        if (this.hero.shieldCooldown > 0) {
            this.hero.shieldCooldown--;
        }
        
        // Activate shield with 'Z' key (UNLIMITED FOR TESTING)
        if (this.keys['KeyZ']) { // && this.hero.shieldEnergy > 0 && this.hero.shieldCooldown === 0) {
            if (!this.hero.shieldActive) {
                this.playSound('shield'); // Play sound when shield activates
            }
            this.hero.shieldActive = true;
        } else {
            this.hero.shieldActive = false;
        }
        
        // Shield energy drains when active (DISABLED FOR TESTING)
        // if (this.hero.shieldActive && this.hero.shieldEnergy > 0) {
        //     this.hero.shieldEnergy -= 0.5; // Drain energy
        //     if (this.hero.shieldEnergy <= 0) {
        //         this.hero.shieldActive = false;
        //         this.hero.shieldCooldown = 120; // 2 second cooldown when depleted
        //     }
        // }
        
        // Shield energy regenerates when not active
        if (!this.hero.shieldActive && this.hero.shieldEnergy < 100) {
            this.hero.shieldEnergy += 0.2; // Regenerate energy
        }
        
        // Level transitions
        if (this.keys['ArrowDown']) {
            this.tryGoDownStairs();
        }
        
        // Update ground position for current level
        const currentLevel = this.levels[this.hero.level];
        this.hero.groundY = currentLevel.y + 20;
        
        // Keep hero on ground when not jumping
        if (!this.hero.isJumping) {
            this.hero.y = this.hero.groundY;
        }
    }
    
    tryGoDownStairs() {
        const currentLevel = this.levels[this.hero.level];
        if (currentLevel.stairs.length > 0) {
            const stairs = currentLevel.stairs[0];
            if (this.hero.x >= stairs.x && this.hero.x <= stairs.x + stairs.width && !this.hero.isJumping) {
                this.hero.level++;
                if (this.hero.level >= this.levels.length) {
                    this.hero.level = this.levels.length - 1;
                }
                // Reset jumping state when changing levels
                this.hero.isJumping = false;
                this.hero.jumpVelocity = 0;
            }
        }
    }
    
    shoot() {
        // Shoot horizontally in the direction the hero is facing
        const direction = this.hero.direction || 1; // Default to right
        this.bullets.push({
            x: this.hero.x + this.hero.width / 2,
            y: this.hero.y + this.hero.height / 2,
            width: 30,  // Tripled from 10
            height: 15, // Tripled from 5
            speed: 8,
            direction: direction,
            color: "#00ffff",
            level: this.hero.level
        });
    }
    
    updateRobots() {
        this.robots.forEach(robot => {
            // Update jump timer
            robot.jumpTimer++;
            
            // Check if robot should jump (random intervals 2-4 seconds)
            if (robot.jumpTimer >= robot.jumpDelay && !robot.isJumping) {
                robot.isJumping = true;
                robot.jumpVelocity = -robot.jumpPower; // Negative for upward movement
                robot.jumpTimer = 0;
                robot.jumpDelay = 120 + Math.random() * 120; // Reset delay: 2-4 seconds
            }
            
            // Handle jumping physics
            if (robot.isJumping) {
                robot.jumpVelocity += robot.gravity;
                robot.y += robot.jumpVelocity;
                
                // Check if robot has landed
                if (robot.y >= robot.groundY) {
                    robot.y = robot.groundY;
                    robot.isJumping = false;
                    robot.jumpVelocity = 0;
                }
            }
            
            // Normal horizontal movement (back and forth) - same for all stages
            robot.x += robot.speed * robot.direction;
            
            // Bounce off walls with better boundary checking
            if (robot.x <= 0) {
                robot.x = 0;
                robot.direction = 1; // Force right direction
            } else if (robot.x >= this.canvas.width - robot.width) {
                robot.x = this.canvas.width - robot.width;
                robot.direction = -1; // Force left direction
            }
        });
    }
    
    updateRobber() {
        if (this.robber.defeated) {
            // Robber is defeated - stop all movement
            return;
        }
        
        // Robber shooting cooldown
        if (this.robber.shootCooldown > 0) {
            this.robber.shootCooldown--;
        }
        
        // Continuous horizontal movement (same for all stages)
        this.robber.x += this.robber.speed * this.robber.direction;
        
        // Bounce off walls and change direction
        if (this.robber.x <= 0 || this.robber.x >= this.canvas.width - this.robber.width) {
            this.robber.direction *= -1;
            // Keep robber within bounds
            this.robber.x = Math.max(0, Math.min(this.canvas.width - this.robber.width, this.robber.x));
        }
        
        // Robber movement and jumping every 2-4 seconds (random) - same for all stages
        this.robber.moveTimer++;
        if (this.robber.moveTimer >= this.robber.moveInterval) {
            this.robber.moveTimer = 0;
            this.robberMoveAndJump();
            // Set new random interval for next action (2-4 seconds)
            this.robber.moveInterval = 120 + Math.random() * 120; // 2-4 seconds at 60fps
        }
        
        // Apply jumping physics
        if (this.robber.isJumping) {
            this.robber.y += this.robber.jumpVelocity;
            this.robber.jumpVelocity += this.robber.gravity;
            
            // Check if landed back on ground
            if (this.robber.y >= this.robber.groundY) {
                this.robber.y = this.robber.groundY;
                this.robber.isJumping = false;
                this.robber.jumpVelocity = 0;
            }
        }
        
        // Robber shoots back when shot (with some delay)
        const currentTime = Date.now();
        // Robber shooting (different weapons for each stage)
        if (this.currentStage === 2) {
            this.updateMutantBurstFiring();
        } else if (this.currentStage === 3) {
            this.updateMolemanDrillFiring();
        } else {
            // Original single-shot firing for Level 1
            if (this.robber.canShoot && this.robber.shootCooldown === 0 && 
                currentTime - this.robber.lastShotTime > 1000) { // 1 second delay
                
                this.robberShoot();
                this.robber.shootCooldown = 60; // 1 second cooldown
                this.robber.lastShotTime = currentTime;
            }
        }
    }
    
    robberMoveAndJump() {
        // Random movement choices
        const moveChoices = ['jump', 'changeDirection', 'stay'];
        const choice = moveChoices[Math.floor(Math.random() * moveChoices.length)];
        
        switch (choice) {
            case 'jump':
                if (!this.robber.isJumping) {
                    this.robber.isJumping = true;
                    this.robber.jumpVelocity = -this.robber.jumpPower;
                }
                break;
            case 'changeDirection':
                // Change direction randomly
                this.robber.direction = Math.random() > 0.5 ? 1 : -1;
                break;
            case 'stay':
                // Stay in place, maybe just change direction
                this.robber.direction = Math.random() > 0.5 ? 1 : -1;
                break;
        }
    }
    
    updateBullets() {
        this.bullets = this.bullets.filter(bullet => {
            bullet.x += bullet.speed * bullet.direction;
            return bullet.x > 0 && bullet.x < this.canvas.width;
        });
    }
    
    updateRobberBullets() {
        this.robberBullets = this.robberBullets.filter(bullet => {
            bullet.x -= bullet.speed; // Robber bullets move left (toward hero)
            return bullet.x > -50; // Remove when off screen
        });
    }
    
    updateDrillAttacks() {
        this.drillAttacks = this.drillAttacks.filter(attack => {
            attack.timer++;
            
            if (attack.phase === 'ripples') {
                // Create traveling ripples across all levels
                attack.rippleSpawnTimer++;
                
                // Spawn new ripples periodically
                if (attack.rippleSpawnTimer >= attack.rippleSpawnInterval && 
                    attack.ripples.length < attack.maxRipples) {
                    
                    // Create ripple only on the hero's current level - positioned on the floor
                    const heroLevel = this.hero.level;
                    const levelFloorY = this.levels[heroLevel].y + this.levels[heroLevel].height - 10; // Floor of hero's level
                    
                    attack.ripples.push({
                        x: this.robber.x + this.robber.width / 2, // Start from mole position
                        y: levelFloorY, // On the floor of the hero's level
                        targetX: attack.targetX, // Travel toward hero's position
                        targetY: levelFloorY, // Stay on the floor
                        radius: 40, // Four times bigger (was 10)
                        maxRadius: 160, // Four times bigger (was 40)
                        opacity: 1.0,
                        timer: 0,
                        speed: 3, // Pixels per frame
                        level: heroLevel
                    });
                    
                    attack.rippleSpawnTimer = 0;
                }
                
                // Move to drilling phase after 3 seconds of ripples
                if (attack.timer >= 180) { // 3 seconds at 60fps
                    attack.phase = 'drilling';
                    attack.timer = 0;
                }
            } else if (attack.phase === 'drilling') {
                // Play scraping sound when drilling starts
                if (!attack.soundPlayed.scraping) {
                    this.playSound('drillScraping'); // Sound 2: Scraping noise
                    attack.soundPlayed.scraping = true;
                }
                
                // Drilling phase - show progress for 1.5 seconds
                attack.drillProgress = Math.min(attack.timer / 90, 1.0); // 1.5 seconds
                
                // Move to burst phase
                if (attack.timer >= 90) {
                    attack.phase = 'burst';
                    attack.burstActive = true;
                    attack.burstTimer = 0;
                    attack.timer = 0;
                }
            } else if (attack.phase === 'burst') {
                // Play burst sound when burst starts
                if (!attack.soundPlayed.burst) {
                    this.playSound('drillBurst'); // Sound 3: Burst and damage
                    attack.soundPlayed.burst = true;
                }
                
                // Burst phase - dangerous area for 1 second
                attack.burstTimer++;
                
                // End attack after burst phase
                if (attack.burstTimer >= 60) { // 1 second
                    return false; // Remove this attack
                }
            }
            
            // Update ripple animations - make them travel horizontally
            attack.ripples = attack.ripples.filter(ripple => {
                ripple.timer++;
                
                // Move ripple toward target position
                const dx = ripple.targetX - ripple.x;
                const dy = ripple.targetY - ripple.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > ripple.speed) {
                    // Move toward target
                    ripple.x += (dx / distance) * ripple.speed;
                    ripple.y += (dy / distance) * ripple.speed;
                } else {
                    // Reached target, start expanding
                    ripple.radius += 0.5;
                    ripple.opacity -= 0.02;
                }
                
                // Remove ripple if it's too faded or too large
                return ripple.opacity > 0 && ripple.radius < ripple.maxRadius;
            });
            
            return true; // Keep this attack
        });
    }
    
    updateMutantBurstFiring() {
        // Burst firing system for mutant (Level 2)
        if (this.robber.burstCooldown > 0) {
            this.robber.burstCooldown--;
            return;
        }
        
        if (!this.robber.burstMode) {
            // Start new burst
            this.robber.burstMode = true;
            this.robber.burstCount = 0;
            this.robber.burstDelay = 8; // Start with delay to prevent immediate firing
        }
        
        if (this.robber.burstMode) {
            this.robber.burstDelay--;
            
            if (this.robber.burstDelay <= 0 && this.robber.burstCount < 4) {
                // Fire a laser in the burst
                this.mutantShootLaser();
                this.robber.burstCount++;
                this.robber.burstDelay = 8; // 8 frames between lasers in burst (about 0.13 seconds)
            }
            
            if (this.robber.burstCount >= 4) {
                // Burst complete, start cooldown
                this.robber.burstMode = false;
                this.robber.burstCooldown = 120; // 2 seconds cooldown (120 frames at 60fps)
            }
        }
    }
    
    updateMolemanDrillFiring() {
        // Underground drill attack system for moleman (Level 3)
        if (this.robber.canShoot && this.robber.shootCooldown === 0) {
            const currentTime = Date.now();
            if (currentTime - this.robber.lastShotTime >= 4000) { // 4 second delay between drill attacks (much slower)
                this.molemanStartDrillAttack();
                this.robber.shootCooldown = 240; // 4 second cooldown
                this.robber.lastShotTime = currentTime;
            }
        }
    }
    
    molemanStartDrillAttack() {
        // Start underground drill attack - create ripples across all levels
        this.playerTargetPosition.x = this.hero.x + this.hero.width / 2;
        this.playerTargetPosition.y = this.hero.y + this.hero.height / 2; // Target hero's center height
        
        // Create drill attack sequence with traveling ripples
        this.drillAttacks.push({
            targetX: this.playerTargetPosition.x,
            targetY: this.playerTargetPosition.y,
            phase: 'ripples', // ripples -> drilling -> burst
            timer: 0,
            ripples: [],
            drillProgress: 0,
            burstActive: false,
            burstTimer: 0,
            soundPlayed: {
                fire: false,
                scraping: false,
                burst: false
            },
            // New properties for traveling ripples
            rippleSpawnTimer: 0,
            rippleSpawnInterval: 30, // Spawn new ripple every 30 frames (0.5 seconds)
            maxRipples: 3 // Maximum ripples on screen at once (reduced since only one level)
        });
        
        this.playSound('drillFire'); // Sound 1: Drill firing
    }
    
    mutantShootLaser() {
        // Mutant shoots horizontal laser
        this.robberBullets.push({
            x: this.robber.x,
            y: this.robber.y + this.robber.height / 2,
            width: 40,
            height: 8,
            speed: 8,
            color: "#ff0000", // Red laser color
            level: 2,
            isLaser: true // Mark as laser bullet
        });
        this.playSound('laser'); // Laser sound
    }
    
    robberShoot() {
        // Robber shoots fireballs toward the hero
        this.robberBullets.push({
            x: this.robber.x,
            y: this.robber.y + this.robber.height / 2,
            width: 30,
            height: 15,
            speed: 6,
            color: "#ff4500", // Fire orange color
            level: 2,
            isFire: true // Mark as fire bullet
        });
        this.playSound('fire'); // Fire sound for robber's fireballs
    }
    
    checkCollisions() {
        // Hero vs Robots (only collide if hero is on ground or falling)
        this.robots.forEach((robot, robotIndex) => {
            if (this.hero.level === robot.level && this.isColliding(this.hero, robot)) {
                // Only take damage if hero is not jumping or is falling down
                if (!this.hero.isJumping || this.hero.jumpVelocity > 0) {
                    this.lives--;
                    this.robots.splice(robotIndex, 1);
                    this.playSound('hit');
                    
                    if (this.lives <= 0) {
                        this.state = GAME_STATES.GAME_OVER;
                        this.playSound('gameOver');
                    }
                } else {
                    // Hero is jumping over the robot - give bonus points!
                    this.robots.splice(robotIndex, 1);
                    this.score += 50; // Bonus for jumping over robots
                }
            }
        });
        
        // Bullets vs Robots
        this.bullets.forEach((bullet, bulletIndex) => {
            this.robots.forEach((robot, robotIndex) => {
                if (bullet.level === robot.level && this.isColliding(bullet, robot)) {
                    // Create explosion effect
                    this.createExplosion(robot.x, robot.y);
                    this.playSound('explosion');
                    this.playSound('monkey'); // Monkey noise when robot gets shot
                    
                    this.bullets.splice(bulletIndex, 1);
                    this.robots.splice(robotIndex, 1);
                    this.score += 100;
                }
            });
        });
        
        // Bullets vs Robber
        if (!this.robber.defeated) {
            this.bullets.forEach((bullet, bulletIndex) => {
                if (bullet.level === 2 && this.isColliding(bullet, this.robber)) {
                    this.robber.health--;
                    this.bullets.splice(bulletIndex, 1);
                    this.score += 200; // Bonus points for hitting robber
                    this.playSound('hit');
                    
                    // Trigger robber to shoot back
                    this.robber.lastShotTime = 0; // Reset timer to allow immediate response
                    
                    if (this.robber.health <= 0) {
                        this.robber.defeated = true;
                        this.startVictoryAnimation();
                        this.playSound('cheer'); // Cheer sound when robber is defeated
                    }
                }
            });
        }
        
        // Robber bullets vs Hero
        this.robberBullets.forEach((bullet, bulletIndex) => {
            if (this.hero.level === 2 && this.isColliding(bullet, this.hero)) {
                // Check if shield is active
                if (this.hero.shieldActive) {
                    // Shield blocks the bullet
                    this.robberBullets.splice(bulletIndex, 1);
                    // Shield takes some damage (DISABLED FOR TESTING)
                    // this.hero.shieldEnergy -= 20;
                    this.playSound('shield'); // Shield block sound
                    // if (this.hero.shieldEnergy <= 0) {
                    //     this.hero.shieldActive = false;
                    //     this.hero.shieldCooldown = 120;
                    // }
                } else {
                    // No shield - hero takes damage
                    this.lives--;
                    this.robberBullets.splice(bulletIndex, 1);
                    this.playSound('hit');
                    
                    if (this.lives <= 0) {
                        this.state = GAME_STATES.GAME_OVER;
                        this.playSound('gameOver');
                    }
                }
            }
        });
        
        // Drill attacks vs Hero (only during burst phase)
        this.drillAttacks.forEach((attack, attackIndex) => {
            if (attack.phase === 'burst') {
                // Check if hero is in the danger zone (40 pixel radius)
                // Use hero's current position, not the original target position
                const distance = Math.sqrt(
                    Math.pow(this.hero.x + this.hero.width/2 - attack.targetX, 2) + 
                    Math.pow(this.hero.y + this.hero.height/2 - attack.targetY, 2)
                );
                
                if (distance <= 40) { // Damage radius to match visual effect
                    // Check if shield is active
                    if (this.hero.shieldActive) {
                        // Shield blocks the drill burst
                        this.playSound('shield'); // Shield block sound
                        // Shield takes some damage (DISABLED FOR TESTING)
                        // this.hero.shieldEnergy -= 30;
                        // if (this.hero.shieldEnergy <= 0) {
                        //     this.hero.shieldActive = false;
                        //     this.hero.shieldCooldown = 120;
                        // }
                    } else {
                        // No shield - hero takes damage
                        this.lives--;
                        this.playSound('hit');
                        
                        // Add visual damage feedback
                        this.createExplosion(this.hero.x + this.hero.width/2, this.hero.y + this.hero.height/2);
                        
                        if (this.lives <= 0) {
                            this.state = GAME_STATES.GAME_OVER;
                            this.playSound('gameOver');
                        }
                    }
                }
            }
        });
    }
    
    checkLevelCompletion() {
        // Check if all robots on current level are defeated
        const robotsOnLevel = this.robots.filter(robot => robot.level === this.hero.level);
        if (robotsOnLevel.length === 0 && this.hero.level < 2) {
            // Level cleared, can proceed
        }
    }
    
    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    createExplosion(x, y) {
        // Simple explosion effect
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                this.ctx.fillStyle = "#ffff00";
                this.ctx.fillRect(x + Math.random() * 20 - 10, y + Math.random() * 20 - 10, 3, 3);
            }, i * 50);
        }
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.state === GAME_STATES.MENU) {
            this.renderMenu();
        } else if (this.state === GAME_STATES.STAGE_SELECTION) {
            this.renderStageSelection();
        } else if (this.state === GAME_STATES.PLAYING) {
            this.renderGame();
        } else if (this.state === GAME_STATES.GAME_OVER) {
            this.renderGameOver();
        } else if (this.state === GAME_STATES.VICTORY) {
            this.renderVictory();
        } else if (this.state === GAME_STATES.CONGRATULATIONS) {
            this.renderCongratulations();
        } else if (this.state === GAME_STATES.BONUS_STAGE) {
            this.renderBonusStage();
        } else if (this.state === GAME_STATES.STAGE2_INTRO) {
            this.renderStage2Intro();
        } else if (this.state === GAME_STATES.STAGE3_INTRO) {
            this.renderStage3Intro();
        }
    }
    
    renderBonusStage() {
        // Handle transition phases
        if (this.bonusStage.transitionPhase === 'flashing') {
            // Flashing screen
            const flash = Math.floor(this.bonusStage.flashTimer / 10) % 2;
            this.ctx.fillStyle = flash ? "#ffffff" : "#ff0000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Emergency message
            this.ctx.fillStyle = "#000000";
            this.ctx.font = "bold 24px Courier New";
            this.ctx.textAlign = "center";
            this.ctx.fillText("EMERGENCY REPORTED!", this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.fillText("Fly through the clouds to fill up your Aqua-Power", this.canvas.width / 2, this.canvas.height / 2 - 10);
            
            // Press X to Start instruction
            this.ctx.fillStyle = "#00ff00";
            this.ctx.font = "bold 20px Courier New";
            this.ctx.fillText("Press X to Start", this.canvas.width / 2, this.canvas.height / 2 + 30);
            
        } else if (this.bonusStage.transitionPhase === 'black') {
            // Black screen with message
            this.ctx.fillStyle = "#000000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "bold 24px Courier New";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Emergency reported! Fly through the clouds to fill up your Aqua-Power", this.canvas.width / 2, this.canvas.height / 2 - 30);
            
            // Press X to Start instruction
            this.ctx.fillStyle = "#00ff00";
            this.ctx.font = "bold 20px Courier New";
            this.ctx.fillText("Press X to Start", this.canvas.width / 2, this.canvas.height / 2 + 30);
            
        } else if (this.bonusStage.transitionPhase === 'flying') {
            // Sky background
            this.ctx.fillStyle = "#87CEEB"; // Sky blue
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Render sunshine in top-left corner
            this.renderSunshine();
            
            // Render back layer clouds (behind normal clouds)
            this.bonusStage.backClouds.forEach(cloud => {
                this.ctx.save();
                this.ctx.globalAlpha = 0.7; // 70% transparent (more transparent than normal clouds)
                
                if (this.images.cloud) {
                    // Use custom cloud image
                    this.ctx.drawImage(this.images.cloud, cloud.x, cloud.y, cloud.width, cloud.height);
                } else {
                    // Fallback: draw procedural clouds
                    this.ctx.fillStyle = "#ffffff";
                    this.ctx.fillRect(cloud.x, cloud.y, cloud.width, cloud.height);
                    
                    // Add some cloud detail
                    this.ctx.fillStyle = "#f0f0f0";
                    this.ctx.fillRect(cloud.x + 10, cloud.y + 5, cloud.width - 20, cloud.height - 10);
                }
                
                this.ctx.restore();
            });
            
            // Render clouds (middle layer)
            this.bonusStage.clouds.forEach(cloud => {
                if (this.images.cloud) {
                    // Use custom cloud image
                    this.ctx.drawImage(this.images.cloud, cloud.x, cloud.y, cloud.width, cloud.height);
                } else {
                    // Fallback: draw procedural clouds
                    this.ctx.fillStyle = "#ffffff";
                    this.ctx.fillRect(cloud.x, cloud.y, cloud.width, cloud.height);
                    
                    // Add some cloud detail
                    this.ctx.fillStyle = "#f0f0f0";
                    this.ctx.fillRect(cloud.x + 10, cloud.y + 5, cloud.width - 20, cloud.height - 10);
                }
            });
            
            // Render rainbow in front of clouds (new layer)
            this.renderRainbow();
            
            // Render front layer clouds (fast-moving, transparent, different sizes)
            this.bonusStage.frontClouds.forEach(cloud => {
                this.ctx.save();
                this.ctx.globalAlpha = 0.4; // 60% transparent (less transparent)
                
                if (this.images.cloud) {
                    // Use custom cloud image
                    this.ctx.drawImage(this.images.cloud, cloud.x, cloud.y, cloud.width, cloud.height);
                } else {
                    // Fallback: draw procedural clouds
                    this.ctx.fillStyle = "#ffffff";
                    this.ctx.fillRect(cloud.x, cloud.y, cloud.width, cloud.height);
                    
                    // Add some cloud detail
                    this.ctx.fillStyle = "#f0f0f0";
                    this.ctx.fillRect(cloud.x + 10, cloud.y + 5, cloud.width - 20, cloud.height - 10);
                }
                
                this.ctx.restore();
            });
            
            // Render raindrops
            this.bonusStage.raindrops.forEach(drop => {
                this.ctx.fillStyle = "#4169E1"; // Royal blue
                this.ctx.fillRect(drop.x, drop.y, drop.width, drop.height);
            });
            
            // Render flying hero
            if (this.bonusStage.heroFlying) {
                // Hero flash effect when aqua power is full
                if (this.bonusStage.aquaPower >= this.bonusStage.maxAquaPower) {
                    const flash = Math.floor(this.bonusStage.flashTimer / 5) % 2;
                    this.ctx.fillStyle = flash ? "#0066ff" : "#ffff00";
                    this.ctx.fillRect(this.hero.x - 5, this.hero.y - 5, this.hero.width + 10, this.hero.height + 10);
                }
                
                // Render hero (rotated for flying)
                this.ctx.save();
                this.ctx.translate(this.hero.x + this.hero.width / 2, this.hero.y + this.hero.height / 2);
                this.ctx.rotate(Math.PI / 2); // Rotate 90 degrees for flying
                
                if (this.images.hero) {
                    this.ctx.drawImage(this.images.hero, -this.hero.width / 2, -this.hero.height / 2, this.hero.width, this.hero.height);
                } else {
                    this.ctx.fillStyle = this.hero.color;
                    this.ctx.fillRect(-this.hero.width / 2, -this.hero.height / 2, this.hero.width, this.hero.height);
                }
                this.ctx.restore();
            }
            
            // Render aqua power bar
            this.renderAquaPowerBar();
            
            // Render timer (DISABLED - no time limit)
            // const timeLeft = Math.max(0, Math.floor((this.bonusStage.duration - this.bonusStage.timer) / 60));
            // this.ctx.fillStyle = "#000000";
            // this.ctx.font = "bold 20px Courier New";
            // this.ctx.textAlign = "right";
            // this.ctx.fillText(`Time: ${timeLeft}s`, this.canvas.width - 20, 30);
        }
    }
    
    renderSunshine() {
        // Draw sunshine in top-left corner - 200% bigger (3x original size)
        const sunX = 50;
        const sunY = 50;
        const sunSize = 180; // 200% bigger: 60 * 3 = 180
        
        if (this.images.sun) {
            // Use custom sun image - 200% bigger
            this.ctx.drawImage(this.images.sun, sunX - sunSize/2, sunY - sunSize/2, sunSize, sunSize);
        } else {
            // Fallback: draw procedural sun - 200% bigger
            const sunRadius = 90; // 200% bigger: 30 * 3 = 90
            
            // Sun rays - scaled up
            this.ctx.strokeStyle = "#FFD700";
            this.ctx.lineWidth = 9; // 200% bigger: 3 * 3 = 9
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI * 2) / 8;
                const startX = sunX + Math.cos(angle) * (sunRadius + 30); // 200% bigger: 10 * 3 = 30
                const startY = sunY + Math.sin(angle) * (sunRadius + 30);
                const endX = sunX + Math.cos(angle) * (sunRadius + 75); // 200% bigger: 25 * 3 = 75
                const endY = sunY + Math.sin(angle) * (sunRadius + 75);
                
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();
            }
            
            // Sun body
            this.ctx.fillStyle = "#FFD700";
            this.ctx.beginPath();
            this.ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Sun face - scaled up
            this.ctx.fillStyle = "#000000";
            this.ctx.beginPath();
            this.ctx.arc(sunX - 24, sunY - 24, 9, 0, Math.PI * 2); // Left eye - 200% bigger: 8 * 3 = 24, 3 * 3 = 9
            this.ctx.arc(sunX + 24, sunY - 24, 9, 0, Math.PI * 2); // Right eye
            this.ctx.fill();
            
            // Smile - scaled up
            this.ctx.strokeStyle = "#000000";
            this.ctx.lineWidth = 6; // 200% bigger: 2 * 3 = 6
            this.ctx.beginPath();
            this.ctx.arc(sunX, sunY + 15, 36, 0, Math.PI); // 200% bigger: 5 * 3 = 15, 12 * 3 = 36
            this.ctx.stroke();
        }
    }
    
    renderRainbow() {
        // Draw rainbow image bigger than screen - starts at halfway point, extends over right and bottom borders
        this.ctx.save();
        this.ctx.globalAlpha = 0.25; // 75% transparent (front layer)
        
        if (this.images.rainbow) {
            // Use custom rainbow image - bigger than screen, starts at halfway point
            const rainbowWidth = this.canvas.width * 0.6; // 60% of screen width (bigger)
            const rainbowHeight = this.canvas.height * 1.2; // 120% of screen height (extends beyond bottom)
            const rainbowX = this.canvas.width / 2; // Start at halfway point
            const rainbowY = this.canvas.height * 0.2; // Start further down to eliminate gap at top
            
            this.ctx.drawImage(this.images.rainbow, rainbowX, rainbowY, rainbowWidth, rainbowHeight);
        } else {
            // Fallback: draw procedural rainbow bigger than screen
            const rainbowWidth = this.canvas.width * 0.6; // 60% of screen width (bigger)
            const rainbowX = this.canvas.width / 2; // Start at halfway point
            const rainbowY = this.canvas.height / 2; // Center vertically
            const rainbowRadius = this.canvas.height * 0.8; // Bigger radius to extend beyond screen
            
            // Rainbow colors (from outer to inner)
            const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
            
            colors.forEach((color, index) => {
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 10; // Thicker lines for bigger rainbow
                this.ctx.beginPath();
                this.ctx.arc(rainbowX, rainbowY, rainbowRadius - (index * 10), 0, Math.PI);
                this.ctx.stroke();
            });
        }
        
        this.ctx.restore();
    }
    
    renderAquaPowerBar() {
        const barWidth = 20;
        const barHeight = 200;
        const barX = 20;
        const barY = this.canvas.height - barHeight - 20;
        
        // Bar background
        this.ctx.fillStyle = "#333333";
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Aqua power fill
        const fillHeight = (this.bonusStage.aquaPower / this.bonusStage.maxAquaPower) * barHeight;
        this.ctx.fillStyle = "#0066ff";
        this.ctx.fillRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight);
        
        // Bar border
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Label
        this.ctx.fillStyle = "#000000";
        this.ctx.font = "bold 12px Courier New";
        this.ctx.textAlign = "center";
        this.ctx.fillText("AQUA", barX + barWidth / 2, barY - 10);
        this.ctx.fillText("POWER", barX + barWidth / 2, barY - 25);
        
        // Show progress (X/20)
        this.ctx.fillText(`${this.bonusStage.aquaPower}/20`, barX + barWidth / 2, barY + barHeight + 20);
    }
    
    renderStage2Intro() {
        // Flashing screen for Stage 2 intro
        const flash = Math.floor(this.stage2Intro.flashTimer / 10) % 2;
        this.ctx.fillStyle = flash ? "#ffffff" : "#ff0000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Stage 2 intro message
        this.ctx.fillStyle = "#000000";
        this.ctx.font = "bold 24px Courier New";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Stop the Alien Mutants from Stealing the Radioactive Uranium!", this.canvas.width / 2, this.canvas.height / 2 - 20);
        
        // Press X to begin instruction
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "bold 20px Courier New";
        this.ctx.fillText("Press X to Begin", this.canvas.width / 2, this.canvas.height / 2 + 30);
    }
    
    renderStage3Intro() {
        // Flashing screen for Stage 3 intro
        const flash = Math.floor(this.stage3Intro.flashTimer / 10) % 2;
        this.ctx.fillStyle = flash ? "#ffffff" : "#8B4513"; // Brown flash for underground theme
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Stage 3 intro message
        this.ctx.fillStyle = "#000000";
        this.ctx.font = "bold 24px Courier New";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Stop the Moleman from Drilling into the Earth's Core!", this.canvas.width / 2, this.canvas.height / 2 - 20);
        
        // Press X to begin instruction
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "bold 20px Courier New";
        this.ctx.fillText("Press X to Begin", this.canvas.width / 2, this.canvas.height / 2 + 30);
    }
    
    renderMenu() {
        // Create a text panel at the bottom for instructions (half the size)
        const panelHeight = 100; // Half the original size (was 200)
        const panelY = this.canvas.height - panelHeight;
        
        // Render background image if available (bigger - covers more of the screen)
        if (this.images.menuBackground) {
            // Draw background image covering most of the screen, leaving room for smaller text panel
            this.ctx.drawImage(this.images.menuBackground, 0, 0, this.canvas.width, panelY + 20); // Slightly overlap to ensure no gap
        } else {
            // Fallback: solid background
            this.ctx.fillStyle = "#000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Semi-transparent panel for text readability (smaller)
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        this.ctx.fillRect(0, panelY, this.canvas.width, panelHeight);
        
        // Game title - comic book style
        this.ctx.textAlign = "center";
        this.ctx.font = "bold 36px Courier New";
        
        // Yellow outline (comic book style)
        this.ctx.strokeStyle = "#ffff00";
        this.ctx.lineWidth = 6;
        this.ctx.strokeText("SUPER SQUIRTER SAVES THE DAY", this.canvas.width / 2, 50);
        
        // Blue fill
        this.ctx.fillStyle = "#0066ff";
        this.ctx.fillText("SUPER SQUIRTER SAVES THE DAY", this.canvas.width / 2, 50);
        
        // Instructions in the bottom panel - centered and concise (adjusted for smaller panel)
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 12px Courier New"; // Smaller font to fit
        this.ctx.fillText("Mission: Help Super Squirter save the planet from evil villains!", this.canvas.width / 2, panelY + 15);
        this.ctx.fillText("Multiple stages: Bank Heist → Aqua-Power → Nuclear Plant → Underground", this.canvas.width / 2, panelY + 30);
        
        // Controls - more compact
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "bold 10px Courier New"; // Smaller font
        this.ctx.fillText("Controls: Arrow Keys (Move/Jump) • X (Shoot) • Z (Shield) • Down (Stairs)", this.canvas.width / 2, panelY + 50);
        
        // Start instruction - prominent and exciting
        this.ctx.fillStyle = "#ff6600";
        this.ctx.font = "bold 16px Courier New"; // Smaller to fit both options
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 2;
        this.ctx.strokeText("Press X to start game • Press S for stage selection", this.canvas.width / 2, panelY + 75);
        this.ctx.fillText("Press X to start game • Press S for stage selection", this.canvas.width / 2, panelY + 75);
    }
    
    renderStageSelection() {
        // Background
        this.ctx.fillStyle = "#1a1a2e";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Title
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "bold 36px Courier New";
        this.ctx.textAlign = "center";
        this.ctx.fillText("STAGE SELECTION", this.canvas.width / 2, 80);
        
        // Subtitle
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 18px Courier New";
        this.ctx.fillText("Choose a stage to test:", this.canvas.width / 2, 120);
        
        // Stage options
        const stages = [
            { number: 1, name: "Bank Heist", description: "Stop the bank robber!", color: "#ff6b6b" },
            { number: 2, name: "Nuclear Plant", description: "Defeat the alien mutants!", color: "#4ecdc4" },
            { number: 3, name: "Underground", description: "Stop the moleman!", color: "#feca57" }
        ];
        
        stages.forEach((stage, index) => {
            const y = 200 + (index * 120);
            const isSelected = this.stageSelection.selectedStage === stage.number;
            
            // Selection indicator
            if (isSelected) {
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
                this.ctx.fillRect(150, y - 30, this.canvas.width - 300, 80);
                this.ctx.strokeStyle = "#00ff00";
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(150, y - 30, this.canvas.width - 300, 80);
            }
            
            // Stage number
            this.ctx.fillStyle = isSelected ? "#00ff00" : "#ffffff";
            this.ctx.font = "bold 24px Courier New";
            this.ctx.textAlign = "left";
            this.ctx.fillText(`STAGE ${stage.number}`, 180, y);
            
            // Stage name
            this.ctx.fillStyle = stage.color;
            this.ctx.font = "bold 20px Courier New";
            this.ctx.fillText(stage.name, 180, y + 25);
            
            // Stage description
            this.ctx.fillStyle = "#cccccc";
            this.ctx.font = "14px Courier New";
            this.ctx.fillText(stage.description, 180, y + 45);
        });
        
        // Instructions
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 16px Courier New";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Use UP/DOWN arrows to select", this.canvas.width / 2, this.canvas.height - 80);
        this.ctx.fillText("Press X to start selected stage", this.canvas.width / 2, this.canvas.height - 55);
        this.ctx.fillText("Press ESC to return to menu", this.canvas.width / 2, this.canvas.height - 30);
    }
    
    renderGame() {
        // Render level background image if available (different for each stage)
        let backgroundImage;
        if (this.currentStage === 2) {
            backgroundImage = this.images.l2Background;
        } else if (this.currentStage === 3) {
            backgroundImage = this.images.l3Background;
        } else {
            backgroundImage = this.images.levelBackground;
        }
        if (backgroundImage) {
            this.ctx.drawImage(backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Fallback: render colored level backgrounds
            this.levels.forEach((level, index) => {
                this.ctx.fillStyle = level.color;
                this.ctx.fillRect(0, level.y, this.canvas.width, level.height);
            });
        }
        
        // Render level elements
        this.levels.forEach((level, index) => {
            // Level label
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "16px Courier New";
            this.ctx.textAlign = "left";
            this.ctx.fillText(level.name, 10, level.y + 20);
            
            // Render stairs
            level.stairs.forEach(stair => {
                this.renderStairs(stair);
            });
        });
        
        // Render hero
        if (this.images.hero) {
            // Flip image if facing left
            if (this.hero.direction === -1) {
                this.ctx.save();
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(this.images.hero, -(this.hero.x + this.hero.width), this.hero.y, this.hero.width, this.hero.height);
                this.ctx.restore();
            } else {
                this.ctx.drawImage(this.images.hero, this.hero.x, this.hero.y, this.hero.width, this.hero.height);
            }
        } else {
            // Fallback to colored rectangle
            this.ctx.fillStyle = this.hero.color;
            this.ctx.fillRect(this.hero.x, this.hero.y, this.hero.width, this.hero.height);
            
            // Hero eyes
            this.ctx.fillStyle = "#000";
            this.ctx.fillRect(this.hero.x + 5, this.hero.y + 5, 5, 5);
            this.ctx.fillRect(this.hero.x + 20, this.hero.y + 5, 5, 5);
        }
        
        // Render shield
        if (this.hero.shieldActive) {
            if (this.images.shield) {
                // Use custom shield image
                const shieldWidth = 40;
                const shieldHeight = 120;
                const shieldX = this.hero.direction === 1 ? 
                    this.hero.x + this.hero.width - 10 : 
                    this.hero.x - shieldWidth + 10;
                const shieldY = this.hero.y;
                
                this.ctx.globalAlpha = 0.8;
                this.ctx.drawImage(this.images.shield, shieldX, shieldY, shieldWidth, shieldHeight);
                this.ctx.globalAlpha = 1.0;
            } else {
                // Fallback to blue energy line
                this.ctx.strokeStyle = "#0066ff";
                this.ctx.lineWidth = 8;
                this.ctx.globalAlpha = 0.8;
                
                // Vertical blue energy line in front of hero
                const shieldX = this.hero.direction === 1 ? 
                    this.hero.x + this.hero.width : 
                    this.hero.x - 8;
                
                this.ctx.beginPath();
                this.ctx.moveTo(shieldX, this.hero.y);
                this.ctx.lineTo(shieldX, this.hero.y + this.hero.height);
                this.ctx.stroke();
                
                this.ctx.globalAlpha = 1.0; // Reset alpha
            }
        }
        
        // Render robots
        this.robots.forEach(robot => {
            let robotImage;
            if (this.currentStage === 2) {
                robotImage = this.images.alien;
            } else if (this.currentStage === 3) {
                robotImage = this.images.worm;
            } else {
                robotImage = this.images.robot;
            }
            if (robotImage) {
                // Normal direction-based flipping - same for all stages
                if (robot.direction === -1) {
                    this.ctx.save();
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(robotImage, -(robot.x + robot.width), robot.y, robot.width, robot.height);
                    this.ctx.restore();
                } else {
                    this.ctx.drawImage(robotImage, robot.x, robot.y, robot.width, robot.height);
                }
            } else {
                // Fallback to colored rectangle
                this.ctx.fillStyle = robot.color;
                this.ctx.fillRect(robot.x, robot.y, robot.width, robot.height);
                
                // Robot details
                this.ctx.fillStyle = "#ff0000";
                this.ctx.fillRect(robot.x + 5, robot.y + 5, 3, 3);
                this.ctx.fillRect(robot.x + 17, robot.y + 5, 3, 3);
            }
        });
        
        // Render bullets
        this.bullets.forEach(bullet => {
            if (this.images.bullet) {
                this.ctx.drawImage(this.images.bullet, bullet.x, bullet.y, bullet.width, bullet.height);
            } else {
                // Fallback to colored rectangle
                this.ctx.fillStyle = bullet.color;
                this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            }
        });
        
        // Render robber bullets (fireballs, lasers, or drills)
        this.robberBullets.forEach(bullet => {
            if (bullet.isLaser) {
                this.renderLaser(bullet);
            } else if (bullet.isDrill) {
                this.renderDrill(bullet);
            } else {
                this.renderFireball(bullet);
            }
        });
        
        // Render drill attacks (underground ripples and burst)
        this.drillAttacks.forEach(attack => {
            this.renderDrillAttack(attack);
        });
        
        // Render robber
        if (!this.robber.defeated) {
            let robberImage;
            if (this.currentStage === 2) {
                robberImage = this.images.mutant;
            } else if (this.currentStage === 3) {
                robberImage = this.images.mole;
            } else {
                robberImage = this.images.robber;
            }
            if (robberImage) {
                // Normal direction-based flipping - same for all stages
                if (this.robber.direction === -1) {
                    this.ctx.save();
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(robberImage, -(this.robber.x + this.robber.width), this.robber.y, this.robber.width, this.robber.height);
                    this.ctx.restore();
                } else {
                    this.ctx.drawImage(robberImage, this.robber.x, this.robber.y, this.robber.width, this.robber.height);
                }
            } else {
                // Fallback to colored rectangle
                this.ctx.fillStyle = this.robber.color;
                this.ctx.fillRect(this.robber.x, this.robber.y, this.robber.width, this.robber.height);
                
                // Robber details (eyes)
                this.ctx.fillStyle = "#000";
                if (this.robber.direction === 1) {
                    // Facing right
                    this.ctx.fillRect(this.robber.x + 10, this.robber.y + 10, 5, 5);
                    this.ctx.fillRect(this.robber.x + 25, this.robber.y + 10, 5, 5);
                } else {
                    // Facing left
                    this.ctx.fillRect(this.robber.x + this.robber.width - 15, this.robber.y + 10, 5, 5);
                    this.ctx.fillRect(this.robber.x + this.robber.width - 30, this.robber.y + 10, 5, 5);
                }
            }
            
            // Show robber health
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "12px Courier New";
            this.ctx.fillText(`Health: ${this.robber.health}`, this.robber.x, this.robber.y - 5);
        }
        
        // UI
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "16px Courier New";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
        this.ctx.fillText(`Lives: ${this.lives}`, 10, 50);
        this.ctx.fillText(`Stage: ${this.currentStage} | Level: ${this.hero.level + 1}`, 10, 70);
        
        // Shield energy bar
        this.ctx.fillStyle = "#0066ff";
        this.ctx.fillRect(10, 90, this.hero.shieldEnergy, 10);
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(10, 90, 100, 10);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "12px Courier New";
        this.ctx.fillText("Shield", 10, 85);
        
        // Render victory animation if active
        if (this.victoryAnimation.active) {
            this.renderVictoryAnimation();
        }
    }
    
    renderLaser(bullet) {
        // Create a laser beam effect with glow
        const centerX = bullet.x + bullet.width / 2;
        const centerY = bullet.y + bullet.height / 2;
        
        // Outer glow (bright red)
        this.ctx.fillStyle = "#ff0000";
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(bullet.x - 2, bullet.y - 2, bullet.width + 4, bullet.height + 4);
        
        // Inner laser (bright red)
        this.ctx.fillStyle = "#ff0000";
        this.ctx.globalAlpha = 0.8;
        this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        
        // Core (white-hot)
        this.ctx.fillStyle = "#ffffff";
        this.ctx.globalAlpha = 1.0;
        this.ctx.fillRect(bullet.x + 2, bullet.y + 2, bullet.width - 4, bullet.height - 4);
        
        // Add some flickering effect
        const flicker = Math.sin(Date.now() * 0.02) * 0.2;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + flicker})`;
        this.ctx.fillRect(bullet.x + 4, bullet.y + 3, bullet.width - 8, bullet.height - 6);
        
        this.ctx.globalAlpha = 1.0;
    }
    
    renderDrill(bullet) {
        // Create a spinning drill effect
        const centerX = bullet.x + bullet.width / 2;
        const centerY = bullet.y + bullet.height / 2;
        
        // Save context for rotation
        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        
        // Rotate based on time for spinning effect
        const rotation = Date.now() * 0.01; // Fast spinning
        this.ctx.rotate(rotation);
        
        // Drill body (brown)
        this.ctx.fillStyle = "#8B4513";
        this.ctx.fillRect(-bullet.width / 2, -bullet.height / 2, bullet.width, bullet.height);
        
        // Drill tip (darker brown)
        this.ctx.fillStyle = "#654321";
        this.ctx.fillRect(-bullet.width / 2, -bullet.height / 2, bullet.width / 2, bullet.height);
        
        // Drill spirals (white lines)
        this.ctx.strokeStyle = "#FFFFFF";
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(-bullet.width / 2, -bullet.height / 2 + i * bullet.height / 3);
            this.ctx.lineTo(bullet.width / 2, -bullet.height / 2 + i * bullet.height / 3);
            this.ctx.stroke();
        }
        
        // Restore context
        this.ctx.restore();
    }
    
    renderDrillAttack(attack) {
        // Render underground drill attack with enhanced visual effects
        
        if (attack.phase === 'ripples') {
            // Render traveling ripples across all levels using PNG images
            attack.ripples.forEach(ripple => {
                this.ctx.save();
                this.ctx.globalAlpha = ripple.opacity;
                
                // Use ripple PNG image if available
                if (this.images.ripple) {
                    const rippleSize = ripple.radius * 2;
                    this.ctx.drawImage(
                        this.images.ripple, 
                        ripple.x - rippleSize/2, 
                        ripple.y - rippleSize/2, 
                        rippleSize, 
                        rippleSize
                    );
                } else {
                    // Fallback to drawn ripples
                    for (let ring = 0; ring < 3; ring++) {
                        const ringRadius = ripple.radius - (ring * 4);
                        if (ringRadius > 0) {
                            // Different colors for different levels
                            let color;
                            if (ripple.level === 0) { // Top level
                                color = ring === 0 ? "#8B4513" : ring === 1 ? "#654321" : "#4A2C17";
                            } else if (ripple.level === 1) { // Middle level
                                color = ring === 0 ? "#A0522D" : ring === 1 ? "#8B4513" : "#654321";
                            } else { // Bottom level
                                color = ring === 0 ? "#CD853F" : ring === 1 ? "#A0522D" : "#8B4513";
                            }
                            
                            this.ctx.strokeStyle = color;
                            this.ctx.lineWidth = 3 - ring;
                            this.ctx.beginPath();
                            this.ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2);
                            this.ctx.stroke();
                        }
                    }
                }
                
                this.ctx.restore();
            });
            
            // Show warning indicator on hero's current level floor
            const heroLevel = this.hero.level;
            const warningY = this.levels[heroLevel].y + this.levels[heroLevel].height - 10; // Floor of hero's level
            
            this.ctx.save();
            const pulse = Math.sin(attack.timer * 0.2) * 0.3 + 0.7;
            this.ctx.globalAlpha = pulse;
            this.ctx.fillStyle = "#FF0000"; // Bright red warning
            this.ctx.fillRect(attack.targetX - 30, warningY - 8, 60, 16);
            
            // Add warning text
            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.font = "bold 12px Courier New";
            this.ctx.textAlign = "center";
            this.ctx.fillText("DRILL!", attack.targetX, warningY + 4);
            this.ctx.restore();
            
        } else if (attack.phase === 'drilling') {
            // Show dramatic drilling progress with ground upheaval
            this.ctx.save();
            
            // Draw large ground cracks spreading from target point on the floor
            const crackLength = attack.drillProgress * 80;
            this.ctx.strokeStyle = "#8B4513";
            this.ctx.lineWidth = 4;
            
            // Position cracks on the floor of the hero's level
            const heroLevel = this.hero.level;
            const floorY = this.levels[heroLevel].y + this.levels[heroLevel].height - 10;
            
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI * 2) / 8;
                const startX = attack.targetX;
                const startY = floorY;
                const endX = startX + Math.cos(angle) * crackLength;
                const endY = floorY + Math.sin(angle) * crackLength;
                
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();
            }
            
            // Show drilling indicator with spinning effect using PNG image on the floor
            this.ctx.save();
            this.ctx.translate(attack.targetX, floorY);
            this.ctx.rotate(attack.timer * 0.3); // Spinning drill
            
            // Use drill PNG image if available
            if (this.images.drill) {
                this.ctx.drawImage(this.images.drill, -20, -12, 40, 24);
            } else {
                // Fallback to drawn drill
                // Drill body
                this.ctx.fillStyle = "#8B4513";
                this.ctx.fillRect(-20, -12, 40, 24);
                
                // Drill tip
                this.ctx.fillStyle = "#654321";
                this.ctx.fillRect(-20, -12, 20, 24);
                
                // Drill spirals
                this.ctx.strokeStyle = "#FFFFFF";
                this.ctx.lineWidth = 2;
                for (let i = 0; i < 4; i++) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(-20, -12 + i * 6);
                    this.ctx.lineTo(20, -12 + i * 6);
                    this.ctx.stroke();
                }
            }
            
            this.ctx.restore();
            this.ctx.restore();
            
        } else if (attack.phase === 'burst') {
            // Render massive dangerous drill burst from underground
            this.ctx.save();
            
            // Screen shake effect
            const shakeX = (Math.random() - 0.5) * 4;
            const shakeY = (Math.random() - 0.5) * 4;
            this.ctx.translate(shakeX, shakeY);
            
            // Position burst at the hero's height (middle of the level)
            const heroLevel = this.hero.level;
            const heroY = this.levels[heroLevel].y + this.levels[heroLevel].height / 2;
            
            // Large burst effect with multiple drill spikes using PNG images
            for (let i = 0; i < 12; i++) {
                const angle = (i * Math.PI * 2) / 12;
                const spikeLength = 60 + Math.sin(attack.burstTimer * 0.4) * 20; // Bigger pulsing effect
                const spikeX = attack.targetX + Math.cos(angle) * spikeLength;
                const spikeY = heroY + Math.sin(angle) * spikeLength;
                
                // Use drill PNG image for spikes if available
                if (this.images.drill) {
                    this.ctx.save();
                    this.ctx.translate(spikeX, spikeY);
                    this.ctx.rotate(angle + Math.PI / 2); // Rotate drill to point outward
                    this.ctx.drawImage(this.images.drill, -10, -6, 20, 12);
                    this.ctx.restore();
                } else {
                    // Fallback to drawn spikes
                    // Draw thick drill spike
                    this.ctx.strokeStyle = "#8B4513";
                    this.ctx.lineWidth = 6;
                    this.ctx.beginPath();
                    this.ctx.moveTo(attack.targetX, attack.targetY);
                    this.ctx.lineTo(spikeX, spikeY);
                    this.ctx.stroke();
                    
                    // Add large drill tip
                    this.ctx.fillStyle = "#654321";
                    this.ctx.beginPath();
                    this.ctx.arc(spikeX, spikeY, 5, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            
            // Large central burst area with explosion effect using PNG image on the floor
            if (this.images.burst) {
                // Use burst PNG image for the central explosion
                const burstSize = 80 + Math.sin(attack.burstTimer * 0.4) * 20; // Pulsing effect
                this.ctx.drawImage(
                    this.images.burst,
                    attack.targetX - burstSize/2,
                    heroY - burstSize/2,
                    burstSize,
                    burstSize
                );
            } else {
                // Fallback to drawn explosion at hero height
                this.ctx.fillStyle = "#FF0000"; // Bright red danger zone
                this.ctx.globalAlpha = 0.8;
                this.ctx.beginPath();
                this.ctx.arc(attack.targetX, heroY, 40, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Add explosion particles
                for (let i = 0; i < 20; i++) {
                    const angle = (i * Math.PI * 2) / 20;
                    const distance = 30 + Math.random() * 20;
                    const particleX = attack.targetX + Math.cos(angle) * distance;
                    const particleY = heroY + Math.sin(angle) * distance;
                    
                    this.ctx.fillStyle = "#FFAA00";
                    this.ctx.beginPath();
                    this.ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            
            this.ctx.restore();
        }
    }
    
    renderVictoryAnimation() {
        // Render fallen robber (face down, not moving)
        if (this.victoryAnimation.robberFallen) {
            // Get the appropriate robber image for the current stage
            let robberImage;
            if (this.currentStage === 2) {
                robberImage = this.images.mutant;
            } else if (this.currentStage === 3) {
                robberImage = this.images.mole;
            } else {
                robberImage = this.images.robber;
            }
            
            if (robberImage) {
                // Draw the robber image rotated 90 degrees (on its side) - no size change
                this.ctx.save();
                this.ctx.translate(this.robber.x + this.robber.width / 2, this.robber.y + this.robber.height / 2);
                this.ctx.rotate(Math.PI / 2); // Rotate 90 degrees (not 180)
                this.ctx.drawImage(robberImage, -this.robber.width / 2, -this.robber.height / 2, this.robber.width, this.robber.height);
                this.ctx.restore();
            } else {
                // Fallback: draw a face-down robber shape
                this.ctx.fillStyle = "#8B4513"; // Brown color for robber
                this.ctx.fillRect(this.robber.x, this.robber.y + this.robber.height - 30, this.robber.width, 30);
                
                // Add some detail to show he's face down
                this.ctx.fillStyle = "#000000";
                this.ctx.fillRect(this.robber.x + 10, this.robber.y + this.robber.height - 20, 10, 5); // Eyes
                this.ctx.fillRect(this.robber.x + this.robber.width - 20, this.robber.y + this.robber.height - 20, 10, 5);
            }
        }
        
        // Render balloons
        this.victoryAnimation.balloons.forEach(balloon => {
            this.ctx.fillStyle = balloon.color;
            this.ctx.beginPath();
            this.ctx.arc(balloon.x, balloon.y, balloon.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Balloon string
            this.ctx.strokeStyle = "#8b4513";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(balloon.x, balloon.y + balloon.size);
            this.ctx.lineTo(balloon.x, balloon.y + balloon.size + 30);
            this.ctx.stroke();
        });
        
        // Render confetti
        this.victoryAnimation.confetti.forEach(confetti => {
            this.ctx.save();
            this.ctx.translate(confetti.x, confetti.y);
            this.ctx.rotate(confetti.rotation);
            this.ctx.fillStyle = confetti.color;
            this.ctx.fillRect(-3, -3, 6, 6);
            this.ctx.restore();
        });
    }
    
    renderGameOver() {
        // Draw game over background image
        if (this.images.gameOver) {
            // Use custom game over background image
            this.ctx.drawImage(this.images.gameOver, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Fallback: red background
            this.ctx.fillStyle = "#ff0000";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Add semi-transparent overlay for better text readability
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Game over text - move to top with text box
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        this.ctx.fillRect(this.canvas.width / 2 - 200, 40, 400, 60);
        this.ctx.strokeStyle = "#ff0000";
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.canvas.width / 2 - 200, 40, 400, 60);
        
        this.ctx.fillStyle = "#ff0000";
        this.ctx.font = "48px Courier New";
        this.ctx.textAlign = "center";
        this.ctx.fillText("GAME OVER", this.canvas.width / 2, 80);
        
        // Move additional text to bottom of screen with text box
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        this.ctx.fillRect(this.canvas.width / 2 - 300, this.canvas.height - 120, 600, 100);
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.canvas.width / 2 - 300, this.canvas.height - 120, 600, 100);
        
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "20px Courier New";
        this.ctx.fillText("The evil villains defeated you!", this.canvas.width / 2, this.canvas.height - 80);
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height - 50);
        this.ctx.fillText("Press X to try again", this.canvas.width / 2, this.canvas.height - 20);
    }
    
    renderVictory() {
        // Draw victory background image
        if (this.images.victory) {
            // Use custom victory background image
            this.ctx.drawImage(this.images.victory, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Fallback: green background
            this.ctx.fillStyle = "#00ff00";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Add semi-transparent overlay for better text readability
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Victory text with text box
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        this.ctx.fillRect(this.canvas.width / 2 - 200, 210, 400, 60);
        this.ctx.strokeStyle = "#00ff00";
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.canvas.width / 2 - 200, 210, 400, 60);
        
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "48px Courier New";
        this.ctx.textAlign = "center";
        this.ctx.fillText("VICTORY!", this.canvas.width / 2, 250);
        
        // Move additional text to bottom of screen with text box
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        this.ctx.fillRect(this.canvas.width / 2 - 300, this.canvas.height - 120, 600, 100);
        this.ctx.strokeStyle = "#ffd700";
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.canvas.width / 2 - 300, this.canvas.height - 120, 600, 100);
        
        this.ctx.fillStyle = "#ffd700";
        this.ctx.font = "20px Courier New";
        this.ctx.fillText("You successfully saved the day!", this.canvas.width / 2, this.canvas.height - 80);
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height - 50);
        this.ctx.fillText("Press X to play again", this.canvas.width / 2, this.canvas.height - 20);
    }
    
    renderCongratulations() {
        // Background
        this.ctx.fillStyle = "#1a1a2e";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Title
        this.ctx.fillStyle = "#00ff00";
        this.ctx.font = "bold 48px Courier New";
        this.ctx.textAlign = "center";
        this.ctx.fillText("🎉 CONGRATULATIONS! 🎉", this.canvas.width / 2, 150);
        
        // Level 2 announcement
        this.ctx.fillStyle = "#ffff00";
        this.ctx.font = "bold 36px Courier New";
        this.ctx.fillText("LEVEL 2", this.canvas.width / 2, 220);
        
        // Mission description
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "24px Courier New";
        this.ctx.fillText("Stop the monsters attacking", this.canvas.width / 2, 280);
        this.ctx.fillText("the nuclear power station!", this.canvas.width / 2, 320);
        
        // Instructions
        this.ctx.fillStyle = "#00ffff";
        this.ctx.font = "20px Courier New";
        this.ctx.fillText("Press SPACE to start Level 2", this.canvas.width / 2, 400);
        
        // Stage indicator
        this.ctx.fillStyle = "#ff6600";
        this.ctx.font = "16px Courier New";
        this.ctx.fillText("Stage: Nuclear Power Plant", this.canvas.width / 2, 450);
    }
    
    startBonusStage() {
        this.bonusStage.active = true;
        this.bonusStage.timer = 0;
        this.bonusStage.aquaPower = 0;
        this.bonusStage.heroFlying = false;
        this.bonusStage.flashTimer = 0;
        this.bonusStage.clouds = [];
        this.bonusStage.raindrops = [];
        this.bonusStage.cloudSpawnTimer = 0;
        this.bonusStage.raindropSpawnTimer = 0;
        this.bonusStage.transitionTimer = 0;
        this.bonusStage.transitionPhase = 'flashing';
        this.bonusStage.emergencyMessage = false;
        this.bonusStage.backClouds = [];
        this.bonusStage.backCloudSpawnTimer = 0;
        this.bonusStage.frontClouds = [];
        this.bonusStage.frontCloudSpawnTimer = 0;
        
        // Add 5 initial clouds for immediate cloudy sky (middle layer)
        for (let i = 0; i < 5; i++) {
            this.bonusStage.clouds.push({
                x: 100 + i * 150 + Math.random() * 50, // Spread across screen
                y: Math.random() * (this.canvas.height / 2) + 50, // Random height, not below halfway
                width: 160, // 100% bigger (was 80)
                height: 80, // 100% bigger (was 40)
                speed: 2
            });
        }
        
        // Add 3 initial back layer clouds (large, slow-moving)
        for (let i = 0; i < 3; i++) {
            const sizeVariants = [
                { width: 240, height: 120 },  // Large
                { width: 320, height: 160 },  // Very large
                { width: 400, height: 200 }   // Extra large
            ];
            const size = sizeVariants[Math.floor(Math.random() * sizeVariants.length)];
            
            this.bonusStage.backClouds.push({
                x: Math.random() * this.canvas.width, // Random position across screen
                y: Math.random() * this.canvas.height, // Any height randomly
                width: size.width,
                height: size.height,
                speed: 1 // Half speed of middle layer
            });
        }
        
        // Add 4 initial front layer clouds (fast-moving, different sizes)
        for (let i = 0; i < 4; i++) {
            const sizeVariants = [
                { width: 80, height: 40 },   // Small
                { width: 120, height: 60 },  // Medium-small
                { width: 160, height: 80 }   // Medium
            ];
            const size = sizeVariants[Math.floor(Math.random() * sizeVariants.length)];
            
            this.bonusStage.frontClouds.push({
                x: Math.random() * this.canvas.width, // Random position across screen
                y: Math.random() * this.canvas.height, // Any height randomly
                width: size.width,
                height: size.height,
                speed: 6 // 3x faster than normal clouds
            });
        }
        
        // Position hero at top of screen for flying
        this.hero.x = this.canvas.width / 2;
        this.hero.y = 50;
        this.hero.level = 0;
        
        this.state = GAME_STATES.BONUS_STAGE;
    }
    
    startLevel2() {
        this.currentStage = 2;
        this.setupLevel2();
        this.state = GAME_STATES.PLAYING;
    }
    
    startLevel3() {
        this.currentStage = 3;
        this.setupLevel3();
        this.state = GAME_STATES.PLAYING;
    }
    
    startSelectedStage() {
        // Reset game state for testing
        this.score = 0;
        this.lives = 3;
        this.bullets = [];
        this.robberBullets = [];
        this.robots = [];
        this.victoryAnimation.active = false;
        this.bonusStage.active = false;
        this.stage2Intro.active = false;
        this.stage3Intro.active = false;
        
        // Load the selected stage
        if (this.stageSelection.selectedStage === 1) {
            this.currentStage = 1;
            this.createLevels();
            this.createHero();
            this.createRobber();
            this.spawnRobots(4);
        } else if (this.stageSelection.selectedStage === 2) {
            this.currentStage = 2;
            this.setupLevel2();
        } else if (this.stageSelection.selectedStage === 3) {
            this.currentStage = 3;
            this.setupLevel3();
        }
        
        this.state = GAME_STATES.PLAYING;
    }
    
    setupLevel2() {
        // Create level 2 (Nuclear Power Plant)
        this.levels = [
            {
                name: "Control Room",
                y: 0,
                height: 200,
                color: "#2c3e50", // Dark blue-gray
                stairs: [{ x: 700, y: 150, width: 100, height: 50 }]
            },
            {
                name: "Reactor Floor",
                y: 200,
                height: 200,
                color: "#34495e", // Medium blue-gray
                stairs: [{ x: 0, y: 350, width: 100, height: 50 }]
            },
            {
                name: "Core Chamber",
                y: 400,
                height: 200,
                color: "#7f8c8d", // Light gray
                stairs: []
            }
        ];
        
        // Reset game objects
        this.robots = [];
        this.bullets = [];
        this.robberBullets = [];
        
        // Create mutant (robber) with more health
        this.createRobber(5); // 5 health for level 2
        
        // Spawn aliens (robots) - more of them
        this.spawnRobots(6); // 6 aliens for level 2
        
        // Reset hero position
        this.hero.level = 0;
        this.hero.x = 100;
        this.hero.y = 50;
        
        // Reset score and lives
        this.score = 0;
        this.lives = 3;
    }
    
    setupLevel3() {
        // Create level 3 (Underground Caverns) - same layout as Stage 1
        this.levels = [
            {
                name: "Upper Caverns",
                y: 0,
                height: 200,
                color: "#4a4a4a", // Dark gray for underground
                stairs: [{ x: 700, y: 150, width: 100, height: 50 }] // Top to middle caverns on the right
            },
            {
                name: "Middle Caverns",
                y: 200,
                height: 200,
                color: "#8b4513", // Brown for earth
                stairs: [{ x: 0, y: 350, width: 100, height: 50 }] // Middle to bottom caverns on the left
            },
            {
                name: "Deep Caverns",
                y: 400,
                height: 200,
                color: "#ffd700", // Gold for treasure
                stairs: [] // No stairs at bottom
            }
        ];
        
        // Reset game objects for Stage 3
        this.bullets = [];
        this.robberBullets = [];
        this.robots = [];
        
        // Create moleman villain (more health for final boss)
        this.createRobber(7); // 7 health for final boss
        
        // Spawn more worm henchmen for increased difficulty
        this.spawnRobots(8); // 8 worms instead of 4
        
        // Reset hero position
        this.hero.x = 50;
        this.hero.y = 50;
        this.hero.level = 0;
        this.score = 0;
        this.lives = 3;
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new Game();
});
