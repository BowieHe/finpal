'use client';

interface LoadingDotsProps {
  className?: string;
}

export default function LoadingDots({ className = '' }: LoadingDotsProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span 
        className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span 
        className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span 
        className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </span>
  );
}
