import React, { useState, useRef, useEffect } from 'react';

interface ItemNameProps {
  name: string;
  className?: string;
  lineClamp?: number;
}

const ItemName: React.FC<ItemNameProps> = ({ name, className = 'text-lg font-semibold', lineClamp = 2 }) => {
  const [isTruncated, setIsTruncated] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const isSingleLine = lineClamp === 1;

  useEffect(() => {
    const checkTruncation = () => {
      const element = textRef.current;
      if (element) {
        if (isSingleLine) {
          setIsTruncated(element.scrollWidth > element.clientWidth);
        } else {
          setIsTruncated(element.scrollHeight > element.clientHeight);
        }
      }
    };

    checkTruncation();
    
    window.addEventListener('resize', checkTruncation);
    return () => {
      window.removeEventListener('resize', checkTruncation);
    };
  }, [name, isSingleLine]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  const handleMouseEnter = () => {
    if (isTruncated) {
      setIsTooltipVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsTooltipVisible(false);
  };

  const handleClick = () => {
    if (window.innerWidth < 768 && isTruncated) {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="relative">
      <p
        ref={textRef}
        className={`${className} ${isSingleLine ? 'truncate' : ''}`}
        style={!isSingleLine ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: lineClamp,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } : {}}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {name}
      </p>
      {isTooltipVisible && (
        <div
          className="absolute bottom-full z-10 mb-2 max-w-xs break-words rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-white shadow-lg transition-opacity"
          role="tooltip"
        >
          {name}
        </div>
      )}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            ref={modalRef}
            className="rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <h3 className="text-lg font-semibold">{name}</h3>
            <button
              onClick={closeModal}
              className="mt-4 rounded-md bg-gray-800 px-4 py-2 text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemName;
