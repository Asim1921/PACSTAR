'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  baseX: number;
  baseY: number;
  angle: number;
  speed: number;
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Particle colors matching the theme - more military/cyber
    const colors = [
      'rgba(0, 255, 136, 0.8)', // neon-green - brighter
      'rgba(0, 217, 255, 0.8)', // neon-cyan - brighter
      'rgba(157, 78, 221, 0.7)', // neon-purple
    ];

    // Function to create particles with more structured positioning
    const createParticles = () => {
      // Increased particle density for tighter formation
      const particleCount = Math.min(150, Math.floor((canvas.width * canvas.height) / 8000));
      
      // Create particles in a more structured way (clustered formation)
      particlesRef.current = Array.from({ length: particleCount }, (_, i) => {
        // Create clusters for military formation
        const clusterX = (i % 10) * (canvas.width / 10) + (canvas.width / 20);
        const clusterY = Math.floor(i / 10) * (canvas.height / Math.ceil(particleCount / 10)) + (canvas.height / (Math.ceil(particleCount / 10) * 2));
        
        // Add some controlled randomness within cluster
        const offsetX = (Math.random() - 0.5) * 80;
        const offsetY = (Math.random() - 0.5) * 80;
        
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 0.2; // Slower, more controlled movement
        
        return {
          x: clusterX + offsetX,
          y: clusterY + offsetY,
          baseX: clusterX + offsetX,
          baseY: clusterY + offsetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1.5 + Math.random() * 1, // Slightly smaller, more uniform
          color: colors[Math.floor(Math.random() * colors.length)],
          angle: angle,
          speed: speed,
        };
      });
    };

    // Set canvas size and create particles
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      createParticles(); // Recreate particles on resize
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      timeRef.current += 0.01;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach((particle, i) => {
        // More controlled movement - return to base position with oscillation
        const targetX = particle.baseX + Math.cos(timeRef.current + particle.angle) * 30;
        const targetY = particle.baseY + Math.sin(timeRef.current + particle.angle) * 30;
        
        // Smooth movement towards target
        particle.x += (targetX - particle.x) * 0.05 + particle.vx;
        particle.y += (targetY - particle.y) * 0.05 + particle.vy;

        // Keep particles in bounds
        if (particle.x < 0 || particle.x > canvas.width) {
          particle.vx *= -1;
          particle.x = Math.max(0, Math.min(canvas.width, particle.x));
        }
        if (particle.y < 0 || particle.y > canvas.height) {
          particle.vy *= -1;
          particle.y = Math.max(0, Math.min(canvas.height, particle.y));
        }

        // Enhanced mouse interaction - particles react more strongly
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          const force = (150 - distance) / 150;
          particle.vx -= (dx / distance) * force * 0.02;
          particle.vy -= (dy / distance) * force * 0.02;
        }

        // Draw particle with glow effect
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.radius * 3
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.5, particle.color.replace('0.8', '0.4').replace('0.7', '0.3'));
        gradient.addColorStop(1, particle.color.replace('0.8', '0').replace('0.7', '0'));
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw inner bright core
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = particle.color.replace('0.8', '1').replace('0.7', '1');
        ctx.fill();

        // Draw connections to nearby particles - tighter network
        particlesRef.current.slice(i + 1).forEach((otherParticle) => {
          const dx = otherParticle.x - particle.x;
          const dy = otherParticle.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Reduced connection distance for tighter mesh
          if (distance < 90) {
            const opacity = (90 - distance) / 90 * 0.4; // Increased opacity for visibility
            
            // Determine line color based on particle colors
            let lineColor = 'rgba(0, 255, 136,';
            if (particle.color.includes('217, 255') || otherParticle.color.includes('217, 255')) {
              lineColor = 'rgba(0, 217, 255,';
            } else if (particle.color.includes('78, 221') || otherParticle.color.includes('78, 221')) {
              lineColor = 'rgba(157, 78, 221,';
            }
            
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `${lineColor}${opacity})`;
            ctx.lineWidth = 0.8; // Slightly thicker lines
            ctx.stroke();
            
            // Add pulse effect on lines
            if (distance < 60) {
              ctx.strokeStyle = `${lineColor}${opacity * 0.3})`;
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
