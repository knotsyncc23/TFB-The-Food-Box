import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clock, Star, ShoppingBasket, ShoppingBag } from 'lucide-react';

export default function SplashScreen({ onFinish }) {
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    // Show splash for 1.8 seconds then start finish animation
    const timer = setTimeout(() => {
      setIsFinishing(true);
      // Wait for the finish animation (zoom) to complete then unmount
      setTimeout(() => {
        if (onFinish) onFinish();
      }, 600); // Duration of the zoom out
    }, 1800);

    return () => clearTimeout(timer);
  }, [onFinish]);

  const foodIcons = [
    { Icon: Zap, x: '10%', y: '20%', delay: 0.1 },
    { Icon: Clock, x: '80%', y: '15%', delay: 0.3 },
    { Icon: Star, x: '15%', y: '80%', delay: 0.5 },
    { Icon: ShoppingBasket, x: '85%', y: '75%', delay: 0.2 },
    { Icon: ShoppingBag, x: '50%', y: '10%', delay: 0.4 },
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-[#7e3866]">
      <AnimatePresence mode="wait">
        {!isFinishing && (
          <motion.div
            key="splash-content"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ 
              scale: 8, 
              opacity: 0,
            }}
            transition={{ 
              exit: { duration: 0.5, ease: [0.45, 0, 0.55, 1] },
              duration: 0.4,
              ease: "easeOut"
            }}
            style={{ willChange: "transform, opacity" }}
            className="relative flex items-center justify-center w-full h-full"
          >
            {/* Pulsing Aura Background - Simplified for Performance */}
            <motion.div 
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ transform: 'translateZ(0)', willChange: "transform, opacity" }}
              className="absolute w-[400px] h-[400px] bg-white/5 rounded-full blur-[80px]"
            />

            {/* Floating Food Icons Background - Reduced count for smoothness */}
            {foodIcons.slice(0, 3).map(({ Icon, x, y, delay }, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 0.15, 0],
                  y: [0, -20, 0]
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity, 
                  delay: delay,
                  ease: "linear" 
                }}
                className="absolute text-white/5"
                style={{ 
                  transform: 'translateZ(0)', 
                  willChange: "transform, opacity",
                  left: x, 
                  top: y 
                }}
              >
                <Icon className="w-16 h-16 md:w-24 md:h-24" strokeWidth={0.5} />
              </motion.div>
            ))}
 
            {/* Central Brand Logic */}
            <div className="relative">
              <motion.h1
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ 
                  type: 'spring', 
                  stiffness: 100, 
                  damping: 15
                }}
                style={{ transform: 'translateZ(0)', willChange: "transform, opacity" }}
                className="text-7xl md:text-9xl font-black tracking-tighter text-white relative font-['Outfit'] select-none"
              >
                TIFUNBOX
                
                {/* Optimized Shine Effect Layer */}
                <motion.div
                  initial={{ x: '-150%' }}
                  animate={{ x: '150%' }}
                  transition={{ 
                    duration: 1.8, 
                    repeat: Infinity, 
                    repeatDelay: 1,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none"
                  style={{ 
                    mixBlendMode: 'overlay',
                    willChange: "transform",
                    transform: 'translateZ(0)'
                  }}
                />
              </motion.h1>
 
              {/* Tagline */}
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 0.8 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="text-center text-white/90 font-black tracking-[0.5em] text-[10px] md:text-[12px] uppercase mt-5"
              >
                Premium Food Delivery
              </motion.p>
            </div>
 
            {/* Bottom Signature */}
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 0.4 }}
               transition={{ delay: 0.8 }}
               className="absolute bottom-12 text-white text-[9px] uppercase tracking-[0.2em] font-medium"
            >
              Powered by Tifunbox Inc.
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@900&display=swap');
        
        .shine-text {
          background: linear-gradient(90deg, #fff 0%, #fff 45%, #ffffff88 50%, #fff 55%, #fff 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shine 2s infinite linear;
        }

        @keyframes shine {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

