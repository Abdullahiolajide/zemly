import React from 'react';

interface LogoProps {
    className?: string; // e.g., "h-10", "h-14"
}

const Logo: React.FC<LogoProps> = ({ className = 'h-10' }) => {
    return (
        <div className="flex items-center">
            <style>
                {`
                    .logo-light-img { display: none; }
                    .logo-dark-img { display: block; }
                    html.light .logo-light-img { display: block; }
                    html.light .logo-dark-img { display: none; }
                `}
            </style>
            <img 
                src="/logo.png" 
                alt="Zemly Logo" 
                className={`logo-light-img w-auto object-contain ${className}`}
            />
            <img 
                src="/logo-dark.png" 
                alt="Zemly Logo" 
                className={`logo-dark-img w-auto object-contain ${className}`}
            />
        </div>
    );
};

export default Logo;
