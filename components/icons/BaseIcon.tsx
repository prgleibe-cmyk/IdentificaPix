import React from 'react';

export const BaseIcon: React.FC<any> = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={props.strokeWidth || 1.5} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={props.className || "w-6 h-6"}
        {...props}
    >
        {props.children}
    </svg>
);
