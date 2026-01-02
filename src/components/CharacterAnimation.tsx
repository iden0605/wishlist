import React, { useState, useEffect, useRef } from 'react';

// Define directions and corresponding GIF paths
const GIF_PATHS = {
  north: '/animations/walking-north.gif',
  east: '/animations/walking-east.gif',
  south: '/animations/walking-south.gif',
  west: '/animations/walking-west.gif',
  idle: '/animations/fighting-stance.gif',
  kick: '/animations/kick.gif',
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
  const [isKicking, setIsKicking] = useState(false);
  const kickTimeoutRef = useRef<number | null>(null);

  const characterSize = { width: 64, height: 64 }; // Base size for mobile, will be overridden by CSS for larger screens
  const speed = 3;
  const reachedThreshold = 5;

  const horizontalMargin = -50;
  const verticalMargin = -8;

  const getDocumentRelativeCoords = (element?: HTMLElement | null) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  };

  const generatePath = (): PathPoint[] => {
    const addItemElement = addItemRef.current;
    if (!addItemElement) return [];

    const rect = getDocumentRelativeCoords(addItemElement);
    if (!rect) return [];

    const patrolPath: PathPoint[] = [];

    patrolPath.push({
      x: rect.x - horizontalMargin - characterSize.width - 27,
      y: rect.y - verticalMargin - characterSize.height,
      direction: 'east',
    });

    patrolPath.push({
      x: rect.x + rect.width + horizontalMargin + 30,
      y: rect.y - verticalMargin - characterSize.height,
      direction: 'south',
    });

    patrolPath.push({
      x: rect.x + rect.width + horizontalMargin + 30,
      y: rect.y + rect.height + verticalMargin - 30,
      direction: 'west',
    });

    patrolPath.push({
      x: rect.x - horizontalMargin - characterSize.width - 27,
      y: rect.y + rect.height + verticalMargin - 30,
      direction: 'north',
    });

    return patrolPath;
  };

  useEffect(() => {
    const initCharacter = () => {
      const newPath = generatePath();
      if (newPath.length > 0 && !isInitialized) {
        setPosition(newPath[0]);
        setPath(newPath);
        setIsInitialized(true);
        setCurrentPathIndex(0);
        setDirection(newPath[0].direction);
      } else if (!isInitialized) {
        setPosition({
          x: window.scrollX + (window.innerWidth / 2) - (characterSize.width / 2),
          y: window.scrollY + window.innerHeight - characterSize.height - 20,
        });
        setDirection('idle');
        setIsInitialized(true);
      } else if (newPath.length > 0) {
        setPath(newPath);
        if (currentPathIndex >= newPath.length) {
          setCurrentPathIndex(0);
        }
      }
    };

    if (addItemRef.current || !isInitialized) {
      initCharacter();
    }

    const handleResizeAndScroll = () => {
      const newPath = generatePath();
      setPath(newPath);
      if (currentPathIndex >= newPath.length) {
        setCurrentPathIndex(0);
      }
    };

    window.addEventListener('resize', handleResizeAndScroll);
    window.addEventListener('scroll', handleResizeAndScroll);

    return () => {
      window.removeEventListener('resize', handleResizeAndScroll);
      window.removeEventListener('scroll', handleResizeAndScroll);
    };
  }, [addItemRef, characterSize.width, characterSize.height, isInitialized]);

  useEffect(() => {
    // Pause movement if loading, hovered, or kicking, but keep the direction
    if (isLoading || !isInitialized || path.length === 0 || isHovered || isKicking) {
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
  }, [isLoading, isHovered, isKicking, position, currentPathIndex, path, isInitialized, characterSize.width, characterSize.height, direction]);

  const handleAction = () => {
    if (isLoading || isKicking) return;

    setIsKicking(true);
    if (kickTimeoutRef.current) {
      clearTimeout(kickTimeoutRef.current);
    }
    kickTimeoutRef.current = window.setTimeout(() => {
      setIsKicking(false);
      kickTimeoutRef.current = null;
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (kickTimeoutRef.current) {
        clearTimeout(kickTimeoutRef.current);
      }
    };
  }, []);

  // Determine which GIF to show
  const getCurrentGif = () => {
    if (isLoading) return GIF_PATHS.idle;
    if (isKicking) return GIF_PATHS.kick;
    if (isHovered) return GIF_PATHS.idle;
    return GIF_PATHS[direction];
  };

  return (
    <div
      className="fixed z-50 w-16 h-16 lg:w-20 lg:h-20" // Responsive sizing
      style={{
        left: position.x - window.scrollX,
        top: position.y - window.scrollY,
        pointerEvents: 'auto',
        transform: 'translateZ(0)',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleAction}
      onTouchStart={(e) => {
        e.preventDefault();
        handleAction();
      }}
    >
      <img
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