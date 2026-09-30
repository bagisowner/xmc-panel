import React, { useEffect, useRef } from 'react';

interface LoadingScreenProps {
  isFadingOut?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isFadingOut = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Star / Particle Background System
    const stars: Array<{ x: number; y: number; size: number; alpha: number; speed: number }> = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.015 + 0.005,
      });
    }

    // Spiraling Fibonacci Dots System
    const totalDots = 160;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    let rotationAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Deep Purple Gradient Radial Background
      const bgGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        20,
        centerX,
        centerY,
        Math.max(width, height) * 0.65
      );
      bgGlow.addColorStop(0, 'rgba(40, 18, 80, 0.9)');
      bgGlow.addColorStop(0.3, 'rgba(20, 10, 42, 0.95)');
      bgGlow.addColorStop(1, 'rgba(7, 5, 20, 1)');

      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, width, height);

      // Render Floating Purple Stars
      stars.forEach((star) => {
        star.alpha += star.speed;
        if (star.alpha > 1 || star.alpha < 0.1) {
          star.speed = -star.speed;
        }
        ctx.fillStyle = `rgba(192, 132, 252, ${Math.max(0.1, Math.min(1, star.alpha))})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Centered Spiraling Dots Constellation
      rotationAngle += 0.008;

      ctx.save();
      ctx.translate(centerX, centerY);

      for (let i = 0; i < totalDots; i++) {
        const radius = Math.sqrt(i + 1) * 8;
        const angle = i * goldenAngle + rotationAngle;

        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        const dotSize = Math.max(1.4, (i / totalDots) * 4.2);
        const opacity = Math.min(1, 0.25 + (i / totalDots) * 0.75);

        ctx.fillStyle = i % 2 === 0 ? `rgba(168, 85, 247, ${opacity})` : `rgba(192, 132, 252, ${opacity})`;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = i % 3 === 0 ? 12 : 5;

        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden transition-opacity duration-700 font-sans ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background & Centered Spiraling Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
