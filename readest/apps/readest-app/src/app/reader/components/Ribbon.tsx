import clsx from 'clsx';
import React from 'react';

interface RibbonProps {
  width: string;
}

const Ribbon: React.FC<RibbonProps> = ({ width }) => {
  return (
    <div
      className={clsx('absolute inset-0 z-10 flex h-11 justify-center')}
      style={{ width: width }}
    >
      <svg
        stroke='currentColor'
        fill='currentColor'
        strokeWidth='0'
        version='1'
        viewBox='0 0 20 45'
        enableBackground='new 0 0 20 45'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path fill='#F44336' d='M 20 45 L 10 35 L 0 45 L 0 0 L 20 0'></path>
      </svg>
    </div>
  );
};

export default Ribbon;
