import { HeartHandshake, School } from 'lucide-react';
import { useState } from 'react';

export function OrganizationLogo({
  src,
  alt,
  kind,
  className = '',
}: {
  src: string;
  alt: string;
  kind: 'school' | 'youth';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = kind === 'school' ? School : HeartHandshake;

  return failed ? (
    <span
      role="img"
      aria-label={alt}
      className={`grid place-items-center bg-white text-coral-600 ${className}`}
    >
      <Icon aria-hidden="true" className="size-1/2" strokeWidth={1.8} />
    </span>
  ) : (
    <img
      src={src}
      alt={alt}
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
