
import React from 'react';

export const AttackIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M14.597 2.235a1 1 0 0 0-1.031.242l-5.469 6.562-2.854 1.32a1.5 1.5 0 0 0-.82 1.956l.376.94a1.5 1.5 0 0 0 1.956.82l1.32-2.855 6.562-5.468a1 1 0 0 0 .242-1.032zm-2.121 2.121-5.657 5.657 2.828 2.828 5.657-5.657-2.828-2.828zM8.465 14.85l-4.243 4.242a1 1 0 0 0 1.414 1.414l4.243-4.242-1.414-1.414z" />
    <path d="M19.155 5.564l-2.121 2.121 2.828 2.828 2.121-2.121a2 2 0 0 0-2.828-2.828z" />
  </svg>
);

export const DefenseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L3 5v6.2C3 17.9 6.8 22 12 22s9-4.1 9-10.8V5l-9-3zm0 18c-3.7 0-6.8-2.9-7-6.8V6.7l7-2.2 7 2.2v8.5c-.2 3.9-3.3 6.8-7 6.8z" />
  </svg>
);

export const PassionIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.83 2.2a1 1 0 0 0-1.66 0C9.9 3.52 9 5.43 9 7.5c0 4.14 3 7.5 3 7.5s3-3.36 3-7.5c0-2.07-.9-3.98-2.17-5.3Z" />
  </svg>
);

export const CalmIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a8 8 0 0 0-8 8c0 2.5 2.15 6.5 8 11.5C17.85 16.5 20 12.5 20 10a8 8 0 0 0-8-8Z" />
  </svg>
);

export const HarmonyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
  </svg>
);
