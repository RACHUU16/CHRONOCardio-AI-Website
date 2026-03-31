import React from 'react';
import { motion } from 'motion/react';

interface Logo3DProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo3D({ className = '', showText = true, size = 'lg' }: Logo3DProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl'
  };

  return (
    <motion.div 
      className={`flex items-center gap-3 ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.div 
        className={`relative ${sizeClasses[size]} flex items-center justify-center`}
        animate={{ 
          scale: [1, 1.05, 1],
          filter: [
            'drop-shadow(0 0 0px rgba(6, 182, 212, 0.5))',
            'drop-shadow(0 0 20px rgba(6, 182, 212, 0.8))',
            'drop-shadow(0 0 0px rgba(6, 182, 212, 0.5))'
          ]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Heart Shape with AI Circuit Pattern */}
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full"
          style={{
            filter: 'drop-shadow(0 4px 8px rgba(30, 58, 138, 0.3))'
          }}
        >
          <defs>
            <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="50%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
            
            <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          
          {/* Main Heart Shape */}
          <motion.path
            d="M50,85 C25,60 10,40 10,25 C10,15 20,10 30,15 C40,10 50,15 50,25 C50,15 60,10 70,15 C80,10 90,15 90,25 C90,40 75,60 50,85 Z"
            fill="url(#heartGradient)"
            stroke="#10B981"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
          
          {/* AI Circuit Lines */}
          <g stroke="#10B981" strokeWidth="0.8" fill="none" opacity="0.8">
            <motion.path
              d="M30,25 L35,30 L40,25 L45,35"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, delay: 0.5 }}
            />
            <motion.path
              d="M55,35 L60,25 L65,30 L70,25"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, delay: 0.7 }}
            />
            <motion.path
              d="M35,45 L40,40 L45,50 L50,45 L55,50 L60,40 L65,45"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: 1 }}
            />
          </g>
          
          {/* Pulse Line */}
          <motion.line
            x1="20"
            y1="75"
            x2="80"
            y2="75"
            stroke="url(#pulseGradient)"
            strokeWidth="2"
            opacity="0.9"
            animate={{
              x1: [20, 80, 20],
              x2: [80, 20, 80]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          
          {/* AI Nodes */}
          <motion.circle
            cx="30"
            cy="30"
            r="2"
            fill="#10B981"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
          />
          <motion.circle
            cx="70"
            cy="30"
            r="2"
            fill="#10B981"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          />
          <motion.circle
            cx="50"
            cy="45"
            r="2"
            fill="#10B981"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
          />
        </svg>
      </motion.div>
      
      {showText && (
        <motion.div 
          className="flex flex-col"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <motion.h1 
            className={`${textSizes[size]} font-bold text-primary leading-tight`}
            animate={{ 
              textShadow: [
                '0 0 0px rgba(6, 182, 212, 0)',
                '0 0 10px rgba(6, 182, 212, 0.3)',
                '0 0 0px rgba(6, 182, 212, 0)'
              ]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            CHRONOCardioAI
          </motion.h1>
          {size !== 'sm' && (
            <motion.p 
              className="text-xs text-muted-foreground font-medium tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              AI-Powered Cardiac Risk Prediction
            </motion.p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}