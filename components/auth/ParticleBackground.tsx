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
  mass: number;
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
        const speed = 0.3 + Math.random() * 0.3; // Slightly faster for more dynamic movement
        const radius = 2.5 + Math.random() * 2; // Bigger particles
        
        return {
          x: clusterX + offsetX,
          y: clusterY + offsetY,
          baseX: clusterX + offsetX,
          baseY: clusterY + offsetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: radius,
          mass: radius, // Mass proportional to radius
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

    // Collision detection and response function
    const handleCollision = (p1: Particle, p2: Particle) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDist = p1.radius + p2.radius;

      if (distance < minDist && distance > 0) {
        // Collision detected - calculate collision response
        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Rotate particle positions
        const x1 = 0;
        const y1 = 0;
        const x2 = dx * cos + dy * sin;
        const y2 = dy * cos - dx * sin;

        // Rotate particle velocities
        const vx1 = p1.vx * cos + p1.vy * sin;
        const vy1 = p1.vy * cos - p1.vx * sin;
        const vx2 = p2.vx * cos + p2.vy * sin;
        const vy2 = p2.vy * cos - p2.vx * sin;

        // Collision reaction (elastic collision)
        const vx1Final = ((p1.mass - p2.mass) * vx1 + 2 * p2.mass * vx2) / (p1.mass + p2.mass);
        const vx2Final = ((p2.mass - p1.mass) * vx2 + 2 * p1.mass * vx1) / (p1.mass + p2.mass);

        // Separate particles to prevent overlap
        const overlap = minDist - distance;
        const separationX = (overlap / 2) * cos;
        const separationY = (overlap / 2) * sin;
        p1.x -= separationX;
        p1.y -= separationY;
        p2.x += separationX;
        p2.y += separationY;

        // Rotate velocities back
        p1.vx = vx1Final * cos - vy1 * sin;
        p1.vy = vy1 * cos + vx1Final * sin;
        p2.vx = vx2Final * cos - vy2 * sin;
        p2.vy = vy2 * cos + vx2Final * sin;

        // Add some bounce dampening for stability (optional)
        p1.vx *= 0.95;
        p1.vy *= 0.95;
        p2.vx *= 0.95;
        p2.vy *= 0.95;
      }
    };

    // Animation loop
    const animate = () => {
      timeRef.current += 0.01;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // First pass: Handle collisions between all particles
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          handleCollision(particlesRef.current[i], particlesRef.current[j]);
        }
      }

      // Second pass: Update positions and handle mouse interaction
      particlesRef.current.forEach((particle, i) => {
        // Enhanced mouse interaction - particles are pushed away more strongly
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const mouseRadius = 200; // Increased interaction radius

        if (distance < mouseRadius && distance > 0) {
          const force = (mouseRadius - distance) / mouseRadius;
          const pushStrength = force * 0.15; // Stronger push force
          
          // Push particles away from cursor
          particle.vx -= (dx / distance) * pushStrength;
          particle.vy -= (dy / distance) * pushStrength;
        }

        // Gentle return to base position (reduced force for more dynamic movement)
        const targetX = particle.baseX + Math.cos(timeRef.current + particle.angle) * 40;
        const targetY = particle.baseY + Math.sin(timeRef.current + particle.angle) * 40;
        
        const returnForce = 0.02; // Reduced return force to allow more free movement
        particle.vx += (targetX - particle.x) * returnForce;
        particle.vy += (targetY - particle.y) * returnForce;

        // Apply velocity damping for smoother motion
        particle.vx *= 0.98;
        particle.vy *= 0.98;

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off walls with energy loss
        const bounceDamping = 0.7;
        if (particle.x - particle.radius < 0) {
          particle.x = particle.radius;
          particle.vx *= -bounceDamping;
        }
        if (particle.x + particle.radius > canvas.width) {
          particle.x = canvas.width - particle.radius;
          particle.vx *= -bounceDamping;
        }
        if (particle.y - particle.radius < 0) {
          particle.y = particle.radius;
          particle.vy *= -bounceDamping;
        }
        if (particle.y + particle.radius > canvas.height) {
          particle.y = canvas.height - particle.radius;
          particle.vy *= -bounceDamping;
        }

        // Draw particle with enhanced glow effect (bigger for larger particles)
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.radius * 4
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.4, particle.color.replace('0.8', '0.5').replace('0.7', '0.4'));
        gradient.addColorStop(0.7, particle.color.replace('0.8', '0.2').replace('0.7', '0.15'));
        gradient.addColorStop(1, particle.color.replace('0.8', '0').replace('0.7', '0'));
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw inner bright core (bigger for visibility)
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 0.6, 0, Math.PI * 2);
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
