import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'gold' | 'success' | 'navy';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'blue', icon }) => {
  return (
    <span className={`ttpa-badge ttpa-badge-${variant}`}>
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
};
