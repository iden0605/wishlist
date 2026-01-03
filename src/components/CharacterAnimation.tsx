import React, { useState, useEffect, useRef, useCallback } from 'react';

// Define directions and corresponding GIF paths
const GIF_PATHS = {
  north: '/animations/walking-north.gif',
  east: '/animations/walking-east.gif',
  south: '/animations/walking-south.gif',
  west: '/animations/walking-west.gif',
  idle: '/animations/fighting-stance.gif',
  kick: '/animations/kick.gif',
  uppercut: '/animations/uppercut.gif',
  breathing: '/animations/breathing.gif',
  sweepkick: '/animations/sweepkick.gif',
  getup: '/animations/getup.gif',
};

const ANIMATION_DURATIONS: Record<'kick' | 'uppercut' | 'sweepkick', number> = {
  kick: 1500,
  uppercut: 1500,
  sweepkick: 1500,
};

interface CharacterAnimationProps {
  isLoading: boolean;
  addItemRef: React.RefObject<HTMLDivElement>;
}

interface PathPoint {
  x: number;
  y: number;
  direction: 'north' | 'east' | 'south' | 'west';
}

const CharacterAnimation: React.FC<CharacterAnimationProps> = ({
  isLoading,
  addItemRef,
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<'north' | 'east' | 'south' | 'west' | 'idle'>('idle');
  const [path, setPath] = useState<PathPoint[]>([]);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [attack, setAttack] = useState<'kick' | 'uppercut' | 'sweepkick' | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [isBreathing, setIsBreathing] = useState(false);
  const [isGettingUp, setIsGettingUp] = useState(true);
  const actionTimeoutRef = useRef<number | null>(null);
  const lastAttackRef = useRef<'kick' | 'uppercut' | 'sweepkick'>('sweepkick');
  const scrollOffsetRef = useRef({ x: 0, y: 0 });
  const lastDivHeightRef = useRef<number>(0);

  const characterSize = { width: 64, height: 64 };
  const speed = 5;
  const reachedThreshold = 5;

  const horizontalMargin = -50;
  const verticalMargin = -8;

  const getDocumentRelativeCoords = useCallback((element?: HTMLElement | null) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  }, []);

  const generatePath = useCallback((): PathPoint[] => {
    const addItemElement = addItemRef.current;
    if (!addItemElement) return [];

    const rect = getDocumentRelativeCoords(addItemElement);
    if (!rect) return [];

    const patrolPath: PathPoint[] = [];

    // Start at top-left
    patrolPath.push({
      x: rect.x - horizontalMargin - characterSize.width - 27,
      y: rect.y - verticalMargin - characterSize.height,
      direction: 'east',
    });

    // Move to top-right
    patrolPath.push({
      x: rect.x + rect.width + horizontalMargin + 20,
      y: rect.y - verticalMargin - characterSize.height,
      direction: 'south',
    });

    // Move to bottom-right
    patrolPath.push({
      x: rect.x + rect.width + horizontalMargin + 20,
      y: rect.y + rect.height + verticalMargin - 30,
      direction: 'west',
    });

    // Move to bottom-left
    patrolPath.push({
      x: rect.x - horizontalMargin - characterSize.width - 27,
      y: rect.y + rect.height + verticalMargin - 30,
      direction: 'north',
    });

    return patrolPath;
  }, [addItemRef, characterSize.height, characterSize.width, getDocumentRelativeCoords]);

  const resetAnimation = useCallback(() => {
    setIsInitialized(false);
    setIsGettingUp(true);
    setCurrentPathIndex(0);
    setIsHovered(false);
    setAttack(null);
    setIsBreathing(false);
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const initCharacter = () => {
      const newPath = generatePath();
      if (newPath.length > 0 && !isInitialized) {
        setPosition(newPath[0]);
        setPath(newPath);
        
        setTimeout(() => {
          setIsGettingUp(false);
          setIsInitialized(true);
        }, 1000);

        setCurrentPathIndex(0);
        setDirection(newPath[0].direction);
        scrollOffsetRef.current = { x: window.scrollX, y: window.scrollY };
        
        // Store initial height
        const rect = getDocumentRelativeCoords(addItemRef.current);
        if (rect) lastDivHeightRef.current = rect.height;
      } else if (!isInitialized) {
        setPosition({
          x: window.scrollX + (window.innerWidth / 2) - (characterSize.width / 2),
          y: window.scrollY + window.innerHeight - characterSize.height - 20,
        });
        setDirection('idle');
        setIsInitialized(true);
        scrollOffsetRef.current = { x: window.scrollX, y: window.scrollY };
      } else if (newPath.length > 0) {
        // Check if height changed
        const rect = getDocumentRelativeCoords(addItemRef.current);
        if (rect && lastDivHeightRef.current !== rect.height) {
          const heightDiff = rect.height - lastDivHeightRef.current;
          lastDivHeightRef.current = rect.height;
          
          // Adjust character position if on bottom side (indices 2 and 3)
          if (currentPathIndex === 2 || currentPathIndex === 3) {
            setPosition(prev => ({ x: prev.x, y: prev.y + heightDiff }));
          }
        }
        
        setPath(newPath);
        if (currentPathIndex >= newPath.length) {
          setCurrentPathIndex(0);
        }
      }
    };

    if (addItemRef.current || !isInitialized) {
      initCharacter();
    }

    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        resetAnimation();
      }, 250);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [addItemRef, characterSize.width, characterSize.height, isInitialized, resetAnimation, generatePath]);

  useEffect(() => {
    // Pause movement if loading, hovered, or kicking, but keep the direction
    if (isLoading || !isInitialized || path.length === 0 || isHovered || attack || isBreathing || isGettingUp) {
      return;
    }

    const targetPoint = path[currentPathIndex % path.length];

    const moveCharacter = () => {
      const dx = targetPoint.x - position.x;
      const dy = targetPoint.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < reachedThreshold) {
        const nextIndex = (currentPathIndex + 1) % path.length;
        setCurrentPathIndex(nextIndex);
        setDirection(path[nextIndex].direction);
        return;
      }

      let newX = position.x;
      let newY = position.y;
      let newDirection: 'north' | 'east' | 'south' | 'west' | 'idle' = direction;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          newX += Math.min(speed, dx);
          newDirection = 'east';
        } else if (dx < 0) {
          newX -= Math.min(speed, Math.abs(dx));
          newDirection = 'west';
        }
      } else {
        if (dy > 0) {
          newY += Math.min(speed, dy);
          newDirection = 'south';
        } else if (dy < 0) {
          newY -= Math.min(speed, Math.abs(dy));
          newDirection = 'north';
        }
      }

      if (dx > 0 && newX > targetPoint.x) newX = targetPoint.x;
      if (dx < 0 && newX < targetPoint.x) newX = targetPoint.x;
      if (dy > 0 && newY > targetPoint.y) newY = targetPoint.y;
      if (dy < 0 && newY < targetPoint.y) newY = targetPoint.y;

      if (newX !== position.x || newY !== position.y || newDirection !== direction) {
        setPosition({ x: newX, y: newY });
        setDirection(newDirection);
      }
    };

    const interval = setInterval(moveCharacter, 100);
    return () => clearInterval(interval);
  }, [isLoading, isHovered, attack, isBreathing, position, currentPathIndex, path, isInitialized, characterSize.width, characterSize.height, direction, isGettingUp]);

  // Broadcast character position via a custom event
  useEffect(() => {
    const dispatchPosition = () => {
      window.dispatchEvent(new CustomEvent('character-move', {
        detail: {
          x: position.x,
          y: position.y,
          width: characterSize.width,
          height: characterSize.height,
        },
      }));
    };

    dispatchPosition(); // Dispatch on every position change

    const handleRequest = () => dispatchPosition(); // Also dispatch on request
    window.addEventListener('request-character-position', handleRequest);

    return () => {
      window.removeEventListener('request-character-position', handleRequest);
    };
  }, [position, characterSize]);

  const handleAction = () => {
    if (isLoading || attack || isBreathing) return;

    const attacks: ('kick' | 'uppercut' | 'sweepkick')[] = ['kick', 'uppercut', 'sweepkick'];
    const lastAttackIndex = attacks.indexOf(lastAttackRef.current);
    const newAttack = attacks[(lastAttackIndex + 1) % attacks.length];
    lastAttackRef.current = newAttack;
    setAttack(newAttack);
    setAnimationKey(prev => prev + 1);

    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
    }
    
    const attackDuration = ANIMATION_DURATIONS[newAttack];

    actionTimeoutRef.current = window.setTimeout(() => {
      setAttack(null);
      setIsBreathing(true);

      actionTimeoutRef.current = window.setTimeout(() => {
        setIsBreathing(false);
        actionTimeoutRef.current = null;
      }, 1000); // 1 second of breathing

    }, attackDuration);
  };

  useEffect(() => {
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
      }
    };
  }, []);

  // Monitor div height changes
  useEffect(() => {
    if (!isInitialized || !addItemRef.current) return;

    const element = addItemRef.current;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        if (lastDivHeightRef.current !== newHeight) {
          const heightDiff = newHeight - lastDivHeightRef.current;
          lastDivHeightRef.current = newHeight;

          // Update path with new dimensions
          const newPath = generatePath();
          setPath(newPath);

          // Adjust character position if on bottom side (indices 2 and 3)
          if (currentPathIndex === 2 || currentPathIndex === 3) {
            setPosition(prev => ({ x: prev.x, y: prev.y + heightDiff }));
          }
        }
      }
    });

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [isInitialized, addItemRef, generatePath, currentPathIndex, getDocumentRelativeCoords]);

  // Determine which GIF to show
  const getCurrentGif = () => {
    if (isGettingUp) return GIF_PATHS.getup;
    if (isLoading) return GIF_PATHS.idle;
    if (isBreathing) return GIF_PATHS.breathing;
    if (attack === 'kick') return GIF_PATHS.kick;
    if (attack === 'uppercut') return GIF_PATHS.uppercut;
    if (attack === 'sweepkick') return GIF_PATHS.sweepkick;
    if (isHovered) return GIF_PATHS.idle;
    return GIF_PATHS[direction];
  };

  return (
    <div
      className="absolute z-10 w-16 h-16 lg:w-20 lg:h-20"
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: isBreathing ? 'none' : 'auto',
        cursor: isBreathing ? 'default' : 'pointer',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleAction}
      onTouchStart={(e) => {
        e.preventDefault();
        setIsHovered(false);
        handleAction();
      }}
    >
      <img
        key={animationKey}
        src={getCurrentGif()}
        alt="Jocelyn's character animation"
        className="w-full h-full object-contain"
        onError={(e) => {
          console.error('Failed to load GIF for:', e.currentTarget.src, e);
          if (e.currentTarget.src !== GIF_PATHS.idle) {
            e.currentTarget.src = GIF_PATHS.idle;
          }
        }}
      />
    </div>
  );
};

export default CharacterAnimation;