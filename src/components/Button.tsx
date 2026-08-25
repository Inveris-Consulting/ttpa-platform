import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'navy' | 'gold' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  const variantClass = `ttpa-btn-${variant}`;
  const sizeClass = size === 'sm' ? 'ttpa-btn-sm' : size === 'lg' ? 'ttpa-btn-lg' : '';

  return (
    <button className={`ttpa-btn ${variantClass} ${sizeClass} ${className}`} {...props}>
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
