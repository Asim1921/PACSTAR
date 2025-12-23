'use client';

import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    particlesJS: (tagId: string, params: any) => void;
  }
}

export default function ParticleBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesInitialized = useRef(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || !containerRef.current || particlesInitialized.current) return;

    // Load particles.js dynamically
    const loadParticlesJS = async () => {
      try {
        // Check if particles.js is already loaded
        if (!window.particlesJS) {
          // Load particles.js from local file
          const script = document.createElement('script');
          script.src = '/particles.js';
          script.async = true;
          
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load particles.js'));
            document.head.appendChild(script);
          });
        }

        // Wait a bit for the script to be fully ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize particles.js with cyber theme configuration
        if (window.particlesJS && containerRef.current) {
          window.particlesJS('particles-js', {
            particles: {
              number: {
                value: 80,
                density: {
                  enable: true,
                  value_area: 800
                }
              },
              color: {
                value: ['#00ff88', '#00d9ff', '#9d4edd'] // neon-green, neon-cyan, neon-purple
              },
              shape: {
                type: 'circle',
                stroke: {
                  width: 0,
                  color: '#000000'
                }
              },
              opacity: {
                value: 0.9,
                random: true,
                anim: {
                  enable: false,
                  speed: 1,
                  opacity_min: 0.3,
                  sync: false
                }
              },
              size: {
                value: 5,
                random: true,
                anim: {
                  enable: false,
                  speed: 40,
                  size_min: 2,
                  sync: false
                }
              },
              line_linked: {
                enable: true,
                distance: 180,
                color: '#00ff88',
                opacity: 0.6,
                width: 1.5
              },
              move: {
                enable: true,
                speed: 2,
                direction: 'none',
                random: false,
                straight: false,
                out_mode: 'out',
                bounce: false,
                attract: {
                  enable: false,
                  rotateX: 600,
                  rotateY: 1200
                }
              }
            },
            interactivity: {
              detect_on: 'canvas',
              events: {
                onhover: {
                  enable: true,
                  mode: 'bubble'
                },
                onclick: {
                  enable: true,
                  mode: 'push'
                },
                resize: true
              },
              modes: {
                grab: {
                  distance: 200,
                  line_linked: {
                    opacity: 1
                  }
                },
                bubble: {
                  distance: 300,
                  size: 12,
                  duration: 2,
                  opacity: 1,
                  speed: 3
                },
                repulse: {
                  distance: 200,
                  duration: 0.4
                },
                push: {
                  particles_nb: 4
                },
                remove: {
                  particles_nb: 2
                }
              }
            },
            retina_detect: true
          });

          particlesInitialized.current = true;
        }
      } catch (error) {
        console.error('Error loading particles.js:', error);
      }
    };

    loadParticlesJS();

    // Cleanup function
    return () => {
      // Cleanup is handled by particles.js internally
      particlesInitialized.current = false;
    };
  }, []);

  return (
    <div
      id="particles-js"
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 0 }}
    />
  );
}
