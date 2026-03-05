'use client';

import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  isStreaming?: boolean;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export default function TypewriterText({
  text,
  isStreaming = false,
  speed = 30,
  onComplete,
  className = '',
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && !isStreaming && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, isStreaming, onComplete]);

  // Reset when text changes completely
  useEffect(() => {
    if (text.length < displayedText.length) {
      setDisplayedText('');
      setCurrentIndex(0);
    }
  }, [text]);

  return (
    <span className={className}>
      {displayedText}
      {isStreaming && currentIndex >= text.length && (
        <span className="animate-pulse">▋</span>
      )}
    </span>
  );
}
