import React, { useState, useRef, useEffect } from 'react';

interface CollapsibleRemarkProps {
  remark: string;
}

const CollapsibleRemark: React.FC<CollapsibleRemarkProps> = ({ remark }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState('auto');
  const [fullHeight, setFullHeight] = useState('auto');
  const contentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = contentRef.current;
    if (element) {
      const styles = window.getComputedStyle(element);
      const lineHeight = parseFloat(styles.lineHeight);
      const paddingTop = parseFloat(styles.paddingTop);
      const paddingBottom = parseFloat(styles.paddingBottom);
      const singleLineHeight = lineHeight + paddingTop + paddingBottom;

      setCollapsedHeight(`${singleLineHeight - 3}px`);
      setFullHeight(`${element.scrollHeight}px`);
      
      if (element.scrollHeight > singleLineHeight) {
        setIsTruncated(true);
      } else {
        setIsTruncated(false);
      }
    }
  }, [remark]);

  if (!remark) return null;

  return (
    <div className="mt-2">
      <div
        className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: isTruncated && !isExpanded ? collapsedHeight : fullHeight }}
      >
        <p ref={contentRef} className="text-sm text-stone-600 italic bg-stone-100 p-2 rounded-lg break-words">
          {remark}
        </p>
      </div>
      
      {isTruncated && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-500 hover:underline mt-1"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

export default CollapsibleRemark;